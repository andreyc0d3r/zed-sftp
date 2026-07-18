"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const path = __importStar(require("path"));
const sftp_client_1 = require("./sftp-client");
const config_1 = require("./config");
const commands_1 = require("./commands");
const workspace_1 = require("./workspace");
// Add error handlers
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
// Create a connection for the server
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a simple text document manager
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let workspaceFolder;
let configManager;
let sftpClient;
async function loadSftpClient() {
    if (!configManager) {
        return null;
    }
    const config = await configManager.loadConfig();
    if (!config) {
        return null;
    }
    if (!sftpClient) {
        sftpClient = new sftp_client_1.SftpClient(config, connection, configManager);
    }
    else {
        await sftpClient.updateConfig(config);
    }
    return { config, client: sftpClient };
}
connection.onInitialize((params) => {
    workspaceFolder = (0, workspace_1.getWorkspaceFolder)(params);
    const result = {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                change: node_1.TextDocumentSyncKind.Full,
                save: {
                    includeText: false,
                },
            },
            codeActionProvider: true,
            executeCommandProvider: {
                commands: [...commands_1.SFTP_COMMANDS],
            },
        },
    };
    return result;
});
connection.onInitialized(async () => {
    connection.console.log("SFTP Language Server initialized");
    if (workspaceFolder) {
        try {
            configManager = new config_1.ConfigManager(workspaceFolder);
            const loaded = await loadSftpClient();
            if (loaded) {
                const { config } = loaded;
                connection.console.log(`SFTP config loaded for ${config.host}`);
                // Log context path if set
                if (config.context) {
                    connection.console.log(`Context path: ${config.context} -> ${configManager.getContextPath()}`);
                }
                // Start file watcher if uploadOnSave is enabled
                if (config.uploadOnSave) {
                    connection.console.log("Upload on save is enabled");
                }
            }
            else {
                connection.console.warn("No SFTP config found");
            }
        }
        catch (error) {
            connection.console.error(`Failed to initialize SFTP: ${error}`);
        }
    }
    else {
        connection.console.error("SFTP requires a local workspace folder, but Zed did not provide one");
    }
});
// Handle document save
documents.onDidSave(async (event) => {
    if (!configManager) {
        return;
    }
    try {
        const loaded = await loadSftpClient();
        if (!loaded || !loaded.config?.uploadOnSave) {
            return;
        }
        const filePath = (0, workspace_1.fileUriToPath)(event.document.uri);
        if (!configManager.isInContext(filePath)) {
            connection.console.log(`File is outside context path: ${filePath}`);
            return;
        }
        if (configManager.shouldIgnore(filePath)) {
            connection.console.log(`Ignoring file: ${filePath}`);
            return;
        }
        connection.console.log(`Uploading file on save: ${filePath}`);
        await loaded.client.uploadFile(filePath);
        connection.window.showInformationMessage(`Uploaded: ${path.basename(filePath)}`);
    }
    catch (error) {
        connection.console.error(`Failed to upload file: ${error}`);
        connection.window.showErrorMessage(`Failed to upload: ${error}`);
    }
});
connection.onCodeAction(async (params) => {
    if (!configManager) {
        return [];
    }
    try {
        const loaded = await loadSftpClient();
        if (!loaded) {
            return [];
        }
        const filePath = (0, workspace_1.fileUriToPath)(params.textDocument.uri);
        if (!configManager.isInContext(filePath) || configManager.shouldIgnore(filePath)) {
            return [];
        }
        return (0, commands_1.createSftpCodeActions)(filePath);
    }
    catch (error) {
        connection.console.warn(`Cannot provide SFTP actions: ${error}`);
        return [];
    }
});
// Handle commands
connection.onExecuteCommand(async (params) => {
    if (!configManager) {
        connection.window.showErrorMessage("SFTP not configured");
        return;
    }
    try {
        const loaded = await loadSftpClient();
        if (!loaded) {
            connection.window.showErrorMessage("SFTP not configured");
            return;
        }
        const client = loaded.client;
        switch (params.command) {
            case "sftp.upload":
                const uploadPath = (0, workspace_1.commandArgumentToPath)(params.arguments?.[0]);
                await client.uploadFile(uploadPath);
                connection.window.showInformationMessage(`Uploaded: ${path.basename(uploadPath)}`);
                break;
            case "sftp.download":
                const downloadPath = (0, workspace_1.commandArgumentToPath)(params.arguments?.[0]);
                await client.downloadFile(downloadPath);
                connection.window.showInformationMessage(`Downloaded: ${path.basename(downloadPath)}`);
                break;
            case "sftp.sync":
                await client.syncFolder(workspaceFolder);
                connection.window.showInformationMessage("Sync completed");
                break;
            case "sftp.uploadFolder":
                const uploadFolderPath = (0, workspace_1.commandArgumentToPath)(params.arguments?.[0]);
                await client.uploadFolder(uploadFolderPath);
                connection.window.showInformationMessage(`Uploaded folder: ${path.basename(uploadFolderPath)}`);
                break;
            case "sftp.downloadFolder":
                const downloadFolderPath = (0, workspace_1.commandArgumentToPath)(params.arguments?.[0]);
                await client.downloadFolder(downloadFolderPath);
                connection.window.showInformationMessage(`Downloaded folder: ${path.basename(downloadFolderPath)}`);
                break;
            case "sftp.reconnect":
                await client.reconnect();
                connection.window.showInformationMessage("SFTP connection restored");
                break;
            default:
                connection.window.showErrorMessage(`Unknown command: ${params.command}`);
        }
    }
    catch (error) {
        connection.console.error(`Command failed: ${error}`);
        connection.window.showErrorMessage(`Command failed: ${error}`);
    }
});
// Make the text document manager listen on the connection
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=index.js.map