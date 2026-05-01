# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Overview

This is an SFTP extension for Zed Editor that provides automatic upload-on-save functionality. It uses a **two-tier architecture**: a Rust WASM extension that integrates with Zed, and a Node.js/TypeScript Language Server Protocol (LSP) server that handles SFTP operations.

## Build Commands

```bash
# First-time setup (checks dependencies, installs, builds everything)
./setup.sh

# Quick rebuild (assumes dependencies installed)
./build.sh

# Verify build artifacts exist
./verify-build.sh

# Watch mode for server development
cd server && npm run watch

# Clean rebuild
cargo clean && rm -rf server/node_modules server/dist && ./setup.sh
```

### Build Requirements
- Rust with `wasm32-wasip1` target
- Node.js v18+ 
- Build outputs: `target/wasm32-wasip1/release/sftp.wasm` and `server/dist/index.js`

## Architecture

### Two-Tier Design

```
Zed Editor (LSP events: didSave, commands)
    ↓
Rust Extension (src/lib.rs) - Spawns and manages Node.js server
    ↓
Node.js Language Server (server/src/) - Handles SFTP operations
    ↓
Remote SFTP Server
```

### Component Responsibilities

**Rust Extension (`src/lib.rs` - ~45 lines)**
- Implements `zed::Extension` trait
- Provides `language_server_command()` to spawn Node.js server
- Uses `std::env::current_dir()` to find server (Zed runs extensions from their directory)
- Uses `zed::node_binary_path()` to get Zed's bundled Node.js
- Thin wrapper that delegates to Node.js server

**Node.js Language Server (`server/src/`)**
- **`index.ts`** (184 lines) - LSP server main entry point
  - Handles `textDocument/didSave` events for upload-on-save
  - Registers execute commands (upload, download, sync, uploadFolder, downloadFolder)
  - Manages ConfigManager and SftpClient lifecycle
  
- **`sftp-client.ts`** (170 lines) - SFTP operations wrapper
  - Wraps `ssh2-sftp-client` library
  - Manages connection lifecycle (lazy connect, connection reuse)
  - Implements file/folder upload, download, sync operations
  - Handles SSH key and password authentication
  
- **`config.ts`** (185 lines) - Configuration manager
  - Loads `.zed/sftp.json` (falls back to `.vscode/sftp.json`, then `sftp.json`)
  - Implements **context path** feature (maps local subdirectory to remote root)
  - Manages ignore patterns with glob matching via `minimatch`
  - Handles profile selection and merging

### Upload-on-Save Flow

1. User saves file in Zed
2. Zed sends LSP `textDocument/didSave` event
3. `index.ts` receives event
4. `ConfigManager` checks: uploadOnSave enabled? file in context? file ignored?
5. `ConfigManager.getRemotePath()` resolves local path to remote path
6. `SftpClient.connect()` establishes connection (if needed)
7. `SftpClient.uploadFile()` uploads via ssh2-sftp-client
8. Notification shown to user

### Key Architectural Concepts

**Language Server as File Watcher**
- Problem: Zed extensions can't directly watch file system
- Solution: Use LSP's standard `textDocument/didSave` events
- Why it works: LSP is core to Zed, `didSave` events are universal

**Context Path Feature**
- Maps a workspace subdirectory as the sync root
- Example: `"context": "site/wp-content/"` syncs only that subdirectory
- Implementation: `ConfigManager.isInContext()` validates paths, `getRemotePath()` resolves relative to context

**Connection Management**
- Lazy initialization: connects only on first operation
- Connection reuse: maintains `isConnected` flag to avoid reconnecting
- Single connection shared across operations

**Profile System**
- Base configuration merged with selected profile
- Example: shared username/key, different host/path per environment
- Implementation: `{ ...baseConfig, ...profiles[defaultProfile] }`

## Configuration

Configuration loaded from (first found wins):
1. `.zed/sftp.json`
2. `.vscode/sftp.json` (compatibility)
3. `sftp.json` (root)

### Key Configuration Fields

```typescript
{
  // Connection
  "host": "example.com",
  "port": 22,
  "username": "deploy",
  "privateKeyPath": "~/.ssh/id_rsa",  // or "password": "..."
  
  // Paths
  "remotePath": "/var/www/html",
  "context": "site/wp-content/",  // Optional: local subdirectory as root
  
  // Behavior
  "uploadOnSave": true,
  "ignore": [".git", "node_modules", "*.log"],
  
  // Profiles
  "profiles": {
    "dev": { "host": "dev.example.com", "remotePath": "/var/www/dev" },
    "prod": { "host": "prod.example.com", "remotePath": "/var/www/html" }
  },
  "defaultProfile": "dev"
}
```

### Path Resolution with Context

When `context` is set, files outside that subdirectory are ignored:

```
Config: { "context": "site/wp-content/", "remotePath": "/wp-content/" }
Local:  /workspace/site/wp-content/themes/style.css
Remote: /wp-content/themes/style.css

Files outside /workspace/site/wp-content/ are not uploaded.
```

Implementation in `ConfigManager`:
```typescript
isInContext(filePath): boolean {
  return filePath.startsWith(this.contextPath);
}

getRemotePath(localFilePath): string | null {
  if (!this.isInContext(localFilePath)) return null;
  const relativePath = path.relative(this.contextPath, localFilePath);
  return path.posix.join(this.config.remotePath, relativePath);
}
```

## Testing

### Manual Testing Setup

```bash
# 1. Start local SFTP server (Docker)
docker run -p 2222:22 -d atmoz/sftp test:test:::upload

# 2. Create test project
mkdir test-project && cd test-project
mkdir .zed

# 3. Create config
cat > .zed/sftp.json << EOF
{
  "host": "localhost",
  "port": 2222,
  "username": "test",
  "password": "test",
  "remotePath": "/upload",
  "uploadOnSave": true
}
EOF

# 4. Open in Zed
zed .

# 5. Create and save a file - should auto-upload
echo "test" > test.txt  # Save in Zed
```

### Development Workflow

1. Make code changes
2. Run `./build.sh`
3. In Zed: `Cmd+Shift+P` → "zed: reload extensions"
4. Test in a project with `.zed/sftp.json`
5. Check logs: `Cmd+Shift+P` → "zed: open log"

### Debugging

**View logs:**
```bash
# macOS
tail -f ~/Library/Logs/Zed/Zed.log

# Or in Zed: Cmd+Shift+P → "zed: open log"
```

**Test components individually:**
```bash
# Test SFTP connection
sftp user@host

# Test Node.js server
node server/dist/index.js --stdio

# Test builds
cargo build --target wasm32-wasip1 --release
cd server && npm run build
```

### No Automated Tests

The codebase currently has no unit or integration tests. All testing is manual. Testing infrastructure would be a future enhancement.

## Installation Paths

The extension is installed in platform-specific directories:

**macOS:**
```
~/Library/Application Support/Zed/extensions/installed/sftp/
```

**Linux:**
```
~/.local/share/zed/extensions/installed/sftp/
# Or if XDG_DATA_HOME is set:
$XDG_DATA_HOME/zed/extensions/installed/sftp/
```

**Windows:**
```
%USERPROFILE%\AppData\Roaming\Zed\extensions\installed\sftp\
```

**Dev Extension (symlinked):**
The installed path is a symlink to your development directory:
```
[platform-specific path]/sftp/ → /path/to/dev/zed-extensions/sftp/
```

**Installed Extension Structure:**
```
sftp/
├── extension.wasm
├── server/dist/index.js
└── extension.toml
```

**How the Extension Finds the Server:**
Zed runs extensions from their installation directory, so the Rust extension uses `std::env::current_dir()` to locate the server files. This works automatically on all platforms and for both dev and production installations.

## Key Dependencies

**Rust:**
- `zed_extension_api` 0.7.0 - Zed's extension API

**Node.js:**
- `ssh2-sftp-client` ^11.0.0 - Production SFTP client (same as vscode-sftp)
- `vscode-languageserver` ^9.0.1 - LSP server implementation
- `minimatch` ^10.0.1 - Glob pattern matching for ignore rules
- `chokidar` ^4.0.3 - File watcher (not currently used, for future)

## Code Patterns

### Adding New SFTP Commands

1. Register command in `server/src/index.ts`:
```typescript
capabilities: {
  executeCommandProvider: {
    commands: ['sftp.upload', 'sftp.myNewCommand']
  }
}
```

2. Handle command in `onExecuteCommand`:
```typescript
case 'sftp.myNewCommand':
  await sftpClient.myNewOperation();
  connection.window.showInformationMessage('Operation completed');
  break;
```

3. Implement in `SftpClient`:
```typescript
async myNewOperation(): Promise<void> {
  await this.connect();  // Reuse connection
  // ... SFTP operations
}
```

### Path Resolution Pattern

Always use `ConfigManager.getRemotePath()` for path resolution:
```typescript
const remotePath = this.configManager.getRemotePath(localPath);
if (!remotePath) {
  connection.console.warn(`File is outside context path: ${localPath}`);
  return;
}
```

This ensures:
- Context path is respected
- Paths are correctly normalized
- Files outside context are ignored

### Error Handling Pattern

```typescript
try {
  await this.connect();
  // ... SFTP operations
  connection.console.log(`Success: ${message}`);
} catch (error) {
  connection.console.error(`Failed: ${error}`);
  throw new Error(`Operation failed: ${error}`);
}
```

Always:
- Log to LSP console for debugging
- Throw errors to show notifications to user
- Include context in error messages

## Documentation

- **README.md** - User documentation, features, configuration reference
- **ARCHITECTURE.md** - Technical architecture, design decisions, flow diagrams
- **DEVELOPMENT.md** - Development guide, adding features, security practices
- **QUICK_START.md** - 5-minute setup guide
- **TROUBLESHOOTING.md** - Common issues and solutions
- **examples/** - Sample configurations for various scenarios

## Common Modifications

### Adding Configuration Options

1. Add to `SftpConfig` interface in `server/src/config.ts`
2. Load in `ConfigManager.loadConfig()`
3. Use in `SftpClient` or `index.ts`
4. Document in README.md and examples

### Supporting New Authentication Methods

1. Add config fields to `SftpConfig` interface
2. Modify `SftpClient.connect()` to handle new auth type
3. Add example configuration to `examples/`
4. Update README.md authentication section

### Improving Path Handling

All path logic is centralized in `ConfigManager`:
- `isInContext(filePath)` - Check if file should be synced
- `shouldIgnore(filePath)` - Check against ignore patterns
- `getRemotePath(localPath)` - Resolve local to remote path

Modify these methods to change path behavior globally.

## Limitations and Future Enhancements

**Current Limitations:**
- No automated tests
- No remote file explorer (needs Zed UI API)
- No diff with remote (needs Zed diff API)
- FTP/FTPS not implemented (only SFTP)
- File watching only on save (no background watcher)

**Architecture Allows:**
- Adding more SFTP operations (easy)
- Different authentication methods (easy)
- Protocol support (FTP/FTPS - moderate, needs different library)
- Background file watching (moderate, chokidar already included)
- Remote explorer (hard, needs Zed API)
- Diff view (hard, needs Zed API)
