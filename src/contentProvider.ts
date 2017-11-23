'use strict';

import { Disposable, TextDocumentContentProvider, Uri, EventEmitter, Event, workspace, ExtensionContext, commands, ViewColumn } from 'vscode';

import * as path from 'path';

export default class MeshPreviewContentProvider implements TextDocumentContentProvider {
    
    private static s_instance: MeshPreviewContentProvider = null;
    private _disposables: Disposable[] = [];    
    private _onDidChange = new EventEmitter<Uri>();

    constructor(
        private context: ExtensionContext
    ) {
        if(MeshPreviewContentProvider.s_instance) {
            MeshPreviewContentProvider.s_instance.dispose();
        }
        MeshPreviewContentProvider.s_instance = this;

        this._disposables.push(
            workspace.registerTextDocumentContentProvider('preview3d', this)
        );

        this._disposables.push( commands.registerCommand("3dviewer.openInViewer", (fileUri: Uri) => {
            if (fileUri) {
                let previewUri = fileUri.with({scheme: 'preview3d'});
                commands.executeCommand('vscode.previewHtml', previewUri, ViewColumn.Active, "3D Mesh Preview");
                console.log(previewUri.toString());
            }
        }));
    }

    static get instance() {
        return MeshPreviewContentProvider.s_instance;
    }

    public dispose(): void {
        this._onDidChange.dispose();
        if(MeshPreviewContentProvider.s_instance) {
            MeshPreviewContentProvider.s_instance.dispose();
            MeshPreviewContentProvider.s_instance = null;
        }
        this._disposables.forEach(d => d.dispose());
    }

    private getMediaPath(mediaFile: string): string {
		return Uri.file(this.context.asAbsolutePath(path.join('media', mediaFile))).toString();
    }

    private getSettings(uri: Uri): string {
        let config = workspace.getConfiguration('3dviewer');
        let initialData = {
            fileToLoad: uri.with({scheme: 'file'}).toString(),
            wireframe: config.get('wireframe', false),
            background: config.get('background', '#8f8f8f'),
            boundingBox: config.get('boundingBox', false),
            grid: config.get('grid', true),
            gridSize: config.get('gridSize', 32),
            near: config.get('near', 0.1),
            far: config.get('far', 1000000)
        }
        return `<meta id="vscode-3dviewer-data" data-settings="${JSON.stringify(initialData).replace(/"/g, '&quot;')}">`
    }

    private getScripts(): string {
        const scripts = [
            this.getMediaPath('three.min.js'), 
            this.getMediaPath('inflate.min.js'),
            this.getMediaPath('dat.gui.min.js'),
            this.getMediaPath('OrbitControls.js'),
            this.getMediaPath('ColladaLoader.js'),
            this.getMediaPath('FBXLoader.js'),
            this.getMediaPath('TDSLoader.js'),
            this.getMediaPath('OBJLoader.js'),
            this.getMediaPath('STLLoader.js'),
            this.getMediaPath('viewer.js')
        ];
        return scripts
            .map(source => `<script src="${source}"></script>`)
            .join('\n');
    }

    public provideTextDocumentContent(uri: Uri): Thenable<string> {
        return new Promise( async (resolve) => {
            resolve(`
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <title>three.js webgl - FBX loader</title>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0">
                    ${this.getSettings(uri)}
                    <base href="${this.getMediaPath('/')}">
                    <style>
                        body {
                            font-family: Monospace;
                            background-color: #0f0;
                            color: #f00;
                            margin: 0px;
                            padding: 0px 0px;
                            overflow: hidden;
                        }
                    </style>
                </head>
                <body>
                    ${this.getScripts()}
                </body>
            </html>
            `
            );
        });
    }

    get onDidChange(): Event<Uri> {
        return this._onDidChange.event;
    }
    
    public update(uri: Uri) {
        this._onDidChange.fire(uri);
    }
}
