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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IgnoreFilter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ignore_1 = __importDefault(require("ignore"));
class IgnoreFilter {
    constructor() {
        this.defaultIgnores = [
            'node_modules/**',
            'dist/**',
            'build/**',
            'target/**',
            'out/**',
            '.next/**',
            '.nuxt/**',
            '.venv/**',
            'venv/**',
            '.idea/**',
            '.vscode/**',
            '__pycache__/**',
            '.pytest_cache/**',
            'coverage/**',
            'logs/**',
            '*.log',
            'site-packages/**',
            '.DS_Store',
            'Thumbs.db'
        ];
        this.ignoreInstance = (0, ignore_1.default)();
    }
    async initialize(rootPath) {
        // Add default ignores
        this.ignoreInstance.add(this.defaultIgnores);
        // Load .gitignore files
        await this.loadIgnoreFiles(rootPath, '.gitignore');
        await this.loadIgnoreFiles(rootPath, '.gitingestignore');
    }
    async loadIgnoreFiles(rootPath, filename) {
        try {
            await this.walkDirectory(rootPath, async (dirPath) => {
                const ignoreFilePath = path.join(dirPath, filename);
                try {
                    const content = await fs.promises.readFile(ignoreFilePath, 'utf8');
                    const relativeDirPath = path.relative(rootPath, dirPath);
                    const patterns = content
                        .split('\n')
                        .map((line) => line.trim())
                        .filter((line) => line && !line.startsWith('#'))
                        .map((pattern) => {
                        if (relativeDirPath && !pattern.startsWith('/')) {
                            return path.join(relativeDirPath, pattern).replace(/\\/g, '/');
                        }
                        return pattern.startsWith('/') ? pattern.slice(1) : pattern;
                    });
                    this.ignoreInstance.add(patterns);
                }
                catch {
                    // Ignore files that can't be read
                }
            });
        }
        catch {
            // Ignore directory traversal errors
        }
    }
    async walkDirectory(dirPath, callback) {
        await callback(dirPath);
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && entry.name !== '.git') {
                    const subDirPath = path.join(dirPath, entry.name);
                    await this.walkDirectory(subDirPath, callback);
                }
            }
        }
        catch {
            // Ignore directories we can't read
        }
    }
    shouldIgnore(relativePath) {
        return this.ignoreInstance.ignores(relativePath);
    }
}
exports.IgnoreFilter = IgnoreFilter;
//# sourceMappingURL=ignore.js.map