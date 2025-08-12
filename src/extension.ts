import * as vscode from 'vscode';
import { SidebarProvider } from './panels/SidebarProvider';
import { DigestGenerator } from './utils/DigestGenerator';

export function activate(context: vscode.ExtensionContext) {
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    const digestGenerator = new DigestGenerator();

    // Register sidebar view
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('codeDigest.view', sidebarProvider)
    );

    // Register command
    const generateCommand = vscode.commands.registerCommand('codeDigest.create', async () => {
        await digestGenerator.generateDigest();
    });

    context.subscriptions.push(generateCommand);

    // Listen for messages from sidebar
    sidebarProvider.onDidReceiveMessage(async (message: any) => {
        switch (message.command) {
            case 'generate':
                await digestGenerator.generateDigest();
                break;
            case 'updateSetting':
                await vscode.workspace.getConfiguration('codeDigest').update(
                    message.key,
                    message.value,
                    vscode.ConfigurationTarget.Workspace
                );
                break;
        }
    });
}

export function deactivate() {}
