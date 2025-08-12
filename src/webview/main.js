(function() {
    const vscode = acquireVsCodeApi();
    let currentSettings = {};

    // Get DOM elements
    const form = document.getElementById('digestForm');
    const generateBtn = document.getElementById('generateBtn');
    const progress = document.getElementById('progress');
    const results = document.getElementById('results');
    const openFileBtn = document.getElementById('openFileBtn');

    // Form elements
    const outputFileName = document.getElementById('outputFileName');
    const mode = document.getElementById('mode');
    const respectGitignore = document.getElementById('respectGitignore');
    const includeDotfiles = document.getElementById('includeDotfiles');
    const includeGitDir = document.getElementById('includeGitDir');
    const maxFileSizeKB = document.getElementById('maxFileSizeKB');
    const includeBinary = document.getElementById('includeBinary');
    const additionalIncludeGlobs = document.getElementById('additionalIncludeGlobs');
    const additionalExcludeGlobs = document.getElementById('additionalExcludeGlobs');
    const markdownCodeFences = document.getElementById('markdownCodeFences');

    // Listen for messages from extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateSettings':
                currentSettings = message.settings;
                updateFormFromSettings();
                break;
            case 'progress':
                updateProgress(message.text);
                break;
            case 'complete':
                showResults(message);
                break;
            case 'error':
                showError(message.error);
                break;
        }
    });

    function updateFormFromSettings() {
        outputFileName.value = currentSettings.outputFileName || 'digest.txt';
        mode.value = currentSettings.mode || 'curated';
        respectGitignore.checked = currentSettings.respectGitignore !== false;
        includeDotfiles.checked = currentSettings.includeDotfiles !== false;
        includeGitDir.checked = currentSettings.includeGitDir === true;
        maxFileSizeKB.value = currentSettings.maxFileSizeKB || 10240;
        includeBinary.checked = currentSettings.includeBinary === true;
        additionalIncludeGlobs.value = (currentSettings.additionalIncludeGlobs || []).join('\n');
        additionalExcludeGlobs.value = (currentSettings.additionalExcludeGlobs || []).join('\n');
        markdownCodeFences.checked = currentSettings.markdownCodeFences === true;
    }

    function updateSetting(key, value) {
        vscode.postMessage({
            command: 'updateSetting',
            key: key,
            value: value
        });
    }

    // Add event listeners for form changes
    outputFileName.addEventListener('change', () => updateSetting('outputFileName', outputFileName.value));
    mode.addEventListener('change', () => updateSetting('mode', mode.value));
    respectGitignore.addEventListener('change', () => updateSetting('respectGitignore', respectGitignore.checked));
    includeDotfiles.addEventListener('change', () => updateSetting('includeDotfiles', includeDotfiles.checked));
    includeGitDir.addEventListener('change', () => updateSetting('includeGitDir', includeGitDir.checked));
    maxFileSizeKB.addEventListener('change', () => updateSetting('maxFileSizeKB', parseInt(maxFileSizeKB.value)));
    includeBinary.addEventListener('change', () => updateSetting('includeBinary', includeBinary.checked));
    markdownCodeFences.addEventListener('change', () => updateSetting('markdownCodeFences', markdownCodeFences.checked));

    additionalIncludeGlobs.addEventListener('change', () => {
        const globs = additionalIncludeGlobs.value.split('\n').filter(line => line.trim());
        updateSetting('additionalIncludeGlobs', globs);
    });

    additionalExcludeGlobs.addEventListener('change', () => {
        const globs = additionalExcludeGlobs.value.split('\n').filter(line => line.trim());
        updateSetting('additionalExcludeGlobs', globs);
    });

    // Generate button handler
    generateBtn.addEventListener('click', () => {
        showProgress();
        vscode.postMessage({
            command: 'generate'
        });
    });

    // Open file button handler
    openFileBtn.addEventListener('click', () => {
        vscode.postMessage({
            command: 'openFile'
        });
    });

    function showProgress() {
        progress.classList.remove('hidden');
        results.classList.add('hidden');
        generateBtn.disabled = true;
    }

    function updateProgress(text) {
        document.getElementById('progressText').textContent = text;
    }

    function showResults(data) {
        progress.classList.add('hidden');
        results.classList.remove('hidden');
        generateBtn.disabled = false;
        // Reset spinner and allow new generation
        setTimeout(() => {
            results.classList.add('hidden');
            generateBtn.disabled = false;
        }, 3000);
        document.getElementById('resultsContent').innerHTML = `
            <p><strong>Files analyzed:</strong> ${data.fileCount}</p>
            <p><strong>Generated:</strong> ${data.outputPath}</p>
            <p><strong>Estimated tokens:</strong> ${data.tokenEstimate}</p>
        `;
    }

    function showError(error) {
        progress.classList.add('hidden');
        results.classList.remove('hidden');
        generateBtn.disabled = false;
        setTimeout(() => {
            results.classList.add('hidden');
            generateBtn.disabled = false;
        }, 3000);
        document.getElementById('resultsContent').innerHTML = `
            <div class="error">
                <strong>Error:</strong> ${error}
            </div>
        `;
    }
})();
