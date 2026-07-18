import { Connection } from 'vscode-languageserver';
import { SftpConfig, ConfigManager } from './config';
export declare class SftpClient {
    private client;
    private config;
    private connection;
    private configManager;
    private isConnected;
    private connectPromise;
    private reconnectPromise;
    constructor(config: SftpConfig, connection: Connection, configManager: ConfigManager);
    updateConfig(config: SftpConfig): Promise<void>;
    private markDisconnected;
    private connect;
    private establishConnection;
    private disconnect;
    private isConnectionFailure;
    private executeWithReconnect;
    reconnect(): Promise<void>;
    private resetConnection;
    uploadFile(localPath: string): Promise<void>;
    downloadFile(localPath: string): Promise<void>;
    uploadFolder(localFolderPath: string): Promise<void>;
    downloadFolder(localFolderPath: string): Promise<void>;
    syncFolder(localFolderPath: string): Promise<void>;
    listRemoteFiles(remotePath: string): Promise<string[]>;
    deleteRemoteFile(remotePath: string): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=sftp-client.d.ts.map