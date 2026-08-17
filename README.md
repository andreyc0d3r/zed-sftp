# SFTP Extension for Zed

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zed Extension](https://img.shields.io/badge/Zed-Extension-blue)](https://zed.dev)

This is a Zed extension for SFTP/FTP file synchronization, inspired by the popular [vscode-sftp](https://github.com/Natizyskunk/vscode-sftp) extension.

## ✨ Features

- **Upload on Save** - Automatically upload files when you save them
- **Manual Upload/Download** - Upload or download files and folders on demand
- **Sync Folders** - Synchronize entire directories between local and remote
- **Multiple Profiles** - Support for multiple server configurations
- **Ignore Patterns** - Exclude files and folders from sync (like .git, node_modules)
- **SSH Agent Authentication** - Use keys loaded into `ssh-agent` without storing passphrases
- **SSH Key Authentication** - Secure authentication with SSH keys
- **Password Authentication** - Support for password-based authentication

## 🚀 How It Works

This extension uses a **Language Server Protocol (LSP)** approach to watch for file changes and trigger uploads. When you save a file in Zed, the language server detects the save event and automatically uploads the file to your configured SFTP server.

The language server is written in Node.js/TypeScript and uses the `ssh2-sftp-client` library for SFTP operations, providing the same functionality as vscode-sftp.

## 📦 Installation

### Prerequisites

1. **Rust** - Required to compile the extension to WebAssembly
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   # After installation, add WebAssembly target:
   rustup target add wasm32-wasip1
   ```

2. **Node.js** - Required for the language server (v18 or later)
   ```bash
   brew install node  # macOS
   # Or download from https://nodejs.org/
   ```

3. **Zed Editor** - Latest version recommended

### Install Extension

1. Open Zed
2. Open Extensions view: `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Linux/Windows)
3. Search for "SFTP"
4. Click "Install"

Or install as dev extension:

```bash
# Clone the repository
git clone https://github.com/andreyc0d3r/zed-sftp
cd zed-sftp

# Run setup script (checks dependencies and builds)
./setup.sh

# Or build manually:
cd server && npm install && npm run build && cd ..
cargo build --release

# Install in Zed: Extensions > Install Dev Extension > Select this directory
```

## ⚙️ Configuration

Create a `.zed/sftp.json` file in your project root. The file supports JSONC comments and trailing commas:

```json
{
  "name": "My Server",
  "protocol": "sftp",
  "host": "example.com",
  "port": 22,
  "username": "user",
  "remotePath": "/var/www/html",
  "uploadOnSave": true,
  "ignore": [
    ".git",
    "node_modules",
    ".zed"
  ]
}
```

### Authentication Options

**SSH Agent (Recommended):**

Load the key into your SSH agent before opening Zed:

```bash
ssh-add ~/.ssh/id_ed25519
ssh-add -l
```

Then reference the agent in your configuration:

```json
{
  "username": "user",
  "agent": "$SSH_AUTH_SOCK"
}
```

`$SSH_AUTH_SOCK` is resolved from Zed's environment when the connection is opened. The private key and its passphrase are never stored in the SFTP configuration. If the socket changes, restart Zed or reload the extension so the language server receives the updated environment.

An explicit agent socket path is also supported. Windows users can set `"agent": "pageant"` when authenticating with Pageant.

**Direct SSH Key:**

```json
{
  "username": "user",
  "privateKeyPath": "~/.ssh/id_rsa",
  "passphrase": "optional-passphrase"
}
```

**Password:**
```json
{
  "username": "user",
  "password": "your-password"
}
```

### Multiple Profiles

```json
{
  "username": "deploy",
  "privateKeyPath": "~/.ssh/id_rsa",
  "profiles": {
    "dev": {
      "host": "dev.example.com",
      "remotePath": "/var/www/dev"
    },
    "production": {
      "host": "prod.example.com",
      "remotePath": "/var/www/html"
    }
  },
  "defaultProfile": "dev"
}
```

### Using Context Path

The `context` field allows you to specify a subdirectory within your workspace as the root for SFTP operations. This is useful for projects where only a specific folder should be synced.

**Example: WordPress Development**

```json
{
  "context": "site/wp-content/",
  "protocol": "sftp",
  "host": "example.com",
  "port": 2222,
  "username": "deploy",
  "remotePath": "/wp-content/",
  "uploadOnSave": true,
  "privateKeyPath": "~/.ssh/id_rsa"
}
```

With this configuration:
- **Local**: `site/wp-content/themes/style.css` (in your workspace)
- **Remote**: `/wp-content/themes/style.css` (on the server)

Files outside the `site/wp-content/` directory will be ignored and won't be uploaded.

## 🚀 Usage

### Automatic Upload on Save

Once configured with `"uploadOnSave": true`, files will automatically upload when you save them in Zed.

### Manual Commands

With a project file open, use `editor: toggle code actions` (`Cmd+.` / `Ctrl+.`) and select:

- **SFTP: Upload File** - Upload current file
- **SFTP: Download File** - Download current file
- **SFTP: Upload Current Folder** - Upload the current file's folder
- **SFTP: Download Current Folder** - Download the current file's folder
- **SFTP: Sync Workspace** - Sync local workspace to remote
- **SFTP: Reconnect** - Manually restore the connection after a network interruption

Dropped connections are automatically re-established and the interrupted operation is retried once. This includes connections invalidated while the computer is asleep.

Zed extensions cannot currently register arbitrary top-level command-palette actions. The code-action menu invokes the same LSP commands through Zed's supported language-server integration.

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | - | Connection name |
| `protocol` | string | `sftp` | Protocol: `sftp`, `ftp`, or `ftps` |
| `host` | string | **required** | Server hostname |
| `port` | number | `22` | Server port |
| `username` | string | **required** | Username |
| `password` | string | - | Password (not recommended) |
| `privateKeyPath` | string | - | Path to SSH private key |
| `passphrase` | string | - | SSH key passphrase used with `privateKeyPath` |
| `agent` | string | - | `$SSH_AUTH_SOCK`, an explicit agent socket path, or `pageant` |
| `remotePath` | string | **required** | Remote directory path |
| `localPath` | string | workspace | Local directory path |
| `context` | string | - | Local subdirectory to use as root (e.g., `"site/wp-content/"`) |
| `uploadOnSave` | boolean | `false` | Auto-upload on save |
| `ignore` | string[] | `[]` | Ignore patterns (glob) |
| `concurrency` | number | `4` | Max concurrent transfers |
| `connectTimeout` | number | `10000` | Connection timeout (ms) |
| `keepalive` | number | `0` | SSH keepalive interval in milliseconds (`0` disables keepalives) |

## 📚 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - How the extension works
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Development guide
- **[RELEASING.md](RELEASING.md)** - npm and Zed registry release checklist
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - How to contribute
- **[examples/](examples/)** - Configuration examples

## 🔧 Troubleshooting

### Extension Not Working

1. **Check Node.js is installed**:
   ```bash
   node --version  # Should be v18 or later
   ```

2. **Check Zed logs**:
   - Open command palette: `Cmd+Shift+P`
   - Run: "zed: open log"
   - Look for SFTP-related errors

3. **Verify configuration**:
   - Ensure `.zed/sftp.json` exists
   - Check JSON syntax is valid
   - Verify credentials are correct

### Connection Issues

1. **Test SSH connection**:
   ```bash
   ssh user@host
   ```

2. **Check SSH key**:
   ```bash
   ssh-add -l  # List loaded keys
   ssh-add ~/.ssh/id_rsa  # Add key if needed
   ```

3. **Verify remote path**:
   ```bash
   sftp user@host
   cd /remote/path  # Should work
   ```

### Files Not Uploading

1. Check `uploadOnSave` is `true` in config
2. Verify file is not in `ignore` patterns
3. Check file permissions on remote server
4. Look for errors in Zed log

## 🎯 Comparison with vscode-sftp

| Feature | vscode-sftp | zed-sftp | Status |
|---------|-------------|----------|--------|
| Upload on Save | ✅ | ✅ | Implemented |
| Download Files | ✅ | ✅ | Implemented |
| Sync Folders | ✅ | ✅ | Implemented |
| SSH Agent | ✅ | ✅ | Implemented |
| SSH Keys | ✅ | ✅ | Implemented |
| Password Auth | ✅ | ✅ | Implemented |
| Multiple Profiles | ✅ | ✅ | Implemented |
| Ignore Patterns | ✅ | ✅ | Implemented |
| Remote Explorer | ✅ | ❌ | Planned |
| Diff with Remote | ✅ | ❌ | Planned |
| FTP/FTPS | ✅ | ❌ | Planned |
| File Watcher | ✅ | ⚠️ | Partial (save only) |

## Alternative Solutions (If This Doesn't Work)

If you need SFTP functionality and this extension doesn't work for you:

### 1. Use External Tools

You can use command-line SFTP tools alongside Zed:

- **rsync** - For syncing directories
  ```bash
  rsync -avz --exclude='.git' /local/path/ user@host:/remote/path/
  ```

- **lftp** - For FTP/SFTP operations
  ```bash
  lftp sftp://user@host -e "mirror -R /local/path /remote/path; quit"
  ```

- **sshfs** - Mount remote directory locally
  ```bash
  sshfs user@host:/remote/path /local/mount/point
  ```

### 2. Use Zed Tasks

You can configure Zed tasks to run sync commands. Create a `.zed/tasks.json`:

```json
[
  {
    "label": "Upload to Server",
    "command": "rsync",
    "args": ["-avz", "--exclude='.git'", ".", "user@host:/remote/path/"]
  },
  {
    "label": "Download from Server",
    "command": "rsync",
    "args": ["-avz", "user@host:/remote/path/", "."]
  }
]
```

### 3. Use Git-based Deployment

If your remote server supports Git:

```bash
# On your local machine
git push production main

# On the server (post-receive hook)
git --work-tree=/var/www/html --git-dir=/var/repo/site.git checkout -f
```

### 4. File Watchers with Scripts

Use file watchers like `watchman` or `fswatch` to automatically sync on save:

```bash
# Install fswatch
brew install fswatch  # macOS
apt-get install fswatch  # Linux

# Watch and sync
fswatch -o . | xargs -n1 -I{} rsync -avz . user@host:/remote/path/
```

## Configuration Format (Future)

When Zed supports file system extensions, the configuration might look like:

```json
{
  "name": "My Server",
  "protocol": "sftp",
  "host": "example.com",
  "port": 22,
  "username": "user",
  "remotePath": "/var/www/html",
  "uploadOnSave": true,
  "ignore": [
    ".git",
    ".vscode",
    "node_modules"
  ]
}
```

## Features from vscode-sftp That Would Be Implemented

- ✅ SFTP/FTP/FTPS protocols
- ✅ Upload on save
- ✅ Download files/folders
- ✅ Upload files/folders
- ✅ Sync local to remote
- ✅ Sync remote to local
- ✅ Diff with remote
- ✅ Multiple profiles
- ✅ SSH key authentication
- ✅ Connection hopping (proxy)
- ✅ File watcher
- ✅ Ignore patterns

## Development

To develop this extension locally:

1. Install Rust via rustup:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Clone this repository:
   ```bash
   git clone https://github.com/andreyc0d3r/zed-sftp
   cd zed-sftp
   ```

3. Install as dev extension in Zed:
   - Open Zed
   - Open the Extensions view (Cmd+Shift+X)
   - Click "Install Dev Extension"
   - Select this directory

## Contributing

Contributions are welcome! However, please note that significant functionality will require updates to Zed's extension API itself.

If you're interested in helping:

1. Monitor Zed's extension API development
2. Contribute to Zed core to add file system extension support
3. Help design the API for file system operations

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/andreyc0d3r/zed-sftp
cd zed-sftp
./build.sh
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed development instructions.

## 📝 Changelog

### v0.1.0 (Initial Release)

- ✅ Upload on save functionality
- ✅ Manual upload/download commands
- ✅ Folder sync operations
- ✅ SSH key authentication
- ✅ Password authentication
- ✅ Multiple profiles support
- ✅ Ignore patterns
- ✅ Configuration via `.zed/sftp.json`

## 🗺️ Roadmap

- [ ] Remote file explorer
- [ ] Diff with remote files
- [ ] FTP/FTPS protocol support
- [ ] File system watcher (beyond save events)
- [ ] Progress indicators
- [ ] Conflict resolution
- [ ] Transfer queue
- [ ] Bandwidth throttling

## 📚 Resources

- [Zed Extension Documentation](https://zed.dev/docs/extensions)
- [Zed Extension API](https://docs.rs/zed_extension_api/)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [ssh2-sftp-client](https://github.com/theophilusx/ssh2-sftp-client)
- [Original vscode-sftp](https://github.com/Natizyskunk/vscode-sftp)

## ⭐ Show Your Support

If you find this extension useful, please:
- ⭐ Star this repository
- 🐛 Report bugs and issues
- 💡 Suggest new features
- 🤝 Contribute code or documentation

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

- **Natizyskunk** - For the excellent [vscode-sftp](https://github.com/Natizyskunk/vscode-sftp) extension that inspired this project
- **Zed Team** - For building an amazing editor and extension system
- **Contributors** - Everyone who helps improve this extension

---

**Made with ❤️ for the Zed community**
