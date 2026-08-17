# Troubleshooting Guide

## "Failed to compile Rust extension" Error

This error means Zed couldn't compile the extension. Here are the solutions:

### Solution 1: Build for WebAssembly (Most Common)

Zed extensions must be compiled to **WebAssembly (WASM)**, not native code.

```bash
# Install the WebAssembly target
rustup target add wasm32-wasip1

# Build for WebAssembly
cargo build --target wasm32-wasip1 --release

# Or use the build script
./build.sh
```

**Verify the build:**
```bash
./verify-build.sh
```

You should see:
- ✅ `target/wasm32-wasip1/release/sftp.wasm` exists
- ✅ `server/dist/index.js` exists

### Solution 2: Ensure Rust is in PATH

If you just installed Rust, you need to add it to your PATH:

```bash
# Add to current shell
source $HOME/.cargo/env

# Or restart your terminal
```

### Solution 3: Clean and Rebuild

Sometimes cached builds cause issues:

```bash
# Clean everything
cargo clean
rm -rf server/node_modules server/dist

# Rebuild
./setup.sh
```

### Solution 4: Check Rust Version

Ensure you have a recent Rust version:

```bash
rustc --version  # Should be 1.70+
```

If outdated:
```bash
rustup update
```

## "Language server not starting" Error

### Check Node.js

```bash
node --version  # Should be v18+
```

### Check Server Build

```bash
ls -la server/dist/index.js
```

If missing:
```bash
cd server
npm install
npm run build
cd ..
```

### Check Zed Logs

1. Open Zed
2. Press `Cmd+Shift+P`
3. Type "zed: open log"
4. Look for SFTP-related errors

## "Connection failed" Error

### Test SSH Connection

```bash
ssh user@host
```

If this fails, fix your SSH setup first.

### Check SSH Key

```bash
# List loaded keys
ssh-add -l

# Add your key
ssh-add ~/.ssh/id_rsa

# Check key permissions
chmod 600 ~/.ssh/id_rsa
chmod 700 ~/.ssh
```

For SSH agent authentication, confirm that `SSH_AUTH_SOCK` is available in the environment used to launch Zed:

```bash
echo "$SSH_AUTH_SOCK"
ssh-add -l
```

If you start a new agent or change its socket, restart Zed or reload the extension before retrying.

### Verify Configuration

Check `.zed/sftp.json`:

```json
{
  "host": "example.com",
  "username": "user",
  "agent": "$SSH_AUTH_SOCK",
  "remotePath": "/var/www/html",
  "uploadOnSave": true
}
```

Common mistakes:
- ❌ Wrong host/username
- ❌ Wrong key path
- ❌ Remote path doesn't exist
- ❌ No write permissions

## "Files not uploading" Error

### Check uploadOnSave

Ensure `"uploadOnSave": true` in `.zed/sftp.json`

### Check Ignore Patterns

File might be ignored:

```json
{
  "ignore": [
    ".git",
    "node_modules"
  ]
}
```

### Check Remote Path

Ensure remote directory exists and is writable:

```bash
ssh user@host
cd /var/www/html  # Should work
touch test.txt    # Should work
rm test.txt
```

### Check Zed Logs

Look for upload errors in Zed logs.

## Extension Not Appearing in Zed

### Verify Installation

1. Open Zed
2. Press `Cmd+Shift+X`
3. Look for "SFTP" in installed extensions

### Reinstall

1. Remove the extension
2. Restart Zed
3. Install again

### Check Extension Files

```bash
./verify-build.sh
```

All checks should pass.

## TypeScript Compilation Errors

### Clean and Rebuild

```bash
cd server
rm -rf node_modules dist
npm install
npm run build
cd ..
```

### Check Node Version

```bash
node --version  # Should be v18+
npm --version   # Should be 9+
```

## Rust Compilation Errors

### Update Dependencies

```bash
cargo update
cargo build --target wasm32-wasip1 --release
```

### Check for API Changes

The `zed_extension_api` might have changed. Check the version in `Cargo.toml`:

```toml
[dependencies]
zed_extension_api = "0.2.0"
```

Try updating to latest:
```bash
cargo update zed_extension_api
```

## Performance Issues

### Slow Uploads

1. **Check Network**:
   ```bash
   ping your-server.com
   ```

2. **Reduce Concurrency**:
   ```json
   {
     "concurrency": 2
   }
   ```

3. **Check Server Load**:
   ```bash
   ssh user@host
   top
   ```

### High CPU Usage

1. Check ignore patterns - might be watching too many files
2. Reduce file watching scope
3. Check Zed logs for errors

## Getting Help

### Check Logs

Always check Zed logs first:
```
Cmd+Shift+P → "zed: open log"
```

### Verify Build

```bash
./verify-build.sh
```

### Test Components

1. **Test SSH**:
   ```bash
   ssh user@host
   ```

2. **Test SFTP**:
   ```bash
   sftp user@host
   ```

3. **Test Node.js**:
   ```bash
   node server/dist/index.js --stdio
   ```

### Report Issues

When reporting issues, include:

1. **Zed version**: Help → About Zed
2. **OS version**: `uname -a`
3. **Rust version**: `rustc --version`
4. **Node version**: `node --version`
5. **Build output**: `./verify-build.sh`
6. **Zed logs**: Relevant error messages
7. **Configuration**: Your `.zed/sftp.json` (remove passwords!)

## Common Solutions Summary

| Problem | Solution |
|---------|----------|
| Failed to compile | Build for WASM: `cargo build --target wasm32-wasip1 --release` |
| Rust not found | `source $HOME/.cargo/env` or restart terminal |
| Server not starting | `cd server && npm install && npm run build` |
| Connection failed | Test SSH: `ssh user@host` |
| Files not uploading | Check `uploadOnSave: true` and ignore patterns |
| Extension not appearing | Run `./verify-build.sh` and reinstall |

## Still Having Issues?

1. Clean everything and rebuild:
   ```bash
   cargo clean
   rm -rf server/node_modules server/dist
   ./setup.sh
   ```

2. Check GitHub issues: https://github.com/andreyc0d3r/zed-sftp/issues

3. Open a new issue with:
   - Error message
   - Build output
   - Zed logs
   - Configuration (sanitized)
