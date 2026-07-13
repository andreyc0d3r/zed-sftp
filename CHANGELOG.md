# Changelog

All notable changes to this project will be documented in this file.

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

[0.1.1]: https://github.com/andreyc0d3r/zed-sftp/compare/24f7174...main
