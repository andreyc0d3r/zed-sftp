import * as path from "path";
import { fileURLToPath } from "url";
import type { InitializeParams } from "vscode-languageserver/node";

type WorkspaceInitializeParams = Pick<
	InitializeParams,
	"workspaceFolders" | "rootUri" | "rootPath"
>;

export function fileUriToPath(uri: string): string {
	if (!uri.startsWith("file:")) {
		throw new Error(`Unsupported document URI: ${uri}`);
	}

	return fileURLToPath(uri);
}

export function getWorkspaceFolder(params: WorkspaceInitializeParams): string | undefined {
	const workspaceUri = params.workspaceFolders?.[0]?.uri ?? params.rootUri;

	if (workspaceUri) {
		return fileUriToPath(workspaceUri);
	}

	if (params.rootPath) {
		return path.resolve(params.rootPath);
	}

	return undefined;
}

export function commandArgumentToPath(argument: unknown): string {
	if (typeof argument !== "string" || argument.length === 0) {
		throw new Error("Command requires a file or folder path");
	}

	return argument.startsWith("file:") ? fileUriToPath(argument) : path.resolve(argument);
}
