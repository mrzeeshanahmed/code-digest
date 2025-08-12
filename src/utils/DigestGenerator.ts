import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { IgnoreFilter } from './ignore';
import { TreeBuilder } from './tree';
import { BinaryDetector } from './binary';
import { TokenEstimator } from './tokens';
import { minimatch } from 'minimatch';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const lstat = promisify(fs.lstat);
const readlink = promisify(fs.readlink);

interface FileEntry {
    relativePath: string;
    fullPath: string;
    isSymlink: boolean;
    symlinkTarget?: string;
}

export class DigestGenerator {
    private config: vscode.WorkspaceConfiguration;
    private workspaceRoot: string;
    private ignoreFilter: IgnoreFilter;
    private treeBuilder: TreeBuilder;
    private binaryDetector: BinaryDetector;
    private tokenEstimator: TokenEstimator;

    constructor() {
        this.config = vscode.workspace.getConfiguration('codeDigest');
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        this.ignoreFilter = new IgnoreFilter();
        this.treeBuilder = new TreeBuilder();
        this.binaryDetector = new BinaryDetector();
        this.tokenEstimator = new TokenEstimator();
    }

    async generateDigest(): Promise<void> {
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
                if (this.config.get<boolean>('respectGitignore')) {
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

                vscode.window.showInformationMessage(
                    `Code digest generated: ${path.basename(outputPath)}`
                );
            });

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to generate digest: ${message}`);
        }
    }

    private async collectFiles(): Promise<FileEntry[]> {
        const files: FileEntry[] = [];
        const mode = this.config.get<string>('mode', 'curated');

        await this.traverseDirectory(this.workspaceRoot, '', files, mode);

        // Sort files by path
        files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

        return files;
    }

    private async traverseDirectory(
        fullPath: string,
        relativePath: string,
        files: FileEntry[],
        mode: string
    ): Promise<void> {
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
                        let symlinkTarget: string | undefined;
                        try {
                            symlinkTarget = await readlink(entryFullPath);
                        } catch {
                            symlinkTarget = '<broken link>';
                        }

                        files.push({
                            relativePath: entryRelativePath,
                            fullPath: entryFullPath,
                            isSymlink: true,
                            symlinkTarget
                        });
                    } else if (stats.isDirectory()) {
                        await this.traverseDirectory(entryFullPath, entryRelativePath, files, mode);
                    } else if (stats.isFile()) {
                        if (this.shouldIncludeFile(entry, entryRelativePath, stats.size, mode)) {
                            files.push({
                                relativePath: entryRelativePath,
                                fullPath: entryFullPath,
                                isSymlink: false
                            });
                        }
                    }
                } catch (error) {
                    // Skip files we can't stat
                    console.warn(`Could not stat ${entryFullPath}:`, error);
                }
            }
        } catch (error) {
            console.warn(`Could not read directory ${fullPath}:`, error);
        }
    }

    private shouldSkipEntry(name: string, relativePath: string, fullPath: string): boolean {
        // Check .git directory
        if (name === '.git') {
            return !this.config.get<boolean>('includeGitDir');
        }

        // Check dotfiles
        if (name.startsWith('.') && !this.config.get<boolean>('includeDotfiles')) {
            return true;
        }

        // Check ignore patterns
        if (this.config.get<boolean>('respectGitignore')) {
            if (this.ignoreFilter.shouldIgnore(relativePath)) {
                return true;
            }
        }

        // Check additional exclude globs
        const excludeGlobs = this.config.get<string[]>('additionalExcludeGlobs', []);
        for (const glob of excludeGlobs) {
            if (minimatch(relativePath, glob)) {
                // Check if force-included
                const includeGlobs = this.config.get<string[]>('additionalIncludeGlobs', []);
                const forceIncluded = includeGlobs.some(includeGlob => 
                    minimatch(relativePath, includeGlob)
                );
                if (!forceIncluded) {
                    return true;
                }
            }
        }

        return false;
    }

    private shouldIncludeFile(name: string, relativePath: string, size: number, mode: string): boolean {
        // Check file size
        const maxSizeBytes = (this.config.get<number>('maxFileSizeKB', 10240) * 1024);
        if (size > maxSizeBytes) {
            return false;
        }

        // Check additional include globs (force include)
        const includeGlobs = this.config.get<string[]>('additionalIncludeGlobs', []);
        if (includeGlobs.some(glob => minimatch(relativePath, glob))) {
            return true;
        }

        if (mode === 'curated') {
            return this.isCuratedFile(name, relativePath);
        } else if (mode === 'allText') {
            // For allText mode, we'll need to check if it's text-like
            // This is a heuristic - in practice you might want to read a small chunk
            return this.looksLikeTextFile(name);
        }

        return false;
    }

    private isCuratedFile(name: string, relativePath: string): boolean {
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

    private looksLikeTextFile(name: string): boolean {
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

    private async processFiles(files: FileEntry[]): Promise<{
        summary: string;
        tree: string;
        content: string;
    }> {
        const rootName = path.basename(this.workspaceRoot);
        const timestamp = new Date().toISOString();
        
        // Build tree
        const tree = this.treeBuilder.buildTree(files, rootName);
        
        // Process file contents
        const contentBlocks: string[] = [];
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

    private async processFileContent(file: FileEntry): Promise<string> {
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
            const includeBinary = this.config.get<boolean>('includeBinary', false);
            
            let contentText: string;
            
            if (isBinary && !includeBinary) {
                contentText = '[Binary file]';
            } else if (isBinary && includeBinary) {
                try {
                    contentText = buffer.toString('utf8');
                } catch {
                    contentText = `Content (base64):\n${buffer.toString('base64')}`;
                }
            } else {
                contentText = buffer.toString('utf8');
            }

            // Apply markdown code fences if enabled and output is .md
            const outputFileName = this.config.get<string>('outputFileName', 'digest.txt');
            const useCodeFences = this.config.get<boolean>('markdownCodeFences', false) && 
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

        } catch (error) {
            return [
                separator,
                `FILE: ${file.relativePath}`,
                separator,
                `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ''
            ].join('\n');
        }
    }

    private getLanguageForExtension(ext: string): string {
        const langMap: Record<string, string> = {
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

    private async writeDigest(summary: string, tree: string, content: string): Promise<string> {
        const outputFileName = this.config.get<string>('outputFileName', 'digest.txt');
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
