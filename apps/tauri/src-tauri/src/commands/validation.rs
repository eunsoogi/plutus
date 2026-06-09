use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::path::{Component, PathBuf};

use crate::security::redact_secret_values;

pub(super) fn validate_relative_artifact_path(path: &str) -> Result<PathBuf> {
    let candidate = PathBuf::from(path);
    if candidate.is_absolute() {
        bail!("final output artifact path must be relative to run workspace: {path}");
    }
    if candidate.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        bail!("final output artifact path escapes run workspace: {path}");
    }
    Ok(candidate)
}
pub(super) fn validate_final_output(structured: &mut Value) -> Result<()> {
    *structured = redact_secret_values(structured);
    let allowed = [
        "observe",
        "research_more",
        "rebalance_candidate",
        "strategy_candidate",
        "risk_warning",
        "no_action",
    ];
    let category = structured
        .get("recommendationCategory")
        .and_then(|value| value.as_str())
        .context("recommendationCategory is required")?;
    if !allowed.contains(&category) {
        bail!("invalid recommendation category: {category}");
    }
    require_non_empty_string(structured, "title")?;
    require_non_empty_string(structured, "userRequest")?;
    require_non_empty_string(structured, "selectedTeam")?;
    require_non_empty_string(structured, "summary")?;
    let confidence = structured
        .get("confidence")
        .and_then(|value| value.as_str())
        .context("confidence is required")?;
    if !["low", "medium", "high"].contains(&confidence) {
        bail!("invalid confidence: {confidence}");
    }
    require_string_array(structured, "warnings", false)?;
    require_string_array(structured, "evidenceRefs", true)?;
    require_supporting_evidence(structured)?;
    require_string_array(structured, "caveats", false)?;
    require_string_array(structured, "assumptions", false)?;
    require_string_array(structured, "dissentingViews", false)?;
    require_risk_checklist(structured)?;
    require_artifacts(structured)?;
    require_string_array(structured, "artifactRefs", false)?;
    require_string_array(structured, "limitations", false)?;
    require_string_array(structured, "nextActions", false)?;
    require_bool(structured, "approvalRequired")?;
    let risk_validation = structured
        .get("riskValidation")
        .and_then(|value| value.as_str())
        .context("riskValidation is required")?;
    if !["approved", "approved_with_warnings", "vetoed"].contains(&risk_validation) {
        bail!("invalid riskValidation: {risk_validation}");
    }
    let delay_status = structured
        .get("freshness")
        .and_then(|value| value.get("delayStatus"))
        .and_then(|value| value.as_str())
        .context("freshness.delayStatus is required")?;
    if !["realtime", "delayed", "stale", "unknown"].contains(&delay_status) {
        bail!("invalid freshness.delayStatus: {delay_status}");
    }
    if structured
        .get("riskValidation")
        .and_then(|value| value.as_str())
        == Some("vetoed")
    {
        structured["recommendationCategory"] = Value::String("no_action".to_string());
    }
    if let Some(veto) = structured.get("riskVeto") {
        let category = if veto.get("blocking").and_then(|value| value.as_bool()) == Some(false) {
            "risk_warning"
        } else {
            "no_action"
        };
        structured["recommendationCategory"] = Value::String(category.to_string());
    }
    Ok(())
}

fn require_non_empty_string(structured: &Value, key: &str) -> Result<()> {
    if structured
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some()
    {
        Ok(())
    } else {
        bail!("final output {key} is required")
    }
}

fn require_bool(structured: &Value, key: &str) -> Result<()> {
    if structured
        .get(key)
        .and_then(|value| value.as_bool())
        .is_some()
    {
        Ok(())
    } else {
        bail!("final output {key} is required")
    }
}

fn require_string_array(structured: &Value, key: &str, non_empty: bool) -> Result<()> {
    let values = structured
        .get(key)
        .and_then(|value| value.as_array())
        .with_context(|| format!("final output {key} must be an array"))?;
    if non_empty && values.is_empty() {
        bail!("final output {key} must not be empty");
    }
    for value in values {
        if value.as_str().is_none() {
            bail!("final output {key} must contain string values");
        }
    }
    Ok(())
}

fn require_supporting_evidence(structured: &Value) -> Result<()> {
    let values = structured
        .get("supportingEvidence")
        .and_then(|value| value.as_array())
        .context("final output supportingEvidence must be an array")?;
    if values.is_empty() {
        bail!("final output supportingEvidence must not be empty");
    }
    for value in values {
        require_nested_string(value, "supportingEvidence", "label")?;
        require_nested_string(value, "supportingEvidence", "sourceRef")?;
    }
    Ok(())
}

fn require_risk_checklist(structured: &Value) -> Result<()> {
    let values = structured
        .get("riskChecklist")
        .and_then(|value| value.as_array())
        .context("final output riskChecklist must be an array")?;
    for value in values {
        require_nested_string(value, "riskChecklist", "check")?;
        let status = value
            .get("status")
            .and_then(|value| value.as_str())
            .context("final output riskChecklist.status is required")?;
        if !["pass", "warning", "fail", "not_applicable"].contains(&status) {
            bail!("invalid riskChecklist.status: {status}");
        }
        require_nested_string_array(value, "riskChecklist", "evidenceRefs")?;
    }
    Ok(())
}

fn require_artifacts(structured: &Value) -> Result<()> {
    let values = structured
        .get("artifacts")
        .and_then(|value| value.as_array())
        .context("final output artifacts must be an array")?;
    for value in values {
        require_nested_string(value, "artifacts", "artifactId")?;
        require_nested_string(value, "artifacts", "type")?;
        require_nested_string(value, "artifacts", "title")?;
        if value.get("path").is_some() {
            require_nested_string(value, "artifacts", "path")?;
        }
    }
    Ok(())
}

pub(super) fn artifact_path_for_ref(structured: &Value, artifact_ref: &str) -> Option<String> {
    structured
        .get("artifacts")
        .and_then(|value| value.as_array())?
        .iter()
        .find(|artifact| {
            ["artifactId", "title", "path"].iter().any(|field| {
                artifact.get(field).and_then(|value| value.as_str()) == Some(artifact_ref)
            })
        })
        .and_then(|artifact| artifact.get("path").and_then(|value| value.as_str()))
        .map(ToString::to_string)
}

fn require_nested_string(value: &Value, array_key: &str, field: &str) -> Result<()> {
    if value
        .get(field)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some()
    {
        Ok(())
    } else {
        bail!("final output {array_key}.{field} is required")
    }
}

fn require_nested_string_array(value: &Value, array_key: &str, field: &str) -> Result<()> {
    let values = value
        .get(field)
        .and_then(|value| value.as_array())
        .with_context(|| format!("final output {array_key}.{field} must be an array"))?;
    for item in values {
        if item.as_str().is_none() {
            bail!("final output {array_key}.{field} must contain string values");
        }
    }
    Ok(())
}
