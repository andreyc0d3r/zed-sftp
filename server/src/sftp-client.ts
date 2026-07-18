import Client from 'ssh2-sftp-client';
import * as path from 'path';
import * as fs from 'fs';
import { Connection } from 'vscode-languageserver';
import { SftpConfig, ConfigManager } from './config';

export class SftpClient {
  private client: Client;
  private config: SftpConfig;
  private connection: Connection;
  private configManager: ConfigManager;
  private isConnected: boolean = false;
  private connectPromise: Promise<void> | null = null;
  private reconnectPromise: Promise<void> | null = null;

  constructor(config: SftpConfig, connection: Connection, configManager: ConfigManager) {
    this.client = new Client();
    this.config = config;
    this.connection = connection;
    this.configManager = configManager;

    this.client.on('close', () => this.markDisconnected('closed'));
    this.client.on('end', () => this.markDisconnected('ended'));
    this.client.on('error', (error) => this.markDisconnected('failed', error));
  }

  async updateConfig(config: SftpConfig): Promise<void> {
    if (JSON.stringify(config) === JSON.stringify(this.config)) {
      return;
    }

    await this.disconnect();
    this.config = config;
  }

  private markDisconnected(event: string, error?: unknown): void {
    const wasConnected = this.isConnected;
    this.isConnected = false;

    if (wasConnected) {
      const detail = error instanceof Error ? `: ${error.message}` : '';
      this.connection.console.warn(`SFTP connection ${event}${detail}`);
    }
  }

  private async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.establishConnection();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async establishConnection(): Promise<void> {
    try {
      const connectConfig: any = {
        host: this.config.host,
        port: this.config.port || 22,
        username: this.config.username,
      };

      // Handle authentication
      if (this.config.password) {
        connectConfig.password = this.config.password;
      } else if (this.config.privateKeyPath) {
        const keyPath = this.config.privateKeyPath.replace('~', process.env.HOME || '');
        connectConfig.privateKey = fs.readFileSync(keyPath);

        if (this.config.passphrase) {
          connectConfig.passphrase = this.config.passphrase;
        }
      }

      // Connection timeout
      if (this.config.connectTimeout) {
        connectConfig.readyTimeout = this.config.connectTimeout;
      }

      if (this.config.keepalive && this.config.keepalive > 0) {
        connectConfig.keepaliveInterval = this.config.keepalive;
      }

      await this.client.connect(connectConfig);
      this.isConnected = true;
      this.connection.console.log(`Connected to ${this.config.host}`);
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to SFTP server: ${error}`);
    }
  }

  private async disconnect(): Promise<void> {
    this.isConnected = false;

    try {
      await this.client.end();
    } catch (error) {
      this.connection.console.warn(`Failed to close SFTP connection cleanly: ${error}`);
    }
  }

  private isConnectionFailure(error: unknown): boolean {
    if (!this.isConnected) {
      return true;
    }

    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
    const message = error instanceof Error ? error.message : String(error);

    return (
      [
        'ECONNABORTED',
        'ECONNRESET',
        'ENOTCONN',
        'EPIPE',
        'ERR_GENERIC_CLIENT',
        'ERR_NOT_CONNECTED',
        'ERR_SOCKET_CLOSED',
        'ERR_STREAM_DESTROYED',
        'ETIMEDOUT',
      ].includes(code) ||
      /No SFTP connection available|Unexpected (?:close|end) event|socket (?:closed|disconnected)|write after end/i.test(
        message,
      )
    );
  }

  private async executeWithReconnect<T>(
    operationName: string,
    operation: (client: Client) => Promise<T>,
  ): Promise<T> {
    await this.connect();

    try {
      return await operation(this.client);
    } catch (error) {
      if (!this.isConnectionFailure(error)) {
        throw error;
      }

      this.connection.console.warn(
        `SFTP connection lost during ${operationName}; reconnecting and retrying once`,
      );
      await this.reconnect();
      return operation(this.client);
    }
  }

  async reconnect(): Promise<void> {
    if (this.reconnectPromise) {
      return this.reconnectPromise;
    }

    this.reconnectPromise = this.resetConnection();

    try {
      await this.reconnectPromise;
    } finally {
      this.reconnectPromise = null;
    }
  }

  private async resetConnection(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  async uploadFile(localPath: string): Promise<void> {
    try {
      // Use ConfigManager to get remote path (respects context setting)
      const remotePath = this.configManager.getRemotePath(localPath);

      if (!remotePath) {
        this.connection.console.warn(`File is outside context path: ${localPath}`);
        return;
      }

      const remoteDir = path.posix.dirname(remotePath);

      await this.executeWithReconnect('file upload', async (client) => {
        // Ensure remote directory exists
        await client.mkdir(remoteDir, true);

        // Upload file
        await client.put(localPath, remotePath);
      });
      this.connection.console.log(`Uploaded: ${localPath} -> ${remotePath}`);
    } catch (error) {
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  async downloadFile(localPath: string): Promise<void> {
    try {
      const remotePath = this.configManager.getRemotePath(localPath);

      if (!remotePath) {
        this.connection.console.warn(`File is outside context path: ${localPath}`);
        return;
      }

      const localDir = path.dirname(localPath);

      // Ensure local directory exists
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      // Download file
      await this.executeWithReconnect('file download', (client) => client.get(remotePath, localPath));
      this.connection.console.log(`Downloaded: ${remotePath} -> ${localPath}`);
    } catch (error) {
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  async uploadFolder(localFolderPath: string): Promise<void> {
    try {
      const remoteFolderPath = this.configManager.getRemotePath(localFolderPath);

      if (!remoteFolderPath) {
        this.connection.console.warn(`Folder is outside context path: ${localFolderPath}`);
        return;
      }

      // Upload directory recursively
      await this.executeWithReconnect('folder upload', (client) =>
        client.uploadDir(localFolderPath, remoteFolderPath),
      );
      this.connection.console.log(`Uploaded folder: ${localFolderPath} -> ${remoteFolderPath}`);
    } catch (error) {
      throw new Error(`Failed to upload folder: ${error}`);
    }
  }

  async downloadFolder(localFolderPath: string): Promise<void> {
    try {
      const remoteFolderPath = this.configManager.getRemotePath(localFolderPath);

      if (!remoteFolderPath) {
        this.connection.console.warn(`Folder is outside context path: ${localFolderPath}`);
        return;
      }

      // Ensure local directory exists
      if (!fs.existsSync(localFolderPath)) {
        fs.mkdirSync(localFolderPath, { recursive: true });
      }

      // Download directory recursively
      await this.executeWithReconnect('folder download', (client) =>
        client.downloadDir(remoteFolderPath, localFolderPath),
      );
      this.connection.console.log(`Downloaded folder: ${remoteFolderPath} -> ${localFolderPath}`);
    } catch (error) {
      throw new Error(`Failed to download folder: ${error}`);
    }
  }

  async syncFolder(localFolderPath: string): Promise<void> {
    try {
      const remoteFolderPath = this.configManager.getRemotePath(localFolderPath);

      if (!remoteFolderPath) {
        this.connection.console.warn(`Folder is outside context path: ${localFolderPath}`);
        return;
      }

      // Upload directory (this will sync local to remote)
      await this.executeWithReconnect('folder sync', (client) =>
        client.uploadDir(localFolderPath, remoteFolderPath),
      );
      this.connection.console.log(`Synced folder: ${localFolderPath} -> ${remoteFolderPath}`);
    } catch (error) {
      throw new Error(`Failed to sync folder: ${error}`);
    }
  }

  async listRemoteFiles(remotePath: string): Promise<string[]> {
    try {
      const list = await this.executeWithReconnect('remote listing', (client) =>
        client.list(remotePath),
      );
      return list.map((item) => item.name);
    } catch (error) {
      throw new Error(`Failed to list remote files: ${error}`);
    }
  }

  async deleteRemoteFile(remotePath: string): Promise<void> {
    try {
      await this.executeWithReconnect('remote file deletion', (client) => client.delete(remotePath));
      this.connection.console.log(`Deleted remote file: ${remotePath}`);
    } catch (error) {
      throw new Error(`Failed to delete remote file: ${error}`);
    }
  }

  async close(): Promise<void> {
    await this.disconnect();
  }
}
