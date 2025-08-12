# Code Digest VS Code Extension

Code Digest is a Visual Studio Code extension that generates a prompt-friendly digest of your local workspace. The digest includes a directory tree, per-file content blocks, and summary information, making it easy to share or analyze your codebase.

## Features
- Sidebar UI for configuration and digest generation
- Directory tree view of your workspace
- Select file extensions to export
- Exclude binary, image, video, and document files
- Output digest as `.txt` or `.md` file
- Saves digest to workspace root and opens it automatically
- Works entirely locally (no cloud dependencies)

## Installation

1. **Clone the repository:**
	```sh
	git clone https://github.com/mrzeeshanahmed/code-digest.git
	cd code-digest
	```

2. **Install dependencies:**
	```sh
	npm install
	```

3. **Compile the extension:**
	```sh
	npm run compile
	```

4. **Launch in VS Code:**
	- Open the folder in VS Code (`File > Open Folder...`).
	- Press `F5` to start the Extension Development Host.
	- The Code Digest sidebar will appear in the Activity Bar.

## Usage

1. **Open the Code Digest sidebar** from the Activity Bar.
2. **Configure options:**
	- Enter the output filename (without extension).
	- Choose `.txt` or `.md` for the output file type.
	- Select which file extensions to include.
	- Adjust other options as needed (respect .gitignore, include dotfiles, etc.).
3. **Click "Generate Digest"** to create the digest file.
4. The digest will be saved to your workspace root and opened automatically.
5. Use the **Refresh Extension** button to reload the sidebar if needed.

## Requirements
- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- [VS Code](https://code.visualstudio.com/) (v1.85.0 or newer recommended)

## Development
- Source code is in the `src/` folder.
- Webview assets are in `src/webview/`.
- Utility logic is in `src/utils/`.
- Build output is in the `out/` folder.

## Contributing
Pull requests and issues are welcome! Please open an issue for bugs or feature requests.

## License
MIT

---

**Quick Start:**
1. Clone repo
2. Run `npm install`
3. Run `npm run compile`
4. Press `F5` in VS Code
5. Use the sidebar to generate your digest!
### Curated Mode (Default)

