import * as vscode from 'vscode';

import { MeshViewerProvider } from './MeshViewerProvider';

export function activate(context: vscode.ExtensionContext) {

    // Register our custom editor providers
    if (+vscode.version.match(/1\.(\d+)/)![1] >= 45) {
        context.subscriptions.push(MeshViewerProvider.register(context));
    }
    
}
