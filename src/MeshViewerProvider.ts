import * as path from 'path';
import * as vscode from 'vscode';
import { getNonce, WebviewCollection, MeshDocument, disposeAll, getThreeJSPath, getMediaPath } from './util';

/**
 * Provider for Mesh viewers.
 */
export class MeshViewerProvider implements vscode.CustomReadonlyEditorProvider<MeshDocument> {

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.window.registerCustomEditorProvider(
            MeshViewerProvider.viewType,
            new MeshViewerProvider(context),
            {
                // Keeps the webview alive even when it is not visible. You should avoid using this setting
                // unless is absolutely required as it does have memory overhead.
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            });
    }

    private static readonly viewType = '3dviewer.viewer';

    /**
     * Tracks all known webviews
     */
    private readonly webviews = new WebviewCollection();

    constructor(
        private readonly _context: vscode.ExtensionContext
    ) { }

    //#region CustomReadonlyEditorProvider

    openCustomDocument(
        uri: vscode.Uri,
        openContext: { backupId?: string },
        _token: vscode.CancellationToken
    ): MeshDocument {
        const document = new MeshDocument(uri);
        const listeners: vscode.Disposable[] = [];

        listeners.push(document.onDidChangeContent(e => {
            // Update all webviews when the document changes
            for (const webviewPanel of this.webviews.get(document.uri)) {
                this.postMessage(webviewPanel, 'update', {});
            }
        }));

        document.onDidDispose(() => disposeAll(listeners));

        return document;
    }

    resolveCustomEditor(
        document: MeshDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): void {
        // Add the webview to our internal set of active webviews
        this.webviews.add(document.uri, webviewPanel);

        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

        webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));

        if(document.uri.scheme === 'file' && vscode.workspace.getConfiguration('3dviewer').get('hotReload', true)) {
            const watcher = vscode.workspace.createFileSystemWatcher(document.uri.fsPath, true, false, true);

            watcher.onDidChange(() => webviewPanel.webview.postMessage('modelRefresh'));
            webviewPanel.onDidDispose(() => watcher.dispose());
        }

        // Wait for the webview to be properly ready before we init
        webviewPanel.webview.onDidReceiveMessage(e => {
            if (e.type === 'ready') {
                this.postMessage(webviewPanel, 'init', {});
            }
        });
    }

    //#endregion

    private getSettings(uri: vscode.Uri): string {
        const config = vscode.workspace.getConfiguration('3dviewer');
        const initialData = {
            fileToLoad: uri.toString(),
            wireframe: config.get('wireframe', false),
            background: config.get('background', '#8f8f8f'),
            useEnvCube: config.get('useEnvCube', true),
            boundingBox: config.get('boundingBox', false),
            grid: config.get('grid', true),
            gridSize: config.get('gridSize', 32),
            near: config.get('near', 0.01),
            far: config.get('far', 1000000),
            limitFps: config.get('limitFps', 0),
            hotReloadAutomatically: config.get('hotReloadAutomatically', false)
        }
        return `<meta id="vscode-3dviewer-data" data-settings="${JSON.stringify(initialData).replace(/"/g, '&quot;')}">`
    }

    private getScripts(nonce: string): string {
        const ctx = this._context;
        const scripts = [
            getThreeJSPath('build/three.js', this._context),
            getThreeJSPath('examples/js/libs/inflate.min.js', ctx),
            getThreeJSPath('examples/js/libs/dat.gui.min.js', ctx),
            getThreeJSPath('examples/js/controls/OrbitControls.js', ctx),
            getThreeJSPath('examples/js/loaders/LoaderSupport.js', ctx),
            getThreeJSPath('examples/js/loaders/ColladaLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/FBXLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/TDSLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/OBJLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/STLLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/PLYLoader.js', ctx),
            getMediaPath('viewer.js', ctx)
        ];
        return scripts
            .map(source => `<script nonce="${nonce}" src="${source}"></script>`)
            .join('\n');
    }

    /**
     * Get the static HTML used for in our editor's webviews.
     */
    private getHtmlForWebview(webview: vscode.Webview, document: MeshDocument): string {
        const fileToLoad = document.uri.scheme === "file" ?
            webview.asWebviewUri(vscode.Uri.file(document.uri.fsPath)) :
            document.uri;

        // Local path to script and css for the webview
        const styleUri = webview.asWebviewUri(vscode.Uri.file(
            path.join(this._context.extensionPath, 'media', 'viewer.css')
        ));
        const mediaUri = webview.asWebviewUri(vscode.Uri.file(
            path.join(this._context.extensionPath, 'media')
        ));

        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();

        return /* html */`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">

                <!--
                Use a content security policy to only allow loading images from https or from our extension directory,
                and only allow scripts that have a specific nonce.
                -->
                <meta http-equiv="Content-Security-Policy" content="default-src ${webview.cspSource} 'self' 'unsafe-eval' blob: data:; img-src ${webview.cspSource} 'self' 'unsafe-eval' blob: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'self' 'unsafe-eval' blob: data:;">

                <meta name="viewport" content="width=device-width, initial-scale=1.0">

                <link href="${styleUri}" rel="stylesheet" />

                <base href="${mediaUri}/">
                
                ${this.getSettings(fileToLoad)}

                <title>3D Mesh Viewer</title>
            </head>
            <body>
                ${this.getScripts(nonce)}
            </body>
            </html>`;
    }

    private readonly _callbacks = new Map<number, (response: any) => void>();

    private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
        panel.webview.postMessage({ type, body });
    }

    private onMessage(document: MeshDocument, message: any) {
        switch (message.type) {
            case 'response':
                const callback = this._callbacks.get(message.requestId);
                callback?.(message.body);
                return;
        }
    }
}