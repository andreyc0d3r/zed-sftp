export interface SftpConfig {
    name?: string;
    protocol?: "sftp" | "ftp" | "ftps";
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
    agent?: string;
    remotePath: string;
    localPath?: string;
    context?: string;
    uploadOnSave?: boolean;
    downloadOnOpen?: boolean;
    ignore?: string[];
    concurrency?: number;
    connectTimeout?: number;
    keepalive?: number;
    interactiveAuth?: boolean;
    algorithms?: {
        kex?: string[];
        cipher?: string[];
        serverHostKey?: string[];
        hmac?: string[];
    };
    watcher?: {
        files?: string;
        autoUpload?: boolean;
        autoDelete?: boolean;
    };
    profiles?: {
        [key: string]: Partial<SftpConfig>;
    };
    defaultProfile?: string;
}
export declare function parseJsonc(content: string): unknown;
export declare class ConfigManager {
    private workspaceFolder;
    private config;
    private ignorePatterns;
    private contextPath;
    constructor(workspaceFolder: string);
    loadConfig(): Promise<SftpConfig | null>;
    shouldIgnore(filePath: string): boolean;
    /**
     * Check if a file is within the context path
     */
    isInContext(filePath: string): boolean;
    /**
     * Get the remote path for a local file, respecting the context setting
     */
    getRemotePath(localFilePath: string): string | null;
    getConfig(): SftpConfig | null;
    getContextPath(): string;
    saveConfig(config: SftpConfig): Promise<void>;
    reloadConfig(): Promise<SftpConfig | null>;
}
//# sourceMappingURL=config.d.ts.map