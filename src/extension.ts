import * as vscode from 'vscode';

import { MeshViewerProvider } from './MeshViewerProvider';
import { handleOpenIn3dViewerCommand } from './commands';

export function activate(context: vscode.ExtensionContext) {

    // Register our custom editor providers
    if (+vscode.version.match(/1\.(\d+)/)![1] >= 45) {
        context.subscriptions.push(MeshViewerProvider.register(context));
        context.subscriptions.push(vscode.commands.registerCommand('3dviewer.openIn3dViewer', handleOpenIn3dViewerCommand));
    }
}
