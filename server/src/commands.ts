import * as path from "path";
import type { Command } from "vscode-languageserver/node";

export const SFTP_COMMANDS = [
	"sftp.upload",
	"sftp.download",
	"sftp.sync",
	"sftp.uploadFolder",
	"sftp.downloadFolder",
	"sftp.reconnect",
	"sftp.switchProfile",
] as const;

export function createSftpCodeActions(filePath: string): Command[] {
	const folderPath = path.dirname(filePath);

	return [
		{
			title: "SFTP: Upload File",
			command: "sftp.upload",
			arguments: [filePath],
		},
		{
			title: "SFTP: Download File",
			command: "sftp.download",
			arguments: [filePath],
		},
		{
			title: "SFTP: Upload Current Folder",
			command: "sftp.uploadFolder",
			arguments: [folderPath],
		},
		{
			title: "SFTP: Download Current Folder",
			command: "sftp.downloadFolder",
			arguments: [folderPath],
		},
		{
			title: "SFTP: Sync Workspace",
			command: "sftp.sync",
		},
		{
			title: "SFTP: Reconnect",
			command: "sftp.reconnect",
		},
	];
}

export function profileActions(names: string[], active?: string): Command[] {
	if (names.length < 2) return [];

	return names.filter(name => name !== active).map(name => ({
		title: `SFTP: Switch from ${active ?? "base configuration"} to ${name}`,
		command: "sftp.switchProfile",
		arguments: [name],
	}));
}
