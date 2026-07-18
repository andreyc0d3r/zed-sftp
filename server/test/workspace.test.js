const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const { createSftpCodeActions } = require("../dist/commands");
const {
  commandArgumentToPath,
  fileUriToPath,
  getWorkspaceFolder,
} = require("../dist/workspace");

test("workspace initialization falls back to rootUri and decodes paths", () => {
  const workspace = path.join(path.sep, "tmp", "project with spaces");
  const workspaceUri = pathToFileURL(workspace).href;

  assert.equal(getWorkspaceFolder({ workspaceFolders: null, rootUri: workspaceUri }), workspace);
  assert.equal(fileUriToPath(workspaceUri), workspace);
});

test("workspaceFolders take precedence over legacy roots", () => {
  const workspace = path.join(path.sep, "tmp", "workspace");
  const fallback = path.join(path.sep, "tmp", "fallback");

  assert.equal(
    getWorkspaceFolder({
      workspaceFolders: [{ name: "workspace", uri: pathToFileURL(workspace).href }],
      rootUri: pathToFileURL(fallback).href,
      rootPath: fallback,
    }),
    workspace,
  );
});

test("manual SFTP actions invoke advertised commands with local paths", () => {
  const filePath = path.join(path.sep, "tmp", "workspace", "src", "index.ts");
  const actions = createSftpCodeActions(filePath);

  assert.deepEqual(
    actions.map(({ title, command }) => ({ title, command })),
    [
      { title: "SFTP: Upload File", command: "sftp.upload" },
      { title: "SFTP: Download File", command: "sftp.download" },
      { title: "SFTP: Upload Current Folder", command: "sftp.uploadFolder" },
      { title: "SFTP: Download Current Folder", command: "sftp.downloadFolder" },
      { title: "SFTP: Sync Workspace", command: "sftp.sync" },
      { title: "SFTP: Reconnect", command: "sftp.reconnect" },
    ],
  );
  assert.equal(actions[0].arguments[0], filePath);
  assert.equal(actions[2].arguments[0], path.dirname(filePath));
  assert.equal(commandArgumentToPath(pathToFileURL(filePath).href), filePath);
});
