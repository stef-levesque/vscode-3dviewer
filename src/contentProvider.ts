'use strict';

import {
    commands,
    window,
    workspace,
    Disposable,
    Uri,
    ViewColumn,
    WebviewPanel,
    ExtensionContext,
    WebviewPanelSerializer,
} from 'vscode';

import * as path from 'path';

export default class ViewerProvider {
    private static s_instance?: ViewerProvider = null;
    
    private readonly _extensionPath: string;
    private _viewers: ViewerPanel[] = [];
    private _disposables: Disposable[] = [];    

    constructor(context: ExtensionContext) {
        if (ViewerProvider.s_instance) {
            ViewerProvider.s_instance.dispose();
        }
        ViewerProvider.s_instance = this;

        this._extensionPath = context.extensionPath;

        this._disposables.push(commands.registerCommand('3dviewer.openInViewer', (fileUri: Uri) => {
            if (fileUri) {
                for (const v of this._viewers) {
                    if (v.fileUri.toString() === fileUri.toString()) {
                        v.reveal();
                        return;
                    }
                }

                this._viewers.push(new ViewerPanel(this._extensionPath, fileUri));
            }
        }));

        this._disposables.push(commands.registerCommand("3dviewer.openUrlInViewer", () => {
            window.showInputBox({ prompt: "Enter URL to open", placeHolder: "http://..." }).then(async (value) => {
                const fileUri = Uri.parse(value);
            if (fileUri) {
                    for (const v of this._viewers) {
                        if (v.fileUri.toString() === fileUri.toString()) {
                            v.reveal();
                            return;
            }
                    }

                    this._viewers.push(new ViewerPanel(this._extensionPath, fileUri));
                }
            });
        }));

    }

    static get instance() {
        return ViewerProvider.s_instance;
    }

    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
        this._viewers.forEach(d => d.dispose());
        if (ViewerProvider.s_instance === this) {
            ViewerProvider.s_instance = null;
        }
    }

    static removeViewer(viewer: ViewerPanel) {
        if (ViewerProvider.s_instance) {
            const index = ViewerProvider.s_instance._viewers.indexOf(viewer);
            if (index > -1) {
                ViewerProvider.s_instance._viewers.splice(index, 1);
            }
        }
    }
}

class ViewerPanel {

    public static readonly viewType = '3dViewer';
    private readonly _fileUri: Uri;

    private readonly _extensionPath: string;
    private readonly _panel: WebviewPanel;
    private _disposables: Disposable[] = [];

    public constructor(extensionPath: string, fileUri: Uri) {
        this._extensionPath = extensionPath;
        this._fileUri = fileUri;

        const column = window.activeTextEditor ? window.activeTextEditor.viewColumn : undefined;
        this._panel = window.createWebviewPanel(ViewerPanel.viewType, "3D Mesh Preview", column || ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true
        });

        this._panel.webview.html = this.getHtmlForWebview();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programatically
        this._panel.onDidDispose(() => {
            ViewerProvider.removeViewer(this);
            this.dispose()
        }, null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'alert':
                    window.showErrorMessage(message.text);
                    return;
            }
        }, null, this._disposables);
    }

    get fileUri(): Uri {
        return this._fileUri;
    }

    public reveal() {
        this._panel.reveal();
        }

    public dispose() {
        // Clean up our resources
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
    }

    private getMediaPath(scheme: string, mediaFile: string): Uri {
        return Uri.file(path.join(this._extensionPath, 'media', mediaFile))
            .with({ scheme: scheme });
    }

    private getSettings(uri: Uri): string {
        let config = workspace.getConfiguration('3dviewer');
        let initialData = {
            fileToLoad: uri.toString(),
            wireframe: config.get('wireframe', false),
            background: config.get('background', '#8f8f8f'),
            boundingBox: config.get('boundingBox', false),
            grid: config.get('grid', true),
            gridSize: config.get('gridSize', 32),
            near: config.get('near', 0.01),
            far: config.get('far', 1000000)
        }
        return `<meta id="vscode-3dviewer-data" data-settings="${JSON.stringify(initialData).replace(/"/g, '&quot;')}">`
    }

    private getScripts(scheme: string): string {
        const scripts = [
            this.getMediaPath(scheme, 'build/three.js'),
            this.getMediaPath(scheme, 'examples/js/libs/inflate.min.js'),
            this.getMediaPath(scheme, 'examples/js/libs/dat.gui.min.js'),
            this.getMediaPath(scheme, 'examples/js/controls/OrbitControls.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/ColladaLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/FBXLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/TDSLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/OBJLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/STLLoader.js'),
            this.getMediaPath(scheme, 'viewer.js')
        ];
        return scripts
            .map(source => `<script src="${source}"></script>`)
            .join('\n');
    }

    private getHtmlForWebview() {

        let fileToLoad = this._fileUri.scheme === "file" ?
            this._fileUri.with({ scheme: 'vscode-resource' }) :
            this._fileUri;


        // Local path to main script run in the webview
        const scriptPathOnDisk = Uri.file(path.join(this._extensionPath, 'media', 'viewer.js'));

        // And the uri we use to load this script in the webview
        const scriptUri = scriptPathOnDisk.with({ scheme: 'vscode-resource' });

        return `<!DOCTYPE html>
            <html lang="en">
                <head>
                <title>3D Viewer</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                ${this.getSettings(fileToLoad)}
                <base href="${this.getMediaPath('vscode-resource', '/')}">
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
                ${this.getScripts('vscode-resource')}
                </body>
            </html>`;
    }


    
}
