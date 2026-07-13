const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

function startServer() {
  const child = spawn(process.execPath, [path.join(__dirname, "..", "dist", "index.js"), "--stdio"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pending = new Map();
  let buffer = Buffer.alloc(0);
  let nextId = 1;
  let stderr = "";

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const lengthMatch = header.match(/Content-Length: (\d+)/i);
      if (!lengthMatch) {
        throw new Error(`Missing Content-Length header: ${header}`);
      }

      const contentLength = Number(lengthMatch[1]);
      const messageEnd = headerEnd + 4 + contentLength;
      if (buffer.length < messageEnd) {
        return;
      }

      const message = JSON.parse(buffer.subarray(headerEnd + 4, messageEnd).toString("utf8"));
      buffer = buffer.subarray(messageEnd);

      if (message.id !== undefined && pending.has(message.id)) {
        const { resolve, reject, timeout } = pending.get(message.id);
        clearTimeout(timeout);
        pending.delete(message.id);
        if (message.error) {
          reject(new Error(JSON.stringify(message.error)));
        } else {
          resolve(message.result);
        }
      }
    }
  });

  function send(message) {
    const content = JSON.stringify({ jsonrpc: "2.0", ...message });
    child.stdin.write(`Content-Length: ${Buffer.byteLength(content)}\r\n\r\n${content}`);
  }

  function request(method, params) {
    const id = nextId;
    nextId += 1;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}. stderr: ${stderr}`));
      }, 2000);
      pending.set(id, { resolve, reject, timeout });
      send({ id, method, params });
    });
  }

  return { child, request, send };
}

test("LSP initializes from rootUri and returns executable SFTP code actions", async (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "zed-sftp-lsp-"));
  fs.mkdirSync(path.join(workspace, ".zed"));
  fs.writeFileSync(
    path.join(workspace, ".zed", "sftp.json"),
    JSON.stringify({
      host: "example.com",
      username: "deploy",
      password: "secret",
      remotePath: "/remote",
    }),
  );

  const filePath = path.join(workspace, "index.js");
  fs.writeFileSync(filePath, "console.log('test');\n");

  const server = startServer();
  t.after(() => {
    server.child.kill();
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  const initialization = await server.request("initialize", {
    processId: null,
    rootUri: pathToFileURL(workspace).href,
    workspaceFolders: null,
    capabilities: {},
  });

  assert.equal(initialization.capabilities.codeActionProvider, true);
  assert.deepEqual(initialization.capabilities.executeCommandProvider.commands, [
    "sftp.upload",
    "sftp.download",
    "sftp.sync",
    "sftp.uploadFolder",
    "sftp.downloadFolder",
  ]);

  server.send({ method: "initialized", params: {} });

  let actions = [];
  for (let attempt = 0; attempt < 10 && actions.length === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    actions = await server.request("textDocument/codeAction", {
      textDocument: { uri: pathToFileURL(filePath).href },
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      context: { diagnostics: [] },
    });
  }

  assert.deepEqual(
    actions.map((action) => action.command),
    ["sftp.upload", "sftp.download", "sftp.uploadFolder", "sftp.downloadFolder", "sftp.sync"],
  );

  await server.request("shutdown");
  server.send({ method: "exit" });
});
