import type { Command } from "vscode-languageserver/node";
export declare const SFTP_COMMANDS: readonly ["sftp.upload", "sftp.download", "sftp.sync", "sftp.uploadFolder", "sftp.downloadFolder"];
export declare function createSftpCodeActions(filePath: string): Command[];
//# sourceMappingURL=commands.d.ts.map