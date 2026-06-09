use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct AppDataPaths {
    pub root: PathBuf,
    pub database: PathBuf,
    pub run_workspaces: PathBuf,
    pub artifacts: PathBuf,
    pub backups: PathBuf,
    pub wiki: PathBuf,
    pub secure_storage: PathBuf,
}

impl AppDataPaths {
    pub fn create(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref().to_path_buf();
        let paths = Self {
            database: root.join("plutus.sqlite3"),
            run_workspaces: root.join("runs"),
            artifacts: root.join("artifacts"),
            backups: root.join("backups"),
            wiki: root.join("wiki"),
            secure_storage: root.join("secure"),
            root,
        };
        for path in [
            &paths.root,
            &paths.run_workspaces,
            &paths.artifacts,
            &paths.backups,
            &paths.wiki,
            &paths.secure_storage,
        ] {
            fs::create_dir_all(path)
                .with_context(|| format!("failed to create {}", path.display()))?;
        }
        Ok(paths)
    }
}
