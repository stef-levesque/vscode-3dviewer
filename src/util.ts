import * as vscode from 'vscode';

export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function disposeAll(disposables: vscode.Disposable[]) {
    while (disposables.length) {
        const item = disposables.pop();
        if (item) {
            item.dispose();
        }
    }
}

/**
 * Tracks all webviews.
 */
export class WebviewCollection {

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

/**
 * Define the document (the data model) used for mesh files.
 */
export class MeshDocument implements vscode.CustomDocument {

    private isDisposed = false;
    private disposables: vscode.Disposable[] = [];

    public constructor(public uri: vscode.Uri) {}

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
        if (this.isDisposed) {
            return;
        }
        this.isDisposed = true;
        disposeAll(this.disposables);
    }

    private _register<T extends vscode.Disposable>(value: T): T {
        if (this.isDisposed) {
            value.dispose();
        } else {
            this.disposables.push(value);
        }
        return value;
    }
}