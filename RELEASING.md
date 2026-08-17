# Release Guide

## Delivery Model

The extension has two separately delivered parts:

1. `extension.toml`, `Cargo.toml`, and `src/lib.rs` define the Rust Zed extension.
2. `server/` is published separately as `zed-sftp-server` on npm.

Installed extensions run `node_modules/zed-sftp-server/dist/index.js`. They do not run the checked-in `server/dist/index.js` directly. Pushing a server fix to this repository is therefore not a release.

The Rust extension checks npm when the language server starts and installs the current npm `latest` version. After a server release, users must restart Zed or reload the extension once to trigger that check.

## Hard Release Gate

Do not claim that a fix is available in an installed version until all applicable delivery steps are complete and publicly verified:

- The fixed server package is published on npm.
- npm `latest` resolves to that package version.
- The extension release commit is pushed.
- The Zed registry entry uses the intended extension version and exact source commit.

If only the source repository contains the fix, describe it as unreleased.

## Version Changes

For a language-server release:

- Increment `server/package.json` and the root package entries in `server/package-lock.json`.
- Increment `extension.toml` and `Cargo.toml` when publishing a corresponding extension release.
- Move the changelog items into a dated release section and update comparison links.
- Keep the extension version in the Zed registry entry synchronized with `extension.toml`.

## Validation

Run the smallest regression tests first, followed by the complete checks:

```bash
cd server
npm test
npm pack --dry-run --json --cache /private/tmp/zed-sftp-npm-cache
cd ..
cargo build --target wasm32-wasip1 --release
bash verify-build.sh
git diff --check
```

Confirm that the npm dry run includes the generated `dist` files containing the fix. If Cargo is unavailable, report that limitation and do not claim a fresh WASM build passed.

## Publishing Order

Publishing and pushing require explicit user approval.

1. Confirm the intended versions and final diff.
2. Publish from `server/`:

   ```bash
   npm publish --access public --cache /private/tmp/zed-sftp-npm-cache
   ```

3. Verify the public package before proceeding:

   ```bash
   npm view zed-sftp-server version dist.shasum dist-tags --json \
     --cache /private/tmp/zed-sftp-npm-cache
   ```

4. Confirm that `dist-tags.latest` is the new version and that the public shasum matches the package dry run.
5. Commit and push the source release.
6. Update the SFTP entry in the `zed-industries/extensions` registry branch or open PR:
   - Set the `[sftp]` version in `extensions.toml` to the new `extension.toml` version.
   - Point the `extensions/sftp` submodule to the exact pushed release commit.
   - Update the registry PR description so it names the correct extension and npm versions.
7. Verify the registry PR head, diff, and checks.
8. Notify affected users only after these checks succeed.

## User Notification

A release notification should distinguish the extension version from the npm server version and include the required restart:

> The fix is published in `zed-sftp-server` version X and extension version Y. Restart Zed or reload the extension once so it downloads the new server package, then retry the reported behavior.

If the registry PR is not merged yet, say so explicitly. Existing installations may still receive a server-only fix through npm after restart, but a new extension version is not marketplace-available until the registry update is merged.

## Failure Handling

- If npm publishing fails, do not describe the fix as released.
- If npm succeeds but the source or registry update is pending, state exactly which delivery step remains.
- If a user still reproduces the issue after the verified release, first confirm the installed npm server version or collect the surrounding SFTP log lines before changing reconnect logic again.
