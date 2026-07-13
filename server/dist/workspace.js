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
exports.fileUriToPath = fileUriToPath;
exports.getWorkspaceFolder = getWorkspaceFolder;
exports.commandArgumentToPath = commandArgumentToPath;
const path = __importStar(require("path"));
const url_1 = require("url");
function fileUriToPath(uri) {
    if (!uri.startsWith("file:")) {
        throw new Error(`Unsupported document URI: ${uri}`);
    }
    return (0, url_1.fileURLToPath)(uri);
}
function getWorkspaceFolder(params) {
    const workspaceUri = params.workspaceFolders?.[0]?.uri ?? params.rootUri;
    if (workspaceUri) {
        return fileUriToPath(workspaceUri);
    }
    if (params.rootPath) {
        return path.resolve(params.rootPath);
    }
    return undefined;
}
function commandArgumentToPath(argument) {
    if (typeof argument !== "string" || argument.length === 0) {
        throw new Error("Command requires a file or folder path");
    }
    return argument.startsWith("file:") ? fileUriToPath(argument) : path.resolve(argument);
}
//# sourceMappingURL=workspace.js.map