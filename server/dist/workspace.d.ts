import type { InitializeParams } from "vscode-languageserver/node";
type WorkspaceInitializeParams = Pick<InitializeParams, "workspaceFolders" | "rootUri" | "rootPath">;
export declare function fileUriToPath(uri: string): string;
export declare function getWorkspaceFolder(params: WorkspaceInitializeParams): string | undefined;
export declare function commandArgumentToPath(argument: unknown): string;
export {};
//# sourceMappingURL=workspace.d.ts.map