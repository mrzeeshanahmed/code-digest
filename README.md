# Code Digest Extension

A VS Code extension for code digest features.

## Structure

```
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts
│   ├── panels/
│   │   └── SidebarProvider.ts
│   ├── utils/
│   │   ├── ignore.ts
│   │   ├── tree.ts
│   │   ├── binary.ts
│   │   └── tokens.ts
│   └── webview/
│       ├── index.html
│       ├── main.js
│       └── styles.css
└── README.md
```


# Code Digest - VS Code Extension

Generate Gitingest-style prompt-friendly digests of your local codebase.

## Features

- **Local Processing**: No network calls, everything runs locally
- **Sidebar UI**: Easy-to-use interface in VS Code sidebar
- **Flexible Filtering**: Choose between curated mode (common code files) or all text files
- **Gitignore Support**: Respects .gitignore and .gitingestignore files
- **Binary Handling**: Skip or include binary files with base64 encoding
- **Custom Patterns**: Add your own include/exclude glob patterns
- **Markdown Support**: Optional code fences for .md output files

## Usage

1. Open a workspace folder in VS Code
2. Look for "Code Digest" in the Explorer sidebar
3. Configure your options (or use defaults)
4. Click "Generate Digest"
5. The digest file will be created in your workspace root and opened automatically

## Settings

All settings can be configured through the sidebar UI or VS Code settings:

- `codeDigest.outputFileName`: Output file name (default: "digest.txt")
- `codeDigest.mode`: "curated" or "allText" (default: "curated")
- `codeDigest.respectGitignore`: Honor .gitignore files (default: true)
- `codeDigest.includeDotfiles`: Include dotfiles and config files (default: true)
- `codeDigest.includeGitDir`: Include .git directory (default: false)
- `codeDigest.maxFileSizeKB`: Max file size in KB (default: 10240)
- `codeDigest.includeBinary`: Include binary files (default: false)
- `codeDigest.additionalIncludeGlobs`: Extra patterns to include
- `codeDigest.additionalExcludeGlobs`: Extra patterns to exclude
- `codeDigest.markdownCodeFences`: Use code fences in .md files (default: false)

## Output Format

The generated digest follows the Gitingest format:

1. **Summary**: Directory name, file count, timestamp, token estimate
2. **Directory Structure**: Tree view of included files/directories
3. **File Contents**: Each file with clear separators and headers

## Modes

### Curated Mode (Default)
Includes common source code and configuration files:
- Source code: .py, .js, .ts, .java, .cpp, .go, .rs, .swift, etc.
- Config files: package.json, pyproject.toml, .gitignore, .env, etc.
- Documentation: README, LICENSE, CHANGELOG files

### All Text Mode
Includes any file that appears to be text-based using content heuristics.

## Commands

- **Code Digest: Create Digest** (`codeDigest.create`): Generate a digest file

## Requirements

- VS Code 1.85.0 or higher
- Node.js 18+ (for development)

## Known Limitations

- Single workspace folder support (multi-root workspaces prompt for selection)
- Symlinks are not followed, only noted as symlinks
- Token estimation is a simple heuristic, not as accurate as tiktoken
- Very large repositories may take some time to process

## Security & Privacy

- All processing happens locally
- No network calls or external services
- Respects .gitignore by default to avoid including secrets
- Warns when including .git directory or binary files

## Development

