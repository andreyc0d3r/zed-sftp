# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2026-08-17

### Added

- Authenticate through an SSH agent with `"agent": "$SSH_AUTH_SOCK"`, an explicit socket path, or Pageant without storing a private-key passphrase in SFTP configuration.
- Report a clear connection error when SSH agent authentication is requested but `SSH_AUTH_SOCK` is unavailable to Zed.

## [0.1.2] - 2026-07-22

### Changed

- Rename the marketplace extension ID to `sftp-file-sync` before initial publication.

### Fixed

- Reconnect and retry once when an SFTP operation encounters a connection dropped by sleep or another network interruption.
- Apply the configured SSH keepalive interval so dead connections are detected sooner.

### Added

- Add an `SFTP: Reconnect` code action for manually restoring the connection without restarting Zed.

## [0.1.1] - 2026-07-13

### Fixed

- Initialize the language server from `workspaceFolders`, `rootUri`, or `rootPath`, restoring upload-on-save when Zed omits workspace folder metadata.
- Decode file URIs correctly, including paths containing spaces and other escaped characters.
- Expose upload, download, folder transfer, and workspace sync operations through Zed code actions.
- Reload connection settings when the SFTP configuration changes or is created after server startup.
- Accept comments and trailing commas in `.zed/sftp.json` and compatible configuration files.
- Merge the selected profile before validating required connection fields.
- Match directory ignore rules against their contents and prevent the active SFTP configuration file from being uploaded.
- Reject sibling paths that only share the configured context path prefix.

### Changed

- Document manual operations through `editor: toggle code actions` (`Cmd+.` on macOS or `Ctrl+.` on Linux and Windows).
- Add automated configuration, path handling, command, and stdio LSP regression tests.

[0.1.3]: https://github.com/andreyc0d3r/zed-sftp/compare/6c677af...main
[0.1.2]: https://github.com/andreyc0d3r/zed-sftp/compare/72d1398...6c677af
[0.1.1]: https://github.com/andreyc0d3r/zed-sftp/compare/24f7174...72d1398
