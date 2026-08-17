"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
exports.parseJsonc = parseJsonc;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const minimatch_1 = require("minimatch");
function stripJsonComments(content) {
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
            }
            else if (character === "\\") {
                escaped = true;
            }
            else if (character === '"') {
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
function stripTrailingCommas(content) {
    let result = "";
    let inString = false;
    let escaped = false;
    for (let index = 0; index < content.length; index += 1) {
        const character = content[index];
        if (inString) {
            result += character;
            if (escaped) {
                escaped = false;
            }
            else if (character === "\\") {
                escaped = true;
            }
            else if (character === '"') {
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
function parseJsonc(content) {
    return JSON.parse(stripTrailingCommas(stripJsonComments(content)));
}
class ConfigManager {
    constructor(workspaceFolder) {
        this.config = null;
        this.ignorePatterns = [];
        this.contextPath = ""; // Resolved context path
        this.workspaceFolder = workspaceFolder;
    }
    async loadConfig() {
        var _a;
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
            this.config = parseJsonc(configContent);
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
            (_a = this.config).protocol ?? (_a.protocol = "sftp");
            // Set default local path
            if (!this.config.localPath) {
                this.config.localPath = this.workspaceFolder;
            }
            // Handle context path (local subdirectory to use as root)
            if (this.config.context) {
                const context = this.config.context.replace(/^\/+|\/+$/g, "");
                this.contextPath = path.join(this.workspaceFolder, context);
            }
            else {
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
        }
        catch (error) {
            throw new Error(`Failed to load SFTP config: ${error}`);
        }
    }
    shouldIgnore(filePath) {
        const relativePath = path.relative(this.workspaceFolder, filePath).split(path.sep).join("/");
        for (const pattern of this.ignorePatterns) {
            const normalizedPattern = pattern.split(path.sep).join("/").replace(/\/+$/, "");
            if (!normalizedPattern) {
                continue;
            }
            const matchesPattern = (0, minimatch_1.minimatch)(relativePath, normalizedPattern, { dot: true });
            const matchesDirectoryContents = (0, minimatch_1.minimatch)(relativePath, `${normalizedPattern}/**`, { dot: true });
            const matchesNestedDirectory = !normalizedPattern.includes("/") &&
                (0, minimatch_1.minimatch)(relativePath, `**/${normalizedPattern}/**`, { dot: true });
            if (matchesPattern || matchesDirectoryContents || matchesNestedDirectory) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check if a file is within the context path
     */
    isInContext(filePath) {
        const relativePath = path.relative(this.contextPath, path.resolve(filePath));
        return (relativePath === "" ||
            (relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath)));
    }
    /**
     * Get the remote path for a local file, respecting the context setting
     */
    getRemotePath(localFilePath) {
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
    getConfig() {
        return this.config;
    }
    getContextPath() {
        return this.contextPath;
    }
    async saveConfig(config) {
        const configDir = path.join(this.workspaceFolder, ".zed");
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const configPath = path.join(configDir, "sftp.json");
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        this.config = config;
    }
    async reloadConfig() {
        return this.loadConfig();
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=config.js.map