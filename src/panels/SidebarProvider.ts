import * as vscode from 'vscode';

export class SidebarProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _onDidReceiveMessage = new vscode.EventEmitter<any>();

    public readonly onDidReceiveMessage = this._onDidReceiveMessage.event;

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webview')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(
            (message: any) => {
                this._onDidReceiveMessage.fire(message);
            },
            undefined,
        );

        // Send current settings to webview
        this._updateWebviewSettings();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e: any) => {
            if (e.affectsConfiguration('codeDigest')) {
                this._updateWebviewSettings();
            }
        });
    }

    public postMessage(message: any) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    private _updateWebviewSettings() {
        const config = vscode.workspace.getConfiguration('codeDigest');
        this.postMessage({
            command: 'updateSettings',
            settings: {
                outputFileName: config.get('outputFileName'),
                mode: config.get('mode'),
                respectGitignore: config.get('respectGitignore'),
                includeDotfiles: config.get('includeDotfiles'),
                includeGitDir: config.get('includeGitDir'),
                maxFileSizeKB: config.get('maxFileSizeKB'),
                includeBinary: config.get('includeBinary'),
                additionalIncludeGlobs: config.get('additionalIncludeGlobs'),
                additionalExcludeGlobs: config.get('additionalExcludeGlobs'),
                markdownCodeFences: config.get('markdownCodeFences')
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'main.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'styles.css')
        );
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${styleUri}" rel="stylesheet">
<title>Code Digest</title>
</head>
<body>
<div class="container">
<h2>Create Code Digest</h2>
<p class="subtitle">Gitingest-style local digest</p>
<form id="digestForm">
<div class="form-group">
<label for="outputFileName">Output File:</label>
<input type="text" id="outputFileName" placeholder="digest.txt">
</div>
<div class="form-group">
<label for="mode">Mode:</label>
<select id="mode">
<option value="curated">Curated (common code files)</option>
<option value="allText">All text-like files</option>
</select>
</div>
<div class="form-group">
<label><input type="checkbox" id="respectGitignore"> Respect .gitignore</label>
</div>
<div class="form-group">
<label><input type="checkbox" id="includeDotfiles"> Include dotfiles</label>
</div>
<div class="form-group">
<label><input type="checkbox" id="includeGitDir"> Include .git directory</label>
<small class="warning">⚠️ May include sensitive data and large files</small>
</div>
<div class="form-group">
<label for="maxFileSizeKB">Max file size (KB):</label>
<input type="number" id="maxFileSizeKB" min="1" max="102400">
</div>
<div class="form-group">
<label><input type="checkbox" id="includeBinary"> Include binary files</label>
<small class="warning">⚠️ May produce very large output</small>
</div>
<div class="form-group">
<label for="additionalIncludeGlobs">Additional include patterns:</label>
<textarea id="additionalIncludeGlobs" placeholder="*.config&#10;**/*.yml" rows="2"></textarea>
<small>One glob pattern per line</small>
</div>
<div class="form-group">
<label for="additionalExcludeGlobs">Additional exclude patterns:</label>
<textarea id="additionalExcludeGlobs" placeholder="*.temp&#10;cache/**" rows="2"></textarea>
<small>One glob pattern per line</small>
</div>
<div class="form-group">
<label><input type="checkbox" id="markdownCodeFences"> Use markdown code fences</label>
<small>Only applies to .md output files</small>
</div>
<button type="button" id="generateBtn" class="generate-btn">Generate Digest</button>
</form>
<div id="progress" class="progress hidden">
<div class="spinner"></div>
<span id="progressText">Generating digest...</span>
</div>
<div id="results" class="results hidden">
<h3>Results</h3>
<div id="result"></div>
</div>
</div>
<script src="${scriptUri}"></script>
</body>
</html>`;
    }
}