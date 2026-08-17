import * as fs from "fs";
import * as path from "path";
import { minimatch } from "minimatch";

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
	context?: string; // Local subdirectory to use as root (e.g., "site/wp-content/")
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

function stripJsonComments(content: string): string {
	let result = "";
	let inString = false;
	let escaped = false;

	for (let index = 0; index < content.length; index += 1) {
		const character = content[index];
		const nextCharacter = content[index + 1];

		if (inString) {
			result += character;
			if (escaped) {
				escaped = false;
			} else if (character === "\\") {
				escaped = true;
			} else if (character === '"') {
				inString = false;
			}
			continue;
		}

		if (character === '"') {
			inString = true;
			result += character;
			continue;
		}

		if (character === "/" && nextCharacter === "/") {
			result += "  ";
			index += 2;
			while (index < content.length && content[index] !== "\n" && content[index] !== "\r") {
				result += " ";
				index += 1;
			}
			if (index < content.length) {
				result += content[index];
			}
			continue;
		}

		if (character === "/" && nextCharacter === "*") {
			result += "  ";
			index += 2;
			while (index < content.length) {
				if (content[index] === "*" && content[index + 1] === "/") {
					result += "  ";
					index += 1;
					break;
				}
				result += content[index] === "\n" || content[index] === "\r" ? content[index] : " ";
				index += 1;
			}
			continue;
		}

		result += character;
	}

	return result;
}

function stripTrailingCommas(content: string): string {
	let result = "";
	let inString = false;
	let escaped = false;

	for (let index = 0; index < content.length; index += 1) {
		const character = content[index];

		if (inString) {
			result += character;
			if (escaped) {
				escaped = false;
			} else if (character === "\\") {
				escaped = true;
			} else if (character === '"') {
				inString = false;
			}
			continue;
		}

		if (character === '"') {
			inString = true;
			result += character;
			continue;
		}

		if (character === ",") {
			let lookahead = index + 1;
			while (lookahead < content.length && /\s/.test(content[lookahead])) {
				lookahead += 1;
			}

			if (content[lookahead] === "}" || content[lookahead] === "]") {
				result += " ";
				continue;
			}
		}

		result += character;
	}

	return result;
}

export function parseJsonc(content: string): unknown {
	return JSON.parse(stripTrailingCommas(stripJsonComments(content)));
}

export class ConfigManager {
	private workspaceFolder: string;
	private config: SftpConfig | null = null;
	private ignorePatterns: string[] = [];
	private contextPath: string = ""; // Resolved context path

	constructor(workspaceFolder: string) {
		this.workspaceFolder = workspaceFolder;
	}

	async loadConfig(): Promise<SftpConfig | null> {
		// Try .zed/sftp.json first
		let configPath = path.join(this.workspaceFolder, ".zed", "sftp.json");

		if (!fs.existsSync(configPath)) {
			// Fall back to .vscode/sftp.json for compatibility
			configPath = path.join(this.workspaceFolder, ".vscode", "sftp.json");
		}

		if (!fs.existsSync(configPath)) {
			// Try root level sftp.json
			configPath = path.join(this.workspaceFolder, "sftp.json");
		}

		if (!fs.existsSync(configPath)) {
			return null;
		}

		try {
			const configContent = fs.readFileSync(configPath, "utf-8");
			this.config = parseJsonc(configContent) as SftpConfig;

			if (!this.config) {
				throw new Error("Config is empty");
			}

			// Profiles override base values before validation so connection fields may live in a profile.
			if (this.config.profiles && this.config.defaultProfile) {
				const profile = this.config.profiles[this.config.defaultProfile];
				if (!profile) {
					throw new Error(`Unknown defaultProfile: ${this.config.defaultProfile}`);
				}
				this.config = { ...this.config, ...profile };
			}

			if (!this.config.host) {
				throw new Error("Missing required field: host");
			}

			if (!this.config.username) {
				throw new Error("Missing required field: username");
			}

			if (!this.config.remotePath) {
				throw new Error("Missing required field: remotePath");
			}

			if (!this.config.password && !this.config.privateKeyPath && !this.config.agent) {
				throw new Error("One of password, privateKeyPath, or agent must be provided");
			}

			this.config.protocol ??= "sftp";

			// Set default local path
			if (!this.config.localPath) {
				this.config.localPath = this.workspaceFolder;
			}

			// Handle context path (local subdirectory to use as root)
			if (this.config.context) {
				const context = this.config.context.replace(/^\/+|\/+$/g, "");
				this.contextPath = path.join(this.workspaceFolder, context);
			} else {
				this.contextPath = this.workspaceFolder;
			}

			// Copy ignore patterns so defaults do not mutate the loaded configuration.
			this.ignorePatterns = [...(this.config.ignore || [])];

			// Add default ignore patterns
			if (!this.ignorePatterns.includes(".git")) {
				this.ignorePatterns.push(".git");
			}
			if (!this.ignorePatterns.includes("node_modules")) {
				this.ignorePatterns.push("node_modules");
			}

			const relativeConfigPath = path.relative(this.workspaceFolder, configPath).split(path.sep).join("/");
			if (!this.ignorePatterns.includes(relativeConfigPath)) {
				this.ignorePatterns.push(relativeConfigPath);
			}

			return this.config;
		} catch (error) {
			throw new Error(`Failed to load SFTP config: ${error}`);
		}
	}

	shouldIgnore(filePath: string): boolean {
		const relativePath = path.relative(this.workspaceFolder, filePath).split(path.sep).join("/");

		for (const pattern of this.ignorePatterns) {
			const normalizedPattern = pattern.split(path.sep).join("/").replace(/\/+$/, "");
			if (!normalizedPattern) {
				continue;
			}

			const matchesPattern = minimatch(relativePath, normalizedPattern, { dot: true });
			const matchesDirectoryContents = minimatch(relativePath, `${normalizedPattern}/**`, { dot: true });
			const matchesNestedDirectory =
				!normalizedPattern.includes("/") &&
				minimatch(relativePath, `**/${normalizedPattern}/**`, { dot: true });

			if (matchesPattern || matchesDirectoryContents || matchesNestedDirectory) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if a file is within the context path
	 */
	isInContext(filePath: string): boolean {
		const relativePath = path.relative(this.contextPath, path.resolve(filePath));
		return (
			relativePath === "" ||
			(relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath))
		);
	}

	/**
	 * Get the remote path for a local file, respecting the context setting
	 */
	getRemotePath(localFilePath: string): string | null {
		if (!this.config) {
			return null;
		}

		// Check if file is within context
		if (!this.isInContext(localFilePath)) {
			return null;
		}

		// Get relative path from context directory
		const relativePath = path.relative(this.contextPath, localFilePath);

		// Normalize remote path (ensure it starts with /)
		let remotePath = this.config.remotePath;
		if (!remotePath.startsWith("/")) {
			remotePath = "/" + remotePath;
		}

		// Combine remote path with relative path (use forward slashes for remote)
		const remoteFilePath = path.posix.join(remotePath, relativePath.split(path.sep).join("/"));

		return remoteFilePath;
	}

	getConfig(): SftpConfig | null {
		return this.config;
	}

	getContextPath(): string {
		return this.contextPath;
	}

	async saveConfig(config: SftpConfig): Promise<void> {
		const configDir = path.join(this.workspaceFolder, ".zed");

		if (!fs.existsSync(configDir)) {
			fs.mkdirSync(configDir, { recursive: true });
		}

		const configPath = path.join(configDir, "sftp.json");
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
		this.config = config;
	}

	async reloadConfig(): Promise<SftpConfig | null> {
		return this.loadConfig();
	}
}
