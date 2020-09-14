import * as path from 'path';
import * as vscode from 'vscode';
import { getNonce } from './util';
import { Disposable, disposeAll } from './dispose';


/**
 * Define the document (the data model) used for mesh files.
 */
class MeshViewerDocument extends Disposable implements vscode.CustomDocument {

    static async create(
        uri: vscode.Uri,
        backupId: string | undefined
    ): Promise<MeshViewerDocument | PromiseLike<MeshViewerDocument>> {
        // If we have a backup, read that. Otherwise read the resource from the workspace
        const dataFile = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
        return new MeshViewerDocument(uri);
    }

    private readonly _uri: vscode.Uri;

    private constructor(uri: vscode.Uri) {
        super();
        this._uri = uri;
    }

    public get uri(): vscode.Uri { return this._uri; }

    private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
    /**
     * Fired when the document is disposed of.
     */
    public readonly onDidDispose = this._onDidDispose.event;

    private readonly _onDidChangeDocument = this._register(new vscode.EventEmitter<void>());
    /**
     * Fired to notify webviews that the document has changed.
     */
    public readonly onDidChangeContent = this._onDidChangeDocument.event;


    /**
     * Called by VS Code when there are no more references to the document.
     * 
     * This happens when all editors for it have been closed.
     */
    dispose(): void {
        this._onDidDispose.fire();
        super.dispose();
    }
}


/**
 * Provider for Mesh viewers.
 */
export class MeshViewerProvider implements vscode.CustomReadonlyEditorProvider<MeshViewerDocument> {

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

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: { backupId?: string },
        _token: vscode.CancellationToken
    ): Promise<MeshViewerDocument> {
        const document = await MeshViewerDocument.create(uri, openContext.backupId);

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

    async resolveCustomEditor(
        document: MeshViewerDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
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

    private getMediaPath(scheme: string, mediaFile: string): vscode.Uri {
        return vscode.Uri.file(path.join(this._context.extensionPath, 'media', mediaFile))
            .with({ scheme: scheme });
    }

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

    private getScripts(scheme: string, nonce: string): string {
        const scripts = [
            this.getMediaPath(scheme, 'build/three.js'),
            this.getMediaPath(scheme, 'examples/js/libs/inflate.min.js'),
            this.getMediaPath(scheme, 'examples/js/libs/dat.gui.min.js'),
            this.getMediaPath(scheme, 'examples/js/controls/OrbitControls.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/LoaderSupport.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/ColladaLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/FBXLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/TDSLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/OBJLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/STLLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/PLYLoader.js'),
            this.getMediaPath(scheme, 'viewer.js')
        ];
        return scripts
            .map(source => `<script nonce="${nonce}" src="${source}"></script>`)
            .join('\n');
    }

    /**
     * Get the static HTML used for in our editor's webviews.
     */
    private getHtmlForWebview(webview: vscode.Webview, document: MeshViewerDocument): string {
        const fileToLoad = document.uri.scheme === "file" ?
            webview.asWebviewUri(vscode.Uri.file(document.uri.fsPath)) :
            document.uri;

        // Local path to script and css for the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.file(
            path.join(this._context.extensionPath, 'media', 'viewer.js')
        ));
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
                ${this.getScripts('vscode-resource', nonce)}
            </body>
            </html>`;
    }

    private _requestId = 1;
    private readonly _callbacks = new Map<number, (response: any) => void>();

    private postMessageWithResponse<R = unknown>(panel: vscode.WebviewPanel, type: string, body: any): Promise<R> {
        const requestId = this._requestId++;
        const p = new Promise<R>(resolve => this._callbacks.set(requestId, resolve));
        panel.webview.postMessage({ type, requestId, body });
        return p;
    }

    private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
        panel.webview.postMessage({ type, body });
    }

    private onMessage(document: MeshViewerDocument, message: any) {
        switch (message.type) {
            case 'response':
                const callback = this._callbacks.get(message.requestId);
                callback?.(message.body);
                return;
        }
    }
}


/**
 * Tracks all webviews.
 */
class WebviewCollection {

    private readonly _webviews = new Set<{
        readonly resource: string;
        readonly webviewPanel: vscode.WebviewPanel;
    }>();

    /**
     * Get all known webviews for a given uri.
     */
    public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
        const key = uri.toString();
        for (const entry of this._webviews) {
            if (entry.resource === key) {
                yield entry.webviewPanel;
            }
        }
    }

    /**
     * Add a new webview to the collection.
     */
    public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
        const entry = { resource: uri.toString(), webviewPanel };
        this._webviews.add(entry);

        webviewPanel.onDidDispose(() => {
            this._webviews.delete(entry);
        });
    }
}