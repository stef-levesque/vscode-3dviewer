import * as path from 'path';
import * as vscode from 'vscode';
import { getNonce, WebviewCollection, MeshDocument, disposeAll } from './util';

/**
 * Provider for Mesh viewers.
 */
export class MeshEditorProvider implements vscode.CustomReadonlyEditorProvider<MeshDocument> {

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.window.registerCustomEditorProvider(
            MeshEditorProvider.viewType,
            new MeshEditorProvider(context),
            {
                // Keeps the webview alive even when it is not visible. You should avoid using this setting
                // unless is absolutely required as it does have memory overhead.
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            });
    }

    private static readonly viewType = '3dviewer.editor';

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

        // Wait for the webview to be properly ready before we init
        webviewPanel.webview.onDidReceiveMessage(e => {
            if (e.type === 'ready') {
                const fileToLoad = document.uri.scheme === "file" ?
                    webviewPanel.webview.asWebviewUri(vscode.Uri.file(document.uri.fsPath)) :
                    document.uri;

                const body = {
                    path: fileToLoad.toString(),
                    basename: path.basename(fileToLoad.fsPath),
                    dirname: path.dirname(fileToLoad.toString())
                }
                this.postMessage(webviewPanel, 'loadFile', body);
            }
        });
    }

    //#endregion

    private getMediaPath(scheme: string, mediaFile: string): vscode.Uri {
        return vscode.Uri.file(path.join(this._context.extensionPath, 'media', mediaFile))
            .with({ scheme: scheme });
    }

    private getScripts(scheme: string, nonce?: string): string {
        const scripts = [
            this.getMediaPath(scheme, 'build/three.js'),
            this.getMediaPath(scheme, 'examples/js/libs/system.min.js'),
            this.getMediaPath(scheme, 'examples/js/controls/EditorControls.js'),
            this.getMediaPath(scheme, 'examples/js/controls/TransformControls.js'),
            this.getMediaPath(scheme, 'examples/js/libs/jszip.min.js'),
            this.getMediaPath(scheme, 'examples/js/libs/inflate.min.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/AMFLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/AWDLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/BabylonLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/ColladaLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/FBXLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/GLTFLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/KMZLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/MD2Loader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/OBJLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/MTLLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/PlayCanvasLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/PLYLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/STLLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/TGALoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/TDSLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/UTF8Loader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/VRMLLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/VTKLoader.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/ctm/lzma.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/ctm/ctm.js'),
            this.getMediaPath(scheme, 'examples/js/loaders/ctm/CTMLoader.js'),
            this.getMediaPath(scheme, 'examples/js/exporters/OBJExporter.js'),
            this.getMediaPath(scheme, 'examples/js/exporters/GLTFExporter.js'),
            this.getMediaPath(scheme, 'examples/js/exporters/STLExporter.js'),
            this.getMediaPath(scheme, 'examples/js/renderers/Projector.js'),
            this.getMediaPath(scheme, 'examples/js/renderers/CanvasRenderer.js'),
            this.getMediaPath(scheme, 'examples/js/renderers/RaytracingRenderer.js'),
            this.getMediaPath(scheme, 'examples/js/renderers/SoftwareRenderer.js'),
            this.getMediaPath(scheme, 'examples/js/renderers/SVGRenderer.js'),
            this.getMediaPath(scheme, 'editor/js/libs/codemirror/codemirror.js'),
            this.getMediaPath(scheme, 'editor/js/libs/codemirror/mode/javascript.js'),
            this.getMediaPath(scheme, 'editor/js/libs/codemirror/mode/glsl.js'),
            this.getMediaPath(scheme, 'editor/js/libs/esprima.js'),
            this.getMediaPath(scheme, 'editor/js/libs/jsonlint.js'),
            this.getMediaPath(scheme, 'editor/js/libs/glslprep.min.js'),
            this.getMediaPath(scheme, 'editor/js/libs/codemirror/addon/dialog.js'),
            this.getMediaPath(scheme, 'editor/js/libs/codemirror/addon/show-hint.js'),
            this.getMediaPath(scheme, 'editor/js/libs/codemirror/addon/tern.js'),
            this.getMediaPath(scheme, 'editor/js/libs/acorn/acorn.js'),
            this.getMediaPath(scheme, 'editor/js/libs/acorn/acorn_loose.js'),
            this.getMediaPath(scheme, 'editor/js/libs/acorn/walk.js'),
            this.getMediaPath(scheme, 'editor/js/libs/ternjs/polyfill.js'),
            this.getMediaPath(scheme, 'editor/js/libs/ternjs/signal.js'),
            this.getMediaPath(scheme, 'editor/js/libs/ternjs/tern.js'),
            this.getMediaPath(scheme, 'editor/js/libs/ternjs/def.js'),
            this.getMediaPath(scheme, 'editor/js/libs/ternjs/comment.js'),
            this.getMediaPath(scheme, 'editor/js/libs/ternjs/infer.js'),
            this.getMediaPath(scheme, 'editor/js/libs/ternjs/doc_comment.js'),
            this.getMediaPath(scheme, 'editor/js/libs/tern-threejs/threejs.js'),
            this.getMediaPath(scheme, 'editor/js/libs/signals.min.js'),
            this.getMediaPath(scheme, 'editor/js/libs/ui.js'),
            this.getMediaPath(scheme, 'editor/js/libs/ui.three.js'),
            this.getMediaPath(scheme, 'editor/js/libs/app.js'),
            this.getMediaPath(scheme, 'editor/js/Player.js'),
            this.getMediaPath(scheme, 'editor/js/Script.js'),
            this.getMediaPath(scheme, 'examples/js/vr/WebVR.js'),
            this.getMediaPath(scheme, 'editor/js/Storage.js'),
            this.getMediaPath(scheme, 'editor/js/Editor.js'),
            //this.getMediaPath(scheme, 'editor/js/Config.js'),
            this.getMediaPath(scheme, 'editor/js/Config-MemStorage.js'),
            this.getMediaPath(scheme, 'editor/js/History.js'),
            this.getMediaPath(scheme, 'editor/js/Loader.js'),
            this.getMediaPath(scheme, 'editor/js/Menubar.js'),
            this.getMediaPath(scheme, 'editor/js/Menubar.File.js'),
            this.getMediaPath(scheme, 'editor/js/Menubar.Edit.js'),
            this.getMediaPath(scheme, 'editor/js/Menubar.Add.js'),
            this.getMediaPath(scheme, 'editor/js/Menubar.Play.js'),
            this.getMediaPath(scheme, 'editor/js/Menubar.Examples.js'),
            this.getMediaPath(scheme, 'editor/js/Menubar.Help.js'),
            this.getMediaPath(scheme, 'editor/js/Menubar.Status.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Scene.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Project.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Settings.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Properties.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Object.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.Geometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.BufferGeometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.Modifiers.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.BoxGeometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.CircleGeometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.CylinderGeometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.IcosahedronGeometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.PlaneGeometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.SphereGeometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.TorusGeometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.TorusKnotGeometry.js'),
            this.getMediaPath(scheme, 'examples/js/geometries/TeapotBufferGeometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.TeapotBufferGeometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Geometry.LatheGeometry.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Material.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Animation.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.Script.js'),
            this.getMediaPath(scheme, 'editor/js/Sidebar.History.js'),
            this.getMediaPath(scheme, 'editor/js/Toolbar.js'),
            this.getMediaPath(scheme, 'editor/js/Viewport.js'),
            this.getMediaPath(scheme, 'editor/js/Viewport.Info.js'),
            this.getMediaPath(scheme, 'editor/js/Command.js'),
            this.getMediaPath(scheme, 'editor/js/commands/AddObjectCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/RemoveObjectCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/MoveObjectCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetPositionCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetRotationCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetScaleCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetValueCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetUuidCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetColorCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetGeometryCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetGeometryValueCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/MultiCmdsCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/AddScriptCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/RemoveScriptCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetScriptValueCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetMaterialCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetMaterialValueCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetMaterialColorCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetMaterialMapCommand.js'),
            this.getMediaPath(scheme, 'editor/js/commands/SetSceneCommand.js'),
            this.getMediaPath(scheme, 'editor/js/libs/html2canvas.js'),
            this.getMediaPath(scheme, 'editor/js/libs/three.html.js'),
            this.getMediaPath(scheme, 'editor.js'),
        ];
        if (nonce !== undefined) {
            return scripts
                .map(source => `<script nonce="${nonce}" src="${source}"></script>`)
                .join('\n');
        } else {
            return scripts
                .map(source => `<script src="${source}"></script>`)
                .join('\n');
        }
    }

    /**
     * Get the static HTML used for in our editor's webviews.
     */
    private getHtmlForWebview(webview: vscode.Webview, document: MeshDocument): string {
        const darkmode = vscode.window.activeColorTheme.kind == vscode.ColorThemeKind.Dark;

        // Local path to script and css for the webview
        const styleUri = webview.asWebviewUri(vscode.Uri.file(
            path.join(this._context.extensionPath, 'media', 'editor', 'css', 'main.css')
        ));
        const themeUri = webview.asWebviewUri(vscode.Uri.file(
            path.join(this._context.extensionPath, 'media', 'editor', 'css', darkmode ? 'dark.css' : 'light.css')
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
    <link id="theme" href="${themeUri}" rel="stylesheet" />

    <link rel="stylesheet" href="${mediaUri}/editor/js/libs/codemirror/codemirror.css">
    <link rel="stylesheet" href="${mediaUri}/editor/js/libs/codemirror/theme/monokai.css">
    <link rel="stylesheet" href="${mediaUri}/editor/js/libs/codemirror/addon/dialog.css">
    <link rel="stylesheet" href="${mediaUri}/editor/js/libs/codemirror/addon/show-hint.css">
    <link rel="stylesheet" href="${mediaUri}/editor/js/libs/codemirror/addon/tern.css">

    <base href="${mediaUri}/">

    <title>3D Mesh Editor</title>
</head>
<body>
    ${this.getScripts('vscode-resource', nonce)}
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
            case 'saveFile':
                const documentPath = document.uri.fsPath;
                const savePath = documentPath.substring(0, documentPath.lastIndexOf('.') + 1) + message.extension;

                vscode.workspace.fs.writeFile(vscode.Uri.file(savePath), Buffer.from(message.text));
                return;
        }
    }
}