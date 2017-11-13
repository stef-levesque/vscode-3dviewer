'use strict';

import { commands, Disposable, ExtensionContext, Uri, ViewColumn } from 'vscode';
import MeshPreviewContentProvider from './contentProvider';

let _disposable: Disposable[] = [];

export function activate(context: ExtensionContext) {

    context.subscriptions.push(new Disposable(() => Disposable.from(..._disposable).dispose()));
    
    _disposable.push( new MeshPreviewContentProvider(context) );
    
    _disposable.push( commands.registerCommand("3dviewer.previewMesh", (fileUri: Uri) => {
        if (fileUri) {
            let previewUri = fileUri.with({scheme: 'preview3d'});
            commands.executeCommand('vscode.previewHtml', previewUri, ViewColumn.Active, "3D Mesh Preview");
            console.log(previewUri.toString());
        }
    }));

}
