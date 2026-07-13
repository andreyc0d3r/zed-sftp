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

  constructor(config: SftpConfig, connection: Connection, configManager: ConfigManager) {
    this.client = new Client();
    this.config = config;
    this.connection = connection;
    this.configManager = configManager;
  }

  async updateConfig(config: SftpConfig): Promise<void> {
    if (JSON.stringify(config) === JSON.stringify(this.config)) {
      return;
    }

    await this.disconnect();
    this.config = config;
  }

  private async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

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

      await this.client.connect(connectConfig);
      this.isConnected = true;
      this.connection.console.log(`Connected to ${this.config.host}`);
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to SFTP server: ${error}`);
    }
  }

  private async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.end();
      this.isConnected = false;
    }
  }

  async uploadFile(localPath: string): Promise<void> {
    await this.connect();

    try {
      // Use ConfigManager to get remote path (respects context setting)
      const remotePath = this.configManager.getRemotePath(localPath);

      if (!remotePath) {
        this.connection.console.warn(`File is outside context path: ${localPath}`);
        return;
      }

      const remoteDir = path.posix.dirname(remotePath);

      // Ensure remote directory exists
      await this.client.mkdir(remoteDir, true);

      // Upload file
      await this.client.put(localPath, remotePath);
      this.connection.console.log(`Uploaded: ${localPath} -> ${remotePath}`);
    } catch (error) {
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  async downloadFile(localPath: string): Promise<void> {
    await this.connect();

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
      await this.client.get(remotePath, localPath);
      this.connection.console.log(`Downloaded: ${remotePath} -> ${localPath}`);
    } catch (error) {
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  async uploadFolder(localFolderPath: string): Promise<void> {
    await this.connect();

    try {
      const remoteFolderPath = this.configManager.getRemotePath(localFolderPath);

      if (!remoteFolderPath) {
        this.connection.console.warn(`Folder is outside context path: ${localFolderPath}`);
        return;
      }

      // Upload directory recursively
      await this.client.uploadDir(localFolderPath, remoteFolderPath);
      this.connection.console.log(`Uploaded folder: ${localFolderPath} -> ${remoteFolderPath}`);
    } catch (error) {
      throw new Error(`Failed to upload folder: ${error}`);
    }
  }

  async downloadFolder(localFolderPath: string): Promise<void> {
    await this.connect();

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
      await this.client.downloadDir(remoteFolderPath, localFolderPath);
      this.connection.console.log(`Downloaded folder: ${remoteFolderPath} -> ${localFolderPath}`);
    } catch (error) {
      throw new Error(`Failed to download folder: ${error}`);
    }
  }

  async syncFolder(localFolderPath: string): Promise<void> {
    await this.connect();

    try {
      const remoteFolderPath = this.configManager.getRemotePath(localFolderPath);

      if (!remoteFolderPath) {
        this.connection.console.warn(`Folder is outside context path: ${localFolderPath}`);
        return;
      }

      // Upload directory (this will sync local to remote)
      await this.client.uploadDir(localFolderPath, remoteFolderPath);
      this.connection.console.log(`Synced folder: ${localFolderPath} -> ${remoteFolderPath}`);
    } catch (error) {
      throw new Error(`Failed to sync folder: ${error}`);
    }
  }

  async listRemoteFiles(remotePath: string): Promise<string[]> {
    await this.connect();

    try {
      const list = await this.client.list(remotePath);
      return list.map((item) => item.name);
    } catch (error) {
      throw new Error(`Failed to list remote files: ${error}`);
    }
  }

  async deleteRemoteFile(remotePath: string): Promise<void> {
    await this.connect();

    try {
      await this.client.delete(remotePath);
      this.connection.console.log(`Deleted remote file: ${remotePath}`);
    } catch (error) {
      throw new Error(`Failed to delete remote file: ${error}`);
    }
  }

  async close(): Promise<void> {
    await this.disconnect();
  }
}
