const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { ConfigManager, parseJsonc } = require("../dist/config");

test("parseJsonc accepts comments and trailing commas", () => {
  const config = parseJsonc(`{
    // Connection settings
    "host": "example.com", // Inline comment
    "paths": ["/one", "/two",],
    /* Comment-like text in strings must be preserved. */
    "url": "https://example.com/a/*/b",
  }`);

  assert.deepEqual(config, {
    host: "example.com",
    paths: ["/one", "/two"],
    url: "https://example.com/a/*/b",
  });
});

test("ConfigManager merges a selected profile before validation", async (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "zed-sftp-config-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  fs.mkdirSync(path.join(workspace, ".zed"));
  fs.writeFileSync(
    path.join(workspace, ".zed", "sftp.json"),
    `{
      "username": "deploy",
      "privateKeyPath": "~/.ssh/id_rsa",
      "profiles": {
        "dev": {
          "host": "dev.example.com",
          "remotePath": "/var/www/dev",
        },
      },
      "defaultProfile": "dev",
    }`,
  );

  const manager = new ConfigManager(workspace);
  const config = await manager.loadConfig();

  assert.equal(config.host, "dev.example.com");
  assert.equal(config.remotePath, "/var/www/dev");
  assert.equal(config.protocol, "sftp");
});

test("context checks reject sibling paths with the same prefix", async (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "zed-sftp-context-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  fs.mkdirSync(path.join(workspace, ".zed"));
  fs.writeFileSync(
    path.join(workspace, ".zed", "sftp.json"),
    JSON.stringify({
      host: "example.com",
      username: "deploy",
      password: "secret",
      remotePath: "/remote",
      context: "site",
    }),
  );

  const manager = new ConfigManager(workspace);
  await manager.loadConfig();

  assert.equal(manager.isInContext(path.join(workspace, "site", "index.html")), true);
  assert.equal(manager.isInContext(path.join(workspace, "site-backup", "index.html")), false);
});

test("ignore rules cover directory contents and the loaded config", async (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "zed-sftp-ignore-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));

  fs.mkdirSync(path.join(workspace, ".zed"));
  fs.writeFileSync(
    path.join(workspace, ".zed", "sftp.json"),
    JSON.stringify({
      host: "example.com",
      username: "deploy",
      password: "secret",
      remotePath: "/remote",
      ignore: [".zed"],
    }),
  );

  const manager = new ConfigManager(workspace);
  await manager.loadConfig();

  assert.equal(manager.shouldIgnore(path.join(workspace, ".zed", "sftp.json")), true);
  assert.equal(manager.shouldIgnore(path.join(workspace, "node_modules", "package", "index.js")), true);
  assert.equal(manager.shouldIgnore(path.join(workspace, "src", "index.js")), false);
});
