# Architecture

## Overview

This SFTP extension for Zed uses a **Language Server Protocol (LSP)** approach to provide SFTP functionality. This is the same approach used by many Zed extensions and allows us to watch for file changes and trigger uploads.

## Components

### 1. Rust Extension (`src/lib.rs`)

The Rust extension is the entry point that Zed loads. It:

- Implements the `zed::Extension` trait
- Provides the `language_server_command` to start the Node.js language server
- Queries npm for the latest `zed-sftp-server` package and installs updates through the Zed extension API
- Caches the installed server path for the current Zed session
- Handles language server lifecycle management
- Passes configuration from Zed to the language server

### 2. Node.js Language Server (`server/`)

The language server is written in TypeScript and compiled to JavaScript. It:

- Implements the Language Server Protocol (LSP)
- Watches for document save events (`textDocument/didSave`)
- Handles SFTP operations (upload, download, sync)
- Manages SFTP connections
- Provides command execution for manual operations

The compiled server is published separately as `zed-sftp-server` on npm. Installed extensions run the npm package, not the checked-in `server/dist` directory.

#### Key Files:

- **`server/src/index.ts`** - Main language server entry point
  - Sets up LSP connection
  - Handles document save events
  - Registers commands
  - Manages configuration

- **`server/src/sftp-client.ts`** - SFTP client wrapper
  - Wraps `ssh2-sftp-client` library
  - Handles connection management
  - Implements upload/download/sync operations
  - Manages authentication (SSH keys, passwords)

- **`server/src/config.ts`** - Configuration manager
  - Loads `.zed/sftp.json` configuration
  - Handles ignore patterns
  - Manages multiple profiles
  - Validates configuration

## How It Works

### Upload on Save Flow

```
1. User saves file in Zed
   ↓
2. Zed notifies language server via LSP (textDocument/didSave)
   ↓
3. Language server receives save event
   ↓
4. Check if uploadOnSave is enabled
   ↓
5. Check if file matches ignore patterns
   ↓
6. Connect to SFTP server (if not connected)
   ↓
7. Calculate remote path from local path
   ↓
8. Create remote directories if needed
   ↓
9. Upload file via SFTP
   ↓
10. Show notification in Zed
```

### Manual Command Flow

```
1. User opens Zed code actions and selects an SFTP action
   ↓
2. Zed requests textDocument/codeAction from the language server
   ↓
3. Language server returns an action backed by an LSP command
   ↓
4. Zed sends workspace/executeCommand to the language server
   ↓
5. Language server executes the SFTP operation and shows a notification
```

## Why Language Server?

Using a language server provides several advantages:

1. **File Save Events** - LSP provides `textDocument/didSave` events
2. **Manual Operations** - LSP code actions invoke custom commands
3. **Notifications** - Can show messages to users
4. **Logging** - Built-in logging to Zed's console
5. **Standard Protocol** - Well-documented and supported by Zed

## Delivery and Updates

The Rust extension and Node.js server have separate delivery paths:

1. The Zed registry points to a specific extension version and repository commit.
2. When the language server starts, the Rust extension compares the installed `zed-sftp-server` package with npm `latest`.
3. If needed, it downloads the npm package and runs `node_modules/zed-sftp-server/dist/index.js`.
4. The resolved server path is cached until Zed or the extension is restarted.

Consequently, pushing server code to GitHub does not update installed users. The npm package must be published and publicly verified, and users must restart Zed or reload the extension once. See [RELEASING.md](RELEASING.md) for the required release sequence.

## Comparison with VSCode Extension

| Feature | VSCode Extension | This Zed Extension |
|---------|------------------|-------------------|
| File watching | VSCode File System API | LSP didSave events |
| Commands | VSCode Commands API | LSP code actions + executeCommand |
| Configuration | VSCode Settings API | JSON file + LSP |
| UI | VSCode UI API | LSP notifications |
| SFTP Library | ssh2 (Node.js) | ssh2-sftp-client (Node.js) |

## Configuration Loading

The extension looks for configuration in this order:

1. `.zed/sftp.json` (Zed-specific)
2. `.vscode/sftp.json` (VSCode compatibility)
3. `sftp.json` (Root level)

This allows users to:
- Use Zed-specific configuration
- Share configuration with VSCode
- Keep configuration at project root

## Authentication

Supports multiple authentication methods:

1. **SSH Agent** (Recommended)
   - Resolves `"agent": "$SSH_AUTH_SOCK"` from the language server environment
   - Uses keys already loaded into the user's agent
   - Keeps private-key passphrases out of project configuration
   - Also accepts explicit socket paths and `pageant`

2. **SSH Private Key**
   - Reads key from `~/.ssh/id_rsa` or custom path
   - Supports passphrase-protected keys

3. **Password**
   - Stored in configuration file
   - Less secure, not recommended for production

## Connection Management

- Connections are established on-demand
- Connection is reused for multiple operations
- Automatic reconnection on connection loss
- Configurable timeouts and keepalive

## Error Handling

- All SFTP operations wrapped in try-catch
- Errors logged to Zed console
- User-friendly error messages shown as notifications
- Connection errors trigger reconnection attempts

## Performance Considerations

1. **Concurrent Uploads** - Configurable concurrency limit
2. **Connection Pooling** - Single connection reused
3. **Ignore Patterns** - Skip unnecessary files
4. **Incremental Sync** - Only upload changed files

## Future Enhancements

Potential improvements:

1. **File Watcher** - Watch file system for changes (not just saves)
2. **Diff View** - Compare local and remote files
3. **Remote Explorer** - Browse remote files in Zed
4. **Progress Indicators** - Show upload/download progress
5. **FTP/FTPS Support** - Add FTP protocol support
6. **Conflict Resolution** - Handle file conflicts
7. **Bandwidth Throttling** - Limit transfer speed
8. **Transfer Queue** - Queue multiple transfers

## Development

### Building

```bash
# Build language server
cd server
npm install
npm run build

# Build Rust extension
cargo build --release
```

### Testing

```bash
# Test language server
cd server
npm test

# Test Rust extension
cargo test
```

### Debugging

1. **Language Server Logs**
   - Open Zed log: `Cmd+Shift+P` → "zed: open log"
   - Look for SFTP-related messages

2. **SFTP Operations**
   - Enable debug logging in configuration
   - Check connection details
   - Verify file paths

## Dependencies

### Rust Dependencies

- `zed_extension_api` - Zed extension API
- `serde` - JSON serialization
- `serde_json` - JSON parsing

### Node.js Dependencies

- `vscode-languageserver` - LSP implementation
- `vscode-languageserver-textdocument` - Text document handling
- `ssh2-sftp-client` - SFTP client library
- `chokidar` - File system watcher (future use)
- `minimatch` - Glob pattern matching

## Security Considerations

1. **Credentials Storage**
   - Never commit passwords to git
   - Use SSH keys when possible
   - Consider using environment variables

2. **File Permissions**
   - Set appropriate permissions on uploaded files
   - Respect remote server permissions

3. **Connection Security**
   - Use SFTP (SSH) instead of FTP when possible
   - Verify server host keys
   - Use strong encryption algorithms

## License

MIT License - See LICENSE file for details
