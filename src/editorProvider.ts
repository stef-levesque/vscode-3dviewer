'use strict';

import { Disposable, Uri, workspace, ExtensionContext, commands, ViewColumn, window } from 'vscode';

import * as Path from 'path';

export default class EditorProvider {
    
    private static s_instance?: EditorProvider = null;
    private static s_editorUri?: Uri = null;
    private _disposables: Disposable[] = [];

    constructor(
        private context: ExtensionContext
    ) {
        if(EditorProvider.s_instance) {
            EditorProvider.s_instance.dispose();
        }
        EditorProvider.s_instance = this;
        EditorProvider.s_editorUri = Uri.file(context.asAbsolutePath(Path.join('media', 'editor', 'index.html')));
        
        this._disposables.push( commands.registerCommand("3dviewer.openEditor", () => {
            commands.executeCommand('vscode.previewHtml', EditorProvider.s_editorUri, ViewColumn.Active, "THREE.js Editor").then( (e) => {
                this.patchEditor();
            });
        }) );

        this._disposables.push( commands.registerCommand("3dviewer.openInEditor", (fileUri: Uri) => {
            commands.executeCommand('vscode.previewHtml', EditorProvider.s_editorUri, ViewColumn.Active, "THREE.js Editor").then( (e) => {
                this.patchEditor().then( () => {
                    EditorProvider.importFile(fileUri);
                });
            });
        }) );

        this._disposables.push( commands.registerCommand("3dviewer.openUrlInEditor", () => {
            window.showInputBox({prompt: "Enter URL to open", placeHolder: "http://..."}).then((value) => {
                if (value) {
                    let fileUri = Uri.parse(value);
                    EditorProvider.importFile(fileUri);
                }
            });
        }) );

        this._disposables.push( commands.registerCommand("3dviewer.onMessage", EditorProvider.onMessage) );
        this._disposables.push( commands.registerCommand("3dviewer.sendCommand", EditorProvider.sendCommand) );
        this._disposables.push( commands.registerCommand("3dviewer.importFile", EditorProvider.importFile) );

    }

    static get instance() {
        return EditorProvider.s_instance;
    }

    static sendCommand(command: string): Thenable<boolean> {
        if (EditorProvider.s_editorUri) {
            return commands.executeCommand<boolean>('_workbench.htmlPreview.postMessage', EditorProvider.s_editorUri, {eval: command})
        }
        return Promise.resolve(false);
    }

    static importFile(uri: Uri): Thenable<boolean> {
        return EditorProvider.sendCommand(`
            if (!window.fileLoader) {
                window.fileLoader = new THREE.FileLoader();
                window.fileLoader.crossOrigin = '';
                window.fileLoader.setResponseType( 'arraybuffer' );
            }
            window.fileLoader.load('${uri.toString()}', (data) => { 
                editor.loader.loadFile( new File([data], '${Path.basename(uri.fsPath)}'), '${Path.dirname(uri.toString())}/' ) 
            });
        `);
    }

    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    private patchEditor() {
        return Promise.all<boolean, boolean, boolean>([
            // VSCode webview doesn't support modal window
            EditorProvider.sendCommand('window.alert = window.parent.alert'),
            EditorProvider.sendCommand('window.confirm = window.parent.confirm'),

            // Send message back to host
            EditorProvider.sendCommand('window.messageHost = (m) => {window.parent.postMessage({command: "did-click-link",data: `command:3dviewer.onMessage?${encodeURIComponent(JSON.stringify(m))}`}, "file://");}')
        ]);
    }

    private static onMessage(e) {
        console.log(e);
    }

}
