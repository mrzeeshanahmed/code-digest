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
    const extTxt = document.getElementById('extTxt');
    const extMd = document.getElementById('extMd');
    const respectGitignore = document.getElementById('respectGitignore');
    const includeDotfiles = document.getElementById('includeDotfiles');
    const includeGitDir = document.getElementById('includeGitDir');
    const maxFileSizeKB = document.getElementById('maxFileSizeKB');
    const includeBinary = document.getElementById('includeBinary');
    const additionalIncludeGlobs = document.getElementById('additionalIncludeGlobs');
    const additionalExcludeGlobs = document.getElementById('additionalExcludeGlobs');
    const markdownCodeFences = document.getElementById('markdownCodeFences');
    const treeContent = document.getElementById('treeContent');
    const extCheckboxes = document.getElementById('extCheckboxes');

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
        // Only set filename (no extension)
        let fname = currentSettings.outputFileName || 'digest.txt';
        if (fname.endsWith('.txt')) fname = fname.slice(0, -4);
        if (fname.endsWith('.md')) fname = fname.slice(0, -3);
        outputFileName.value = fname;
        // Set extension checkboxes
        if (fname.endsWith('.md') || (currentSettings.outputFileName && currentSettings.outputFileName.endsWith('.md'))) {
            extMd.checked = true;
            extTxt.checked = false;
        } else {
            extTxt.checked = true;
            extMd.checked = false;
        }
        respectGitignore.checked = currentSettings.respectGitignore !== false;
        includeDotfiles.checked = currentSettings.includeDotfiles !== false;
        includeGitDir.checked = currentSettings.includeGitDir === true;
        maxFileSizeKB.value = currentSettings.maxFileSizeKB || 10240;
        includeBinary.checked = currentSettings.includeBinary === true;
        additionalIncludeGlobs.value = (currentSettings.additionalIncludeGlobs || []).join('\n');
        additionalExcludeGlobs.value = (currentSettings.additionalExcludeGlobs || []).join('\n');
        markdownCodeFences.checked = currentSettings.markdownCodeFences === true;
        // Render tree
        if (treeContent && currentSettings.tree) {
            treeContent.textContent = currentSettings.tree;
        }
        // Render extension checkboxes
        if (extCheckboxes && Array.isArray(currentSettings.extensions)) {
            extCheckboxes.innerHTML = '';
            currentSettings.extensions.forEach(ext => {
                const id = `ext_${ext}`;
                const label = document.createElement('label');
                label.className = 'ext-label';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = id;
                checkbox.value = ext;
                checkbox.checked = true;
                checkbox.className = 'ext-checkbox';
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(' .' + ext));
                extCheckboxes.appendChild(label);
            });
        }
    }

    function updateSetting(key, value) {
        vscode.postMessage({
            command: 'updateSetting',
            key: key,
            value: value
        });
    }

    // Add event listeners for form changes
    outputFileName.addEventListener('change', () => {
        let ext = extTxt.checked ? '.txt' : (extMd.checked ? '.md' : '.txt');
        updateSetting('outputFileName', outputFileName.value + ext);
    });
    extTxt.addEventListener('change', () => {
        if (extTxt.checked) {
            extMd.checked = false;
            updateSetting('outputFileName', outputFileName.value + '.txt');
        } else if (!extMd.checked) {
            extTxt.checked = true; // Always one selected
        }
    });
    extMd.addEventListener('change', () => {
        if (extMd.checked) {
            extTxt.checked = false;
            updateSetting('outputFileName', outputFileName.value + '.md');
        } else if (!extTxt.checked) {
            extMd.checked = true; // Always one selected
        }
    });
    // Remove mode logic
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

    // Refresh button handler
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'refreshExtension' });
        });
    }

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
        document.getElementById('resultsContent').innerHTML = `
            <p><strong>Files analyzed:</strong> ${data.fileCount}</p>
            <p><strong>Generated:</strong> ${data.outputPath}</p>
            <p><strong>Estimated tokens:</strong> ${data.tokenEstimate}</p>
        `;
        // Fully reset UI after showing results
        setTimeout(() => {
            results.classList.add('hidden');
            progress.classList.add('hidden');
            generateBtn.disabled = false;
            vscode.postMessage({ command: 'refreshExtension' });
        }, 2000);
    }

    function showError(error) {
        progress.classList.add('hidden');
        results.classList.remove('hidden');
        generateBtn.disabled = false;
        document.getElementById('resultsContent').innerHTML = `
            <div class="error">
                <strong>Error:</strong> ${error}
            </div>
        `;
        setTimeout(() => {
            results.classList.add('hidden');
            progress.classList.add('hidden');
            generateBtn.disabled = false;
        }, 2000);
    }
})();
