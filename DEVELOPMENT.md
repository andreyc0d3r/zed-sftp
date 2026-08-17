# Development Guide

## Getting Started

### Prerequisites

1. **Rust** (1.70+)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js** (v18+)
   ```bash
   # macOS
   brew install node
   
   # Or use nvm
   nvm install 18
   ```

3. **Zed Editor**
   - Download from [zed.dev](https://zed.dev)

### Clone and Build

```bash
# Clone repository
git clone https://github.com/andreyc0d3r/zed-sftp
cd zed-sftp

# Build everything
./build.sh

# Or build manually:

# 1. Build language server
cd server
npm install
npm run build
cd ..

# 2. Build Rust extension
cargo build --release
```

### Install as Dev Extension

1. Open Zed
2. Open Extensions: `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Linux/Windows)
3. Click "Install Dev Extension"
4. Select the `zed-sftp` directory
5. Restart Zed if needed

## Project Structure

```
zed-sftp/
├── src/
│   └── lib.rs              # Rust extension entry point
├── server/
│   ├── src/
│   │   ├── index.ts        # Language server main
│   │   ├── sftp-client.ts  # SFTP operations
│   │   └── config.ts       # Configuration management
│   ├── package.json        # Node.js dependencies
│   └── tsconfig.json       # TypeScript config
├── examples/               # Example configurations
├── extension.toml          # Extension manifest
├── Cargo.toml             # Rust dependencies
├── build.sh               # Build script
└── README.md              # Documentation
```

## Development Workflow

### 1. Make Changes

Edit files in `src/` (Rust) or `server/src/` (TypeScript).

### 2. Build

```bash
# Rebuild language server
cd server && npm run build && cd ..

# Rebuild Rust extension
cargo build --release
```

Or use watch mode for TypeScript:

```bash
cd server
npm run watch
```

### 3. Test

Reload the extension in Zed:
- `Cmd+Shift+P` → "zed: reload extensions"

Or restart Zed.

### 4. Debug

**View Logs:**
```bash
# Open Zed log
Cmd+Shift+P → "zed: open log"

# Or tail the log file
tail -f ~/Library/Logs/Zed/Zed.log  # macOS
tail -f ~/.local/share/zed/logs/Zed.log  # Linux
```

**Language Server Logs:**

The language server logs to Zed's console. Look for lines containing "SFTP".

**Add Debug Logging:**

In TypeScript:
```typescript
connection.console.log('Debug message');
connection.console.error('Error message');
```

In Rust:
```rust
eprintln!("Debug: {:?}", value);
```

## Testing

### Manual Testing

1. Create a test project:
   ```bash
   mkdir test-project
   cd test-project
   ```

2. Create `.zed/sftp.json`:
   ```json
   {
     "host": "localhost",
     "port": 2222,
     "username": "test",
     "password": "test",
     "remotePath": "/upload",
     "uploadOnSave": true
   }
   ```

3. Open in Zed:
   ```bash
   zed .
   ```

4. Create and save a file - it should upload automatically

### Test SFTP Server

Use Docker to run a test SFTP server:

```bash
docker run -p 2222:22 -d atmoz/sftp test:test:::upload
```

This creates:
- Host: localhost
- Port: 2222
- Username: test
- Password: test
- Upload directory: /upload

### Unit Tests

**TypeScript:**
```bash
cd server
npm test
```

**Rust:**
```bash
cargo test
```

## Common Issues

### Extension Not Loading

1. Check Zed log for errors
2. Verify build completed successfully
3. Try reinstalling the extension
4. Restart Zed

### Language Server Not Starting

1. Check Node.js is installed: `node --version`
2. Verify server build: `ls server/dist/index.js`
3. Check Zed log for Node.js errors
4. Try rebuilding: `cd server && npm run build`

### SFTP Connection Fails

1. Verify server is reachable: `ssh user@host`
2. Check credentials in `.zed/sftp.json`
3. Look for connection errors in Zed log
4. Try connecting with `sftp` command line tool

### Files Not Uploading

1. Check `uploadOnSave` is `true`
2. Verify file is not in ignore patterns
3. Check Zed log for upload errors
4. Verify remote path exists and is writable

## Code Style

### TypeScript

Follow standard TypeScript conventions:

```typescript
// Use async/await
async function uploadFile(path: string): Promise<void> {
  await client.put(path, remotePath);
}

// Use interfaces for types
interface Config {
  host: string;
  port: number;
}

// Use descriptive names
const remoteFilePath = getRemotePath(localFilePath);
```

Format with Prettier:
```bash
cd server
npm run format
```

### Rust

Follow Rust conventions:

```rust
// Use Result for error handling
fn load_config() -> Result<Config> {
    // ...
}

// Use descriptive names
let server_path = self.server_script_path(worktree)?;

// Use ? operator for error propagation
let config = config_manager.load_config()?;
```

Format with rustfmt:
```bash
cargo fmt
```

Lint with clippy:
```bash
cargo clippy
```

## Adding Features

### Add a New Command

1. **Register the command ID** (`server/src/commands.ts`).

2. **Expose a code action** (`server/src/commands.ts`) so users can invoke it from Zed.

3. **Handle it in the language server** (`server/src/index.ts`):
   ```typescript
   connection.onExecuteCommand(async (params) => {
     switch (params.command) {
       case 'sftp.myNewCommand':
         await handleMyNewCommand(params.arguments);
         break;
     }
   });
   ```

4. **Implement the operation**:
   ```typescript
   async function handleMyNewCommand(args: any[]) {
     // Implementation
   }
   ```

5. **Update tests and README** with the new action

### Add Configuration Option

1. **Update interface** (`server/src/config.ts`):
   ```typescript
   export interface SftpConfig {
     // ... existing options
     myNewOption?: boolean;
   }
   ```

2. **Use in code**:
   ```typescript
   if (config.myNewOption) {
     // Do something
   }
   ```

3. **Update documentation** with new option

### Add SFTP Operation

1. **Add method to SftpClient** (`server/src/sftp-client.ts`):
   ```typescript
   async myOperation(path: string): Promise<void> {
     await this.connect();
     // Implementation
   }
   ```

2. **Call from command handler**:
   ```typescript
   await sftpClient.myOperation(filePath);
   ```

## Performance Tips

1. **Reuse Connections**
   - Keep SFTP connection open
   - Reconnect only on errors

2. **Batch Operations**
   - Upload multiple files in parallel
   - Use concurrency limits

3. **Optimize Ignore Patterns**
   - Skip unnecessary files early
   - Use efficient glob patterns

4. **Cache Configuration**
   - Load config once
   - Reload only on changes

## Security Best Practices

1. **Prefer SSH Agent Authentication**
   - Use `"agent": "$SSH_AUTH_SOCK"` for encrypted private keys
   - Do not store a private-key passphrase in project configuration when an agent is available

2. **Never Log Passwords**
   ```typescript
   // Bad
   console.log(`Config: ${JSON.stringify(config)}`);
   
   // Good
   console.log(`Connected to ${config.host}`);
   ```

3. **Validate Input**
   ```typescript
   if (!config.host || !config.username) {
     throw new Error('Invalid configuration');
   }
   ```

4. **Handle Errors Safely**
   ```typescript
   try {
     await client.connect(config);
   } catch (error) {
     // Don't expose sensitive details
     throw new Error('Connection failed');
   }
   ```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Release Process

Follow [RELEASING.md](RELEASING.md). A server change is not released by pushing this repository because installed extensions run the latest published `zed-sftp-server` npm package.

The minimum release sequence is:

1. Update the server, extension, and changelog versions.
2. Run the full server tests and npm package dry run.
3. Publish and publicly verify the npm package.
4. Commit and push the source release.
5. Update the Zed registry version and SFTP submodule commit.
6. Verify the registry PR and only then notify affected users.

## Resources

- [Zed Extension Docs](https://zed.dev/docs/extensions)
- [Zed Extension API](https://docs.rs/zed_extension_api/)
- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [ssh2-sftp-client](https://github.com/theophilusx/ssh2-sftp-client)
- [vscode-sftp](https://github.com/Natizyskunk/vscode-sftp)

## Getting Help

- Open an issue on GitHub
- Check existing issues and discussions
- Join Zed Discord
- Read the documentation

## License

MIT License - See LICENSE file
