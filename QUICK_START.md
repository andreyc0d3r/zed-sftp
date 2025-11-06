# Quick Start Guide

Get SFTP working in Zed in 5 minutes!

## Step 1: Install the Extension

### Option A: From Zed Extensions (when published)

1. Open Zed
2. Press `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Linux/Windows)
3. Search for "SFTP"
4. Click "Install"

### Option B: As Dev Extension (for now)

**Prerequisites:**
- Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Node.js: `brew install node` or from [nodejs.org](https://nodejs.org/)

```bash
# Clone the repository
git clone https://github.com/andreyc0d3r/zed-sftp
cd zed-sftp

# Run setup (checks dependencies and builds everything)
./setup.sh

# Install in Zed:
# 1. Open Zed
# 2. Press Cmd+Shift+X
# 3. Click "Install Dev Extension"
# 4. Select the zed-sftp directory
```

## Step 2: Configure SFTP

Create `.zed/sftp.json` in your project root:

```json
{
  "host": "your-server.com",
  "port": 22,
  "username": "your-username",
  "privateKeyPath": "~/.ssh/id_rsa",
  "remotePath": "/var/www/html",
  "uploadOnSave": true,
  "ignore": [
    ".git",
    "node_modules",
    ".zed"
  ]
}
```

### Common Configurations

#### SSH Key (Recommended)

```json
{
  "host": "example.com",
  "username": "deploy",
  "privateKeyPath": "~/.ssh/id_rsa",
  "remotePath": "/var/www/html",
  "uploadOnSave": true
}
```

#### Password (Less Secure)

```json
{
  "host": "example.com",
  "username": "deploy",
  "password": "your-password",
  "remotePath": "/var/www/html",
  "uploadOnSave": true
}
```

#### Multiple Servers

```json
{
  "username": "deploy",
  "privateKeyPath": "~/.ssh/id_rsa",
  "profiles": {
    "dev": {
      "host": "dev.example.com",
      "remotePath": "/var/www/dev"
    },
    "staging": {
      "host": "staging.example.com",
      "remotePath": "/var/www/staging"
    },
    "production": {
      "host": "prod.example.com",
      "remotePath": "/var/www/html"
    }
  },
  "defaultProfile": "dev",
  "uploadOnSave": true
}
```

## Step 3: Test It!

1. Open your project in Zed
2. Create or edit a file
3. Save it (`Cmd+S` or `Ctrl+S`)
4. Watch the notification - your file is uploaded! 🎉

## Step 4: Use Commands

Open command palette (`Cmd+Shift+P` or `Ctrl+Shift+P`) and try:

- **SFTP: Upload File** - Upload current file
- **SFTP: Download File** - Download from server
- **SFTP: Sync** - Sync entire project
- **SFTP: Upload Folder** - Upload a folder
- **SFTP: Download Folder** - Download a folder

## Troubleshooting

### Extension Not Working?

1. **Check Node.js**:
   ```bash
   node --version  # Should be v18+
   ```

2. **Check Zed Log**:
   - Press `Cmd+Shift+P`
   - Type "zed: open log"
   - Look for SFTP errors

3. **Verify Config**:
   - Check `.zed/sftp.json` exists
   - Verify JSON is valid
   - Test SSH connection manually

### Can't Connect?

1. **Test SSH**:
   ```bash
   ssh user@host
   ```

2. **Check SSH Key**:
   ```bash
   ssh-add -l  # List keys
   ssh-add ~/.ssh/id_rsa  # Add key
   ```

3. **Verify Permissions**:
   ```bash
   chmod 600 ~/.ssh/id_rsa
   chmod 700 ~/.ssh
   ```

### Files Not Uploading?

1. Check `uploadOnSave` is `true`
2. Check file is not in `ignore` list
3. Check remote path exists
4. Check you have write permissions

## Configuration Reference

### Required Options

| Option | Type | Description |
|--------|------|-------------|
| `host` | string | Server hostname or IP |
| `username` | string | SSH username |
| `remotePath` | string | Remote directory path |

### Authentication (choose one)

| Option | Type | Description |
|--------|------|-------------|
| `privateKeyPath` | string | Path to SSH private key |
| `password` | string | SSH password |

### Optional Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | number | `22` | SSH port |
| `uploadOnSave` | boolean | `false` | Auto-upload on save |
| `ignore` | string[] | `[]` | Files to ignore (glob) |
| `localPath` | string | workspace | Local directory |
| `concurrency` | number | `4` | Max concurrent uploads |
| `connectTimeout` | number | `10000` | Connection timeout (ms) |

## Examples

### WordPress Development

```json
{
  "host": "wordpress-server.com",
  "username": "wp-admin",
  "privateKeyPath": "~/.ssh/id_rsa",
  "remotePath": "/var/www/wordpress/wp-content/themes/my-theme",
  "uploadOnSave": true,
  "ignore": [
    ".git",
    "node_modules",
    ".sass-cache",
    "*.map"
  ]
}
```

### Node.js Application

```json
{
  "host": "app-server.com",
  "username": "node",
  "privateKeyPath": "~/.ssh/id_rsa",
  "remotePath": "/home/node/app",
  "uploadOnSave": true,
  "ignore": [
    ".git",
    "node_modules",
    ".env",
    "*.log",
    "dist"
  ]
}
```

### Static Website

```json
{
  "host": "web-server.com",
  "username": "www-data",
  "privateKeyPath": "~/.ssh/id_rsa",
  "remotePath": "/var/www/html",
  "uploadOnSave": true,
  "ignore": [
    ".git",
    "node_modules",
    "src",
    "*.scss"
  ]
}
```

## Tips & Tricks

### 1. Use SSH Config

Add to `~/.ssh/config`:

```
Host myserver
    HostName example.com
    User deploy
    IdentityFile ~/.ssh/id_rsa
    Port 22
```

Then in `.zed/sftp.json`:

```json
{
  "host": "myserver",
  "username": "deploy",
  "privateKeyPath": "~/.ssh/id_rsa",
  "remotePath": "/var/www/html",
  "uploadOnSave": true
}
```

### 2. Ignore Build Artifacts

```json
{
  "ignore": [
    ".git",
    "node_modules",
    "dist",
    "build",
    "*.log",
    ".DS_Store",
    "Thumbs.db"
  ]
}
```

### 3. Use Environment Variables

Store sensitive data in environment variables:

```bash
export SFTP_PASSWORD="your-password"
```

### 4. Test Connection First

Before using the extension, test your SSH connection:

```bash
ssh user@host
# If this works, the extension should work too
```

### 5. Check Logs

Always check Zed logs when troubleshooting:

```bash
# macOS
tail -f ~/Library/Logs/Zed/Zed.log

# Linux
tail -f ~/.local/share/zed/logs/Zed.log
```

## Next Steps

- Read [README.md](README.md) for full documentation
- Check [ARCHITECTURE.md](ARCHITECTURE.md) to understand how it works
- See [DEVELOPMENT.md](DEVELOPMENT.md) if you want to contribute
- Browse [examples/](examples/) for more configuration examples

## Getting Help

- 🐛 [Report a bug](https://github.com/andreyc0d3r/zed-sftp/issues)
- 💡 [Request a feature](https://github.com/andreyc0d3r/zed-sftp/issues)
- 💬 [Ask a question](https://github.com/andreyc0d3r/zed-sftp/discussions)
- 📖 [Read the docs](README.md)

---

**Happy coding with Zed + SFTP!** 🚀

