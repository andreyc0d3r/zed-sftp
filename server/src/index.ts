import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
	InitializeParams,
	TextDocumentSyncKind,
	InitializeResult,
	ExecuteCommandParams,
	CodeActionParams,
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";
import * as path from "path";
import * as fs from "fs";
import { SftpClient } from "./sftp-client";
import { ConfigManager, SftpConfig } from "./config";
import { createSftpCodeActions, SFTP_COMMANDS } from "./commands";
import { commandArgumentToPath, fileUriToPath, getWorkspaceFolder } from "./workspace";

// Add error handlers
process.on("uncaughtException", (error) => {
	console.error("Uncaught Exception:", error);
	process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let workspaceFolder: string | undefined;
let configManager: ConfigManager | undefined;
let sftpClient: SftpClient | undefined;

async function loadSftpClient(): Promise<{ config: SftpConfig; client: SftpClient } | null> {
	if (!configManager) {
		return null;
	}

	const config = await configManager.loadConfig();
	if (!config) {
		return null;
	}

	if (!sftpClient) {
		sftpClient = new SftpClient(config, connection, configManager);
	} else {
		await sftpClient.updateConfig(config);
	}

	return { config, client: sftpClient };
}

connection.onInitialize((params: InitializeParams) => {
	workspaceFolder = getWorkspaceFolder(params);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Full,
				save: {
					includeText: false,
				},
			},
			codeActionProvider: true,
			executeCommandProvider: {
				commands: [...SFTP_COMMANDS],
			},
		},
	};

	return result;
});

connection.onInitialized(async () => {
	connection.console.log("SFTP Language Server initialized");

	if (workspaceFolder) {
		try {
			configManager = new ConfigManager(workspaceFolder);
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
			} else {
				connection.console.warn("No SFTP config found");
			}
		} catch (error) {
			connection.console.error(`Failed to initialize SFTP: ${error}`);
		}
	} else {
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

		const filePath = fileUriToPath(event.document.uri);

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
	} catch (error) {
		connection.console.error(`Failed to upload file: ${error}`);
		connection.window.showErrorMessage(`Failed to upload: ${error}`);
	}
});

connection.onCodeAction(async (params: CodeActionParams) => {
	if (!configManager) {
		return [];
	}

	try {
		const loaded = await loadSftpClient();
		if (!loaded) {
			return [];
		}

		const filePath = fileUriToPath(params.textDocument.uri);
		if (!configManager.isInContext(filePath) || configManager.shouldIgnore(filePath)) {
			return [];
		}

		return createSftpCodeActions(filePath);
	} catch (error) {
		connection.console.warn(`Cannot provide SFTP actions: ${error}`);
		return [];
	}
});

// Handle commands
connection.onExecuteCommand(async (params: ExecuteCommandParams) => {
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
				const uploadPath = commandArgumentToPath(params.arguments?.[0]);
				await client.uploadFile(uploadPath);
				connection.window.showInformationMessage(`Uploaded: ${path.basename(uploadPath)}`);
				break;

			case "sftp.download":
				const downloadPath = commandArgumentToPath(params.arguments?.[0]);
				await client.downloadFile(downloadPath);
				connection.window.showInformationMessage(`Downloaded: ${path.basename(downloadPath)}`);
				break;

			case "sftp.sync":
				await client.syncFolder(workspaceFolder!);
				connection.window.showInformationMessage("Sync completed");
				break;

			case "sftp.uploadFolder":
				const uploadFolderPath = commandArgumentToPath(params.arguments?.[0]);
				await client.uploadFolder(uploadFolderPath);
				connection.window.showInformationMessage(`Uploaded folder: ${path.basename(uploadFolderPath)}`);
				break;

			case "sftp.downloadFolder":
				const downloadFolderPath = commandArgumentToPath(params.arguments?.[0]);
				await client.downloadFolder(downloadFolderPath);
				connection.window.showInformationMessage(`Downloaded folder: ${path.basename(downloadFolderPath)}`);
				break;

			default:
				connection.window.showErrorMessage(`Unknown command: ${params.command}`);
		}
	} catch (error) {
		connection.console.error(`Command failed: ${error}`);
		connection.window.showErrorMessage(`Command failed: ${error}`);
	}
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
