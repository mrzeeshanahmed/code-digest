import * as fs from 'fs';
import * as path from 'path';
import ignore, { Ignore } from 'ignore';

export class IgnoreFilter {
    private ignoreInstance: Ignore;
    private defaultIgnores: string[] = [
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

    constructor() {
        this.ignoreInstance = ignore();
    }

    async initialize(rootPath: string): Promise<void> {
        // Add default ignores
        this.ignoreInstance.add(this.defaultIgnores);

        // Load .gitignore files
        await this.loadIgnoreFiles(rootPath, '.gitignore');
        await this.loadIgnoreFiles(rootPath, '.gitingestignore');
    }

    private async loadIgnoreFiles(rootPath: string, filename: string): Promise<void> {
        try {
            await this.walkDirectory(rootPath, async (dirPath) => {
                const ignoreFilePath = path.join(dirPath, filename);
                try {
                    const content = await fs.promises.readFile(ignoreFilePath, 'utf8');
                    const relativeDirPath = path.relative(rootPath, dirPath);
                    const patterns = content
                        .split('\n')
                        .map((line: string) => line.trim())
                        .filter((line: string) => line && !line.startsWith('#'))
                        .map((pattern: string) => {
                            if (relativeDirPath && !pattern.startsWith('/')) {
                                return path.join(relativeDirPath, pattern).replace(/\\/g, '/');
                            }
                            return pattern.startsWith('/') ? pattern.slice(1) : pattern;
                        });
                    
                    this.ignoreInstance.add(patterns);
                } catch {
                    // Ignore files that can't be read
                }
            });
        } catch {
            // Ignore directory traversal errors
        }
    }

    private async walkDirectory(dirPath: string, callback: (dir: string) => Promise<void>): Promise<void> {
        await callback(dirPath);
        
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory() && entry.name !== '.git') {
                    const subDirPath = path.join(dirPath, entry.name);
                    await this.walkDirectory(subDirPath, callback);
                }
            }
        } catch {
            // Ignore directories we can't read
        }
    }

    shouldIgnore(relativePath: string): boolean {
        return this.ignoreInstance.ignores(relativePath);
    }
}
