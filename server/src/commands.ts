import * as path from "path";
import type { Command } from "vscode-languageserver/node";

export const SFTP_COMMANDS = [
	"sftp.upload",
	"sftp.download",
	"sftp.sync",
	"sftp.uploadFolder",
	"sftp.downloadFolder",
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
	];
}
