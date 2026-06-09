use anyhow::Result;
use rusqlite::params;
use serde_json::{json, Value};
use std::{
    io::{BufRead, BufReader, Read},
    process::Child,
    thread,
};

use crate::storage::{
    now, AppDataPaths, AppendRunEvent, PersistFinalOutput, PlutusDatabase, RunEvent,
};

use super::super::PlutusCommands;

pub(in crate::commands) fn spawn_codex_runtime_stream_consumer(
    run_id: String,
    paths: AppDataPaths,
    stdout: impl std::io::Read + Send + 'static,
    stderr: Option<impl Read + Send + 'static>,
    mut child: Child,
) {
    thread::spawn(move || {
        let Ok(db) = PlutusDatabase::open(&paths.database) else {
            return;
        };
        let stderr_handle = stderr.map(|stderr| {
            thread::spawn(move || {
                let mut reader = BufReader::new(stderr);
                let mut text = String::new();
                let _ = reader.read_to_string(&mut text);
                text
            })
        });
        let commands = PlutusCommands::new_with_paths(&db, &paths);
        let mut final_persisted = false;
        let mut failure_recorded = false;
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let Ok(message) = serde_json::from_str::<Value>(&line) else {
                continue;
            };
            match message.get("type").and_then(|value| value.as_str()) {
                Some("started") => {
                    if let Some(thread_id) =
                        message.get("threadId").and_then(|value| value.as_str())
                    {
                        let _ = db.conn.execute(
                            "UPDATE research_runs SET codex_thread_id = ?1 WHERE id = ?2",
                            params![thread_id, run_id],
                        );
                    }
                }
                Some("event") => {
                    let event = message.get("event").cloned().unwrap_or_else(|| json!({}));
                    if let Err(error) =
                        append_runtime_event(&db, &run_id, "codex_run_host.stream_event", event)
                    {
                        mark_runtime_failed(
                            &db,
                            &run_id,
                            &format!("failed to persist runtime event: {error}"),
                        );
                        failure_recorded = true;
                    }
                }
                Some("finalOutput") => {
                    if let Some(final_output) = message.get("finalOutput").cloned() {
                        let summary = final_output
                            .get("summary")
                            .and_then(|value| value.as_str())
                            .unwrap_or("CodexRunHost completed the research run.")
                            .to_string();
                        match commands.persist_validated_final_output(PersistFinalOutput {
                            research_run_id: run_id.clone(),
                            summary,
                            structured_output: final_output,
                        }) {
                            Ok(_) => final_persisted = true,
                            Err(error) => {
                                mark_runtime_failed(
                                    &db,
                                    &run_id,
                                    &format!("failed to persist final output: {error}"),
                                );
                                failure_recorded = true;
                            }
                        }
                    }
                }
                Some("failed") => {
                    let _ = db.conn.execute(
                        "UPDATE research_runs SET status = 'failed', completed_at = ?1 WHERE id = ?2",
                        params![now(), run_id],
                    );
                }
                _ => {}
            }
        }
        let stderr_tail = stderr_handle
            .and_then(|handle| handle.join().ok())
            .unwrap_or_default();
        match child.wait() {
            Ok(status) if status.success() && (final_persisted || failure_recorded) => {}
            Ok(_) | Err(_) => {
                let already_completed: i64 = db
                    .conn
                    .query_row(
                        "SELECT COUNT(*) FROM research_run_final_outputs WHERE research_run_id = ?1",
                        params![run_id],
                        |row| row.get(0),
                    )
                    .unwrap_or(0);
                if already_completed == 0 {
                    let message = stderr_tail
                        .lines()
                        .rev()
                        .take(5)
                        .collect::<Vec<_>>()
                        .into_iter()
                        .rev()
                        .collect::<Vec<_>>()
                        .join("\n");
                    mark_runtime_failed(
                        &db,
                        &run_id,
                        if message.is_empty() {
                            "CodexRunHost exited without a persisted final output"
                        } else {
                            &message
                        },
                    );
                }
            }
        }
    });
}

pub(in crate::commands) fn next_run_event_sequence(
    db: &PlutusDatabase,
    run_id: &str,
) -> Result<i64> {
    let sequence = db.conn.query_row(
        "SELECT COALESCE(MAX(sequence), 0) + 1 FROM research_run_events WHERE research_run_id = ?1",
        params![run_id],
        |row| row.get(0),
    )?;
    Ok(sequence)
}

pub(in crate::commands) fn append_runtime_event(
    db: &PlutusDatabase,
    run_id: &str,
    default_event_type: &str,
    payload: Value,
) -> Result<RunEvent> {
    let payload = normalize_runtime_event_payload(db, run_id, payload)?;
    let event_type = payload
        .get("type")
        .and_then(|value| value.as_str())
        .unwrap_or(default_event_type)
        .to_string();
    db.append_run_event(AppendRunEvent {
        research_run_id: run_id.to_string(),
        sequence: next_run_event_sequence(db, run_id)?,
        event_type,
        payload,
    })
}

fn normalize_runtime_event_payload(
    db: &PlutusDatabase,
    run_id: &str,
    payload: Value,
) -> Result<Value> {
    let profile_id: String = db.conn.query_row(
        "SELECT profile_id FROM research_runs WHERE id = ?1",
        params![run_id],
        |row| row.get(0),
    )?;
    match payload {
        Value::Object(mut object) => {
            object.insert("runId".to_string(), json!(run_id));
            object.insert("profileId".to_string(), json!(profile_id));
            Ok(Value::Object(object))
        }
        value => Ok(json!({
            "runId": run_id,
            "profileId": profile_id,
            "value": value,
        })),
    }
}

fn mark_runtime_failed(db: &PlutusDatabase, run_id: &str, message: &str) {
    let _ = append_runtime_event(
        db,
        run_id,
        "run.failed",
        json!({
            "type": "run.failed",
            "message": message,
        }),
    );
    let _ = db.conn.execute(
        "UPDATE research_runs SET status = 'failed', completed_at = ?1, failure_reason = ?2 WHERE id = ?3 AND status NOT IN ('completed', 'cancelled')",
        params![now(), message, run_id],
    );
}
