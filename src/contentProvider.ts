'use strict';

import { Disposable, TextDocumentContentProvider, Uri, EventEmitter, Event, workspace, ExtensionContext } from 'vscode';

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

    private getScripts(): string {
        const scripts = [
            this.getMediaPath('three.min.js'), 
            this.getMediaPath('inflate.min.js'),
            this.getMediaPath('OrbitControls.js'),
            this.getMediaPath('ColladaLoader.js'),
            this.getMediaPath('FBXLoader.js'),
            this.getMediaPath('TDSLoader.js'),
            this.getMediaPath('OBJLoader.js'),
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
                    <script>
                        var meshToLoad = '${uri.with({scheme: 'file'}).toString()}';
                    </script>
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
