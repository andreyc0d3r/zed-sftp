const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { SftpClient } = require("../dist/sftp-client");

function createClient(configOverrides = {}) {
  const messages = [];
  const connection = {
    console: {
      log: (message) => messages.push({ level: "log", message }),
      warn: (message) => messages.push({ level: "warn", message }),
    },
  };
  const configManager = {
    getRemotePath: (localPath) => path.posix.join("/remote", path.basename(localPath)),
  };
  const client = new SftpClient(
    {
      host: "example.com",
      username: "deploy",
      password: "secret",
      remotePath: "/remote",
      ...configOverrides,
    },
    connection,
    configManager,
  );

  return { client, transport: client.client, messages };
}

test("reconnects after the SSH transport closes", async () => {
  const { client, transport } = createClient({ keepalive: 15000 });
  const connectConfigs = [];
  let uploadCount = 0;

  transport.connect = async (config) => {
    connectConfigs.push(config);
  };
  transport.mkdir = async () => "/remote";
  transport.put = async () => {
    uploadCount += 1;
    return "/remote/index.js";
  };

  await client.uploadFile("/workspace/index.js");
  transport.client.emit("close");
  await client.uploadFile("/workspace/index.js");

  assert.equal(connectConfigs.length, 2);
  assert.equal(connectConfigs[0].keepaliveInterval, 15000);
  assert.equal(uploadCount, 2);
});

test("retries an operation once when a stale connection is detected", async () => {
  const { client, transport, messages } = createClient();
  let connectCount = 0;
  let endCount = 0;
  let uploadCount = 0;

  transport.connect = async () => {
    connectCount += 1;
  };
  transport.end = async () => {
    endCount += 1;
    return true;
  };
  transport.mkdir = async () => "/remote";
  transport.put = async () => {
    uploadCount += 1;
    if (uploadCount === 1) {
      throw new Error("put: No SFTP connection available");
    }
    return "/remote/index.js";
  };

  await client.uploadFile("/workspace/index.js");

  assert.equal(connectCount, 2);
  assert.equal(endCount, 1);
  assert.equal(uploadCount, 2);
  assert.equal(
    messages.some(({ message }) => message.includes("reconnecting and retrying once")),
    true,
  );
});

test("supports manually reconnecting without restarting the language server", async () => {
  const { client, transport } = createClient();
  let connectCount = 0;
  let endCount = 0;

  transport.connect = async () => {
    connectCount += 1;
  };
  transport.end = async () => {
    endCount += 1;
    return true;
  };

  await Promise.all([client.reconnect(), client.reconnect()]);
  await client.reconnect();

  assert.equal(connectCount, 2);
  assert.equal(endCount, 2);
});

test("does not reconnect for an SFTP operation error", async () => {
  const { client, transport } = createClient();
  let connectCount = 0;
  let endCount = 0;

  transport.connect = async () => {
    connectCount += 1;
  };
  transport.end = async () => {
    endCount += 1;
    return true;
  };
  transport.mkdir = async () => {
    const error = new Error("mkdir: Permission denied");
    error.code = "EACCES";
    throw error;
  };

  await assert.rejects(client.uploadFile("/workspace/index.js"), /Permission denied/);

  assert.equal(connectCount, 1);
  assert.equal(endCount, 0);
});
