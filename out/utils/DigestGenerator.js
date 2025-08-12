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
exports.DigestGenerator = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const ignore_1 = require("./ignore");
const tree_1 = require("./tree");
const binary_1 = require("./binary");
const tokens_1 = require("./tokens");
const minimatch_1 = require("minimatch");
const readFile = (0, util_1.promisify)(fs.readFile);
const writeFile = (0, util_1.promisify)(fs.writeFile);
const stat = (0, util_1.promisify)(fs.stat);
const readdir = (0, util_1.promisify)(fs.readdir);
const lstat = (0, util_1.promisify)(fs.lstat);
const readlink = (0, util_1.promisify)(fs.readlink);
class DigestGenerator {
    constructor() {
        this.config = vscode.workspace.getConfiguration('codeDigest');
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        this.ignoreFilter = new ignore_1.IgnoreFilter();
        this.treeBuilder = new tree_1.TreeBuilder();
        this.binaryDetector = new binary_1.BinaryDetector();
        this.tokenEstimator = new tokens_1.TokenEstimator();
    }
    async generateDigest() {
        if (!this.workspaceRoot) {
            vscode.window.showErrorMessage('Please open a workspace folder first.');
            return;
        }
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating Code Digest",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Scanning files..." });
                // Refresh config
                this.config = vscode.workspace.getConfiguration('codeDigest');
                // Initialize ignore filter
                if (this.config.get('respectGitignore')) {
                    await this.ignoreFilter.initialize(this.workspaceRoot);
                }
                progress.report({ increment: 20, message: "Collecting files..." });
                // Collect files
                const files = await this.collectFiles();
                progress.report({ increment: 40, message: "Processing content..." });
                // Generate content
                const { summary, tree, content } = await this.processFiles(files);
                progress.report({ increment: 80, message: "Writing digest file..." });
                // Write output
                const outputPath = await this.writeDigest(summary, tree, content);
                progress.report({ increment: 100, message: "Complete!" });
                // Open the file
                const doc = await vscode.workspace.openTextDocument(outputPath);
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage(`Code digest generated: ${path.basename(outputPath)}`);
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to generate digest: ${message}`);
        }
    }
    async collectFiles() {
        const files = [];
        const mode = this.config.get('mode', 'curated');
        await this.traverseDirectory(this.workspaceRoot, '', files, mode);
        // Sort files by path
        files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
        return files;
    }
    async traverseDirectory(fullPath, relativePath, files, mode) {
        try {
            const entries = await readdir(fullPath);
            for (const entry of entries) {
                const entryFullPath = path.join(fullPath, entry);
                const entryRelativePath = path.join(relativePath, entry).replace(/\\/g, '/');
                // Check if should skip
                if (this.shouldSkipEntry(entry, entryRelativePath, entryFullPath)) {
                    continue;
                }
                try {
                    const stats = await lstat(entryFullPath);
                    if (stats.isSymbolicLink()) {
                        let symlinkTarget;
                        try {
                            symlinkTarget = await readlink(entryFullPath);
                        }
                        catch {
                            symlinkTarget = '<broken link>';
                        }
                        files.push({
                            relativePath: entryRelativePath,
                            fullPath: entryFullPath,
                            isSymlink: true,
                            symlinkTarget
                        });
                    }
                    else if (stats.isDirectory()) {
                        await this.traverseDirectory(entryFullPath, entryRelativePath, files, mode);
                    }
                    else if (stats.isFile()) {
                        if (this.shouldIncludeFile(entry, entryRelativePath, stats.size, mode)) {
                            files.push({
                                relativePath: entryRelativePath,
                                fullPath: entryFullPath,
                                isSymlink: false
                            });
                        }
                    }
                }
                catch (error) {
                    // Skip files we can't stat
                    console.warn(`Could not stat ${entryFullPath}:`, error);
                }
            }
        }
        catch (error) {
            console.warn(`Could not read directory ${fullPath}:`, error);
        }
    }
    shouldSkipEntry(name, relativePath, fullPath) {
        // Check .git directory
        if (name === '.git') {
            return !this.config.get('includeGitDir');
        }
        // Check dotfiles
        if (name.startsWith('.') && !this.config.get('includeDotfiles')) {
            return true;
        }
        // Check ignore patterns
        if (this.config.get('respectGitignore')) {
            if (this.ignoreFilter.shouldIgnore(relativePath)) {
                return true;
            }
        }
        // Check additional exclude globs
        const excludeGlobs = this.config.get('additionalExcludeGlobs', []);
        for (const glob of excludeGlobs) {
            if ((0, minimatch_1.minimatch)(relativePath, glob)) {
                // Check if force-included
                const includeGlobs = this.config.get('additionalIncludeGlobs', []);
                const forceIncluded = includeGlobs.some(includeGlob => (0, minimatch_1.minimatch)(relativePath, includeGlob));
                if (!forceIncluded) {
                    return true;
                }
            }
        }
        return false;
    }
    shouldIncludeFile(name, relativePath, size, mode) {
        // Check file size
        const maxSizeBytes = (this.config.get('maxFileSizeKB', 10240) * 1024);
        if (size > maxSizeBytes) {
            return false;
        }
        // Check additional include globs (force include)
        const includeGlobs = this.config.get('additionalIncludeGlobs', []);
        if (includeGlobs.some(glob => (0, minimatch_1.minimatch)(relativePath, glob))) {
            return true;
        }
        if (mode === 'curated') {
            return this.isCuratedFile(name, relativePath);
        }
        else if (mode === 'allText') {
            // For allText mode, we'll need to check if it's text-like
            // This is a heuristic - in practice you might want to read a small chunk
            return this.looksLikeTextFile(name);
        }
        return false;
    }
    isCuratedFile(name, relativePath) {
        const ext = path.extname(name).toLowerCase();
        const basename = path.basename(name);
        // Code file extensions
        const codeExtensions = [
            '.py', '.java', '.js', '.jsx', '.ts', '.tsx', '.c', '.h', '.cpp', '.cc',
            '.cxx', '.hpp', '.hh', '.cs', '.swift', '.php', '.sql', '.rb', '.go',
            '.kt', '.r', '.dart', '.rs', '.vue', '.svelte'
        ];
        if (codeExtensions.includes(ext)) {
            return true;
        }
        // Config and documentation files by name
        const configNames = [
            'package.json', 'pyproject.toml', 'go.mod', 'cargo.toml', 'gemfile',
            'requirements.txt', 'pipfile', 'makefile', 'dockerfile', 'procfile',
            '.gitignore', '.gitingestignore', '.gitkeep', '.editorconfig',
            '.prettierrc', '.eslintrc', '.npmrc', '.yarnrc', '.python-version'
        ];
        const lowerName = basename.toLowerCase();
        if (configNames.some(config => lowerName.includes(config.replace('.', '')))) {
            return true;
        }
        // README, LICENSE, CHANGELOG files
        if (lowerName.startsWith('readme') ||
            lowerName.startsWith('license') ||
            lowerName.startsWith('changelog') ||
            lowerName.includes('license') ||
            lowerName === 'notice') {
            return true;
        }
        // Environment files
        if (lowerName.startsWith('.env')) {
            return true;
        }
        return false;
    }
    looksLikeTextFile(name) {
        const ext = path.extname(name).toLowerCase();
        // Known text extensions
        const textExtensions = [
            '.txt', '.md', '.rst', '.json', '.xml', '.yml', '.yaml', '.toml',
            '.ini', '.cfg', '.conf', '.log', '.csv', '.tsv', '.html', '.htm',
            '.css', '.scss', '.sass', '.less', '.svg'
        ];
        if (textExtensions.includes(ext)) {
            return true;
        }
        // Binary extensions to exclude
        const binaryExtensions = [
            '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o', '.a', '.lib',
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg', '.webp',
            '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac', '.ogg',
            '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.jar', '.war',
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
        ];
        if (binaryExtensions.includes(ext)) {
            return false;
        }
        // No extension or unknown extension - might be text
        return true;
    }
    async processFiles(files) {
        const rootName = path.basename(this.workspaceRoot);
        const timestamp = new Date().toISOString();
        // Build tree
        const tree = this.treeBuilder.buildTree(files, rootName);
        // Process file contents
        const contentBlocks = [];
        let processedCount = 0;
        for (const file of files) {
            const block = await this.processFileContent(file);
            if (block) {
                contentBlocks.push(block);
                processedCount++;
            }
        }
        const content = contentBlocks.join('\n');
        const fullText = tree + '\n' + content;
        const tokenEstimate = this.tokenEstimator.estimate(fullText);
        const summary = [
            `Directory: ${rootName}`,
            `Files analyzed: ${processedCount}`,
            `Generated: ${timestamp}`,
            `Estimated tokens: ${tokenEstimate}`
        ].join('\n');
        return { summary, tree, content };
    }
    async processFileContent(file) {
        const separator = '='.repeat(48);
        try {
            if (file.isSymlink) {
                return [
                    separator,
                    `SYMLINK: ${file.relativePath} -> ${file.symlinkTarget}`,
                    separator,
                    '',
                    ''
                ].join('\n');
            }
            // Read file
            const buffer = await readFile(file.fullPath);
            // Check if binary
            const isBinary = this.binaryDetector.isBinary(buffer);
            const includeBinary = this.config.get('includeBinary', false);
            let contentText;
            if (isBinary && !includeBinary) {
                contentText = '[Binary file]';
            }
            else if (isBinary && includeBinary) {
                try {
                    contentText = buffer.toString('utf8');
                }
                catch {
                    contentText = `Content (base64):\n${buffer.toString('base64')}`;
                }
            }
            else {
                contentText = buffer.toString('utf8');
            }
            // Apply markdown code fences if enabled and output is .md
            const outputFileName = this.config.get('outputFileName', 'digest.txt');
            const useCodeFences = this.config.get('markdownCodeFences', false) &&
                outputFileName.toLowerCase().endsWith('.md');
            if (useCodeFences && !isBinary) {
                const ext = path.extname(file.relativePath).slice(1);
                const language = this.getLanguageForExtension(ext);
                contentText = `\`\`\`${language}\n${contentText}\n\`\`\``;
            }
            return [
                separator,
                `FILE: ${file.relativePath}`,
                separator,
                contentText,
                ''
            ].join('\n');
        }
        catch (error) {
            return [
                separator,
                `FILE: ${file.relativePath}`,
                separator,
                `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ''
            ].join('\n');
        }
    }
    getLanguageForExtension(ext) {
        const langMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'py': 'python',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'cc': 'cpp',
            'cxx': 'cpp',
            'cs': 'csharp',
            'php': 'php',
            'rb': 'ruby',
            'go': 'go',
            'rs': 'rust',
            'swift': 'swift',
            'kt': 'kotlin',
            'dart': 'dart',
            'json': 'json',
            'xml': 'xml',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'yml': 'yaml',
            'yaml': 'yaml',
            'md': 'markdown',
            'sh': 'bash',
            'sql': 'sql'
        };
        return langMap[ext.toLowerCase()] || '';
    }
    async writeDigest(summary, tree, content) {
        const outputFileName = this.config.get('outputFileName', 'digest.txt');
        const outputPath = path.join(this.workspaceRoot, outputFileName);
        const fullContent = [
            summary,
            '',
            tree,
            '',
            content
        ].join('\n');
        await writeFile(outputPath, fullContent, 'utf8');
        return outputPath;
    }
}
exports.DigestGenerator = DigestGenerator;
//# sourceMappingURL=DigestGenerator.js.map