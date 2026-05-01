use std::{env, fs};

use zed_extension_api as zed;

const PACKAGE_NAME: &str = "zed-sftp-server";
const SERVER_PATH: &str = "node_modules/zed-sftp-server/dist/index.js";

struct SftpExtension {
    cached_server_path: Option<String>,
}

impl SftpExtension {
    fn server_exists(&self) -> bool {
        fs::metadata(SERVER_PATH).map_or(false, |stat| stat.is_file())
    }

    fn server_script_path(
        &mut self,
        language_server_id: &zed::LanguageServerId,
    ) -> zed::Result<String> {
        if let Some(cached_server_path) = &self.cached_server_path {
            if fs::metadata(cached_server_path).map_or(false, |stat| stat.is_file()) {
                return Ok(cached_server_path.clone());
            }
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        let latest_version = zed::npm_package_latest_version(PACKAGE_NAME)?;
        let installed_version = zed::npm_package_installed_version(PACKAGE_NAME)?;

        if !self.server_exists() || installed_version.as_ref() != Some(&latest_version) {
            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::Downloading,
            );

            match zed::npm_install_package(PACKAGE_NAME, &latest_version) {
                Ok(()) => {
                    if !self.server_exists() {
                        return Err(format!(
                            "Installed package '{PACKAGE_NAME}' did not contain expected path '{SERVER_PATH}'"
                        ));
                    }
                }
                Err(error) => {
                    if !self.server_exists() {
                        return Err(error);
                    }
                }
            }
        }

        let server_path = env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?
            .join(SERVER_PATH)
            .to_string_lossy()
            .to_string();

        self.cached_server_path = Some(server_path.clone());
        Ok(server_path)
    }
}

impl zed::Extension for SftpExtension {
    fn new() -> Self {
        Self {
            cached_server_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        let server_path = self.server_script_path(language_server_id)?;

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![server_path, "--stdio".to_string()],
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(SftpExtension);
