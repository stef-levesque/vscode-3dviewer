import * as path from 'path';
import * as vscode from 'vscode';
import { getNonce, WebviewCollection, MeshDocument, disposeAll, getThreeJSPath, getMediaPath } from './util';

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

    public static readonly viewType = '3dviewer.editor';

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
        const webview = webviewPanel.webview;

        // Add the webview to our internal set of active webviews
        this.webviews.add(document.uri, webviewPanel);

        // Setup initial content for the webview
        webview.options = {
            enableScripts: true,
        };
        webview.html = this.getHtmlForWebview(webview, document);

        webview.onDidReceiveMessage(e => this.onMessage(document, e));

        // Wait for the webview to be properly ready before we init
        webview.onDidReceiveMessage(e => {
            if (e.type === 'ready') {
                const fileToLoad = document.uri.scheme === "file" ?
                    webview.asWebviewUri(vscode.Uri.file(document.uri.fsPath)) :
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

    private getScripts(scheme: string, nonce: string): string {
        const ctx = this._context;
        const scripts = [
            getThreeJSPath('build/three.js', ctx),
            getThreeJSPath('examples/js/libs/system.min.js', ctx),
            getThreeJSPath('examples/js/controls/EditorControls.js', ctx),
            getThreeJSPath('examples/js/controls/TransformControls.js', ctx),
            getThreeJSPath('examples/js/libs/jszip.min.js', ctx),
            getThreeJSPath('examples/js/libs/inflate.min.js', ctx),
            getThreeJSPath('examples/js/loaders/AMFLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/AWDLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/BabylonLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/ColladaLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/FBXLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/GLTFLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/KMZLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/MD2Loader.js', ctx),
            getThreeJSPath('examples/js/loaders/OBJLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/MTLLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/PlayCanvasLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/PLYLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/STLLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/TGALoader.js', ctx),
            getThreeJSPath('examples/js/loaders/TDSLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/UTF8Loader.js', ctx),
            getThreeJSPath('examples/js/loaders/VRMLLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/VTKLoader.js', ctx),
            getThreeJSPath('examples/js/loaders/ctm/lzma.js', ctx),
            getThreeJSPath('examples/js/loaders/ctm/ctm.js', ctx),
            getThreeJSPath('examples/js/loaders/ctm/CTMLoader.js', ctx),
            getThreeJSPath('examples/js/exporters/OBJExporter.js', ctx),
            getThreeJSPath('examples/js/exporters/GLTFExporter.js', ctx),
            getThreeJSPath('examples/js/exporters/STLExporter.js', ctx),
            getThreeJSPath('examples/js/renderers/Projector.js', ctx),
            getThreeJSPath('examples/js/renderers/CanvasRenderer.js', ctx),
            getThreeJSPath('examples/js/renderers/RaytracingRenderer.js', ctx),
            getThreeJSPath('examples/js/renderers/SoftwareRenderer.js', ctx),
            getThreeJSPath('examples/js/renderers/SVGRenderer.js', ctx),
            getThreeJSPath('examples/js/vr/WebVR.js', ctx),
            getThreeJSPath('examples/js/geometries/TeapotBufferGeometry.js', ctx),

            getMediaPath('editor/js/libs/codemirror/codemirror.js', ctx),
            getMediaPath('editor/js/libs/codemirror/mode/javascript.js', ctx),
            getMediaPath('editor/js/libs/codemirror/mode/glsl.js', ctx),
            getMediaPath('editor/js/libs/esprima.js', ctx),
            getMediaPath('editor/js/libs/jsonlint.js', ctx),
            getMediaPath('editor/js/libs/glslprep.min.js', ctx),
            getMediaPath('editor/js/libs/codemirror/addon/dialog.js', ctx),
            getMediaPath('editor/js/libs/codemirror/addon/show-hint.js', ctx),
            getMediaPath('editor/js/libs/codemirror/addon/tern.js', ctx),
            getMediaPath('editor/js/libs/acorn/acorn.js', ctx),
            getMediaPath('editor/js/libs/acorn/acorn_loose.js', ctx),
            getMediaPath('editor/js/libs/acorn/walk.js', ctx),
            getMediaPath('editor/js/libs/ternjs/polyfill.js', ctx),
            getMediaPath('editor/js/libs/ternjs/signal.js', ctx),
            getMediaPath('editor/js/libs/ternjs/tern.js', ctx),
            getMediaPath('editor/js/libs/ternjs/def.js', ctx),
            getMediaPath('editor/js/libs/ternjs/comment.js', ctx),
            getMediaPath('editor/js/libs/ternjs/infer.js', ctx),
            getMediaPath('editor/js/libs/ternjs/doc_comment.js', ctx),
            getMediaPath('editor/js/libs/tern-threejs/threejs.js', ctx),
            getMediaPath('editor/js/libs/signals.min.js', ctx),
            getMediaPath('editor/js/libs/ui.js', ctx),
            getMediaPath('editor/js/libs/ui.three.js', ctx),
            getMediaPath('editor/js/libs/app.js', ctx),
            getMediaPath('editor/js/Player.js', ctx),
            getMediaPath('editor/js/Script.js', ctx),
            getMediaPath('editor/js/Storage.js', ctx),
            getMediaPath('editor/js/Editor.js', ctx),
            //getMediaPath('editor/js/Config.js', ctx),
            getMediaPath('editor/js/Config-MemStorage.js', ctx),
            getMediaPath('editor/js/History.js', ctx),
            getMediaPath('editor/js/Loader.js', ctx),
            getMediaPath('editor/js/Menubar.js', ctx),
            getMediaPath('editor/js/Menubar.File.js', ctx),
            getMediaPath('editor/js/Menubar.Edit.js', ctx),
            getMediaPath('editor/js/Menubar.Add.js', ctx),
            getMediaPath('editor/js/Menubar.Play.js', ctx),
            getMediaPath('editor/js/Menubar.Examples.js', ctx),
            getMediaPath('editor/js/Menubar.Help.js', ctx),
            getMediaPath('editor/js/Menubar.Status.js', ctx),
            getMediaPath('editor/js/Sidebar.js', ctx),
            getMediaPath('editor/js/Sidebar.Scene.js', ctx),
            getMediaPath('editor/js/Sidebar.Project.js', ctx),
            getMediaPath('editor/js/Sidebar.Settings.js', ctx),
            getMediaPath('editor/js/Sidebar.Properties.js', ctx),
            getMediaPath('editor/js/Sidebar.Object.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.Geometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.BufferGeometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.Modifiers.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.BoxGeometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.CircleGeometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.CylinderGeometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.IcosahedronGeometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.PlaneGeometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.SphereGeometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.TorusGeometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.TorusKnotGeometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.TeapotBufferGeometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Geometry.LatheGeometry.js', ctx),
            getMediaPath('editor/js/Sidebar.Material.js', ctx),
            getMediaPath('editor/js/Sidebar.Animation.js', ctx),
            getMediaPath('editor/js/Sidebar.Script.js', ctx),
            getMediaPath('editor/js/Sidebar.History.js', ctx),
            getMediaPath('editor/js/Toolbar.js', ctx),
            getMediaPath('editor/js/Viewport.js', ctx),
            getMediaPath('editor/js/Viewport.Info.js', ctx),
            getMediaPath('editor/js/Command.js', ctx),
            getMediaPath('editor/js/commands/AddObjectCommand.js', ctx),
            getMediaPath('editor/js/commands/RemoveObjectCommand.js', ctx),
            getMediaPath('editor/js/commands/MoveObjectCommand.js', ctx),
            getMediaPath('editor/js/commands/SetPositionCommand.js', ctx),
            getMediaPath('editor/js/commands/SetRotationCommand.js', ctx),
            getMediaPath('editor/js/commands/SetScaleCommand.js', ctx),
            getMediaPath('editor/js/commands/SetValueCommand.js', ctx),
            getMediaPath('editor/js/commands/SetUuidCommand.js', ctx),
            getMediaPath('editor/js/commands/SetColorCommand.js', ctx),
            getMediaPath('editor/js/commands/SetGeometryCommand.js', ctx),
            getMediaPath('editor/js/commands/SetGeometryValueCommand.js', ctx),
            getMediaPath('editor/js/commands/MultiCmdsCommand.js', ctx),
            getMediaPath('editor/js/commands/AddScriptCommand.js', ctx),
            getMediaPath('editor/js/commands/RemoveScriptCommand.js', ctx),
            getMediaPath('editor/js/commands/SetScriptValueCommand.js', ctx),
            getMediaPath('editor/js/commands/SetMaterialCommand.js', ctx),
            getMediaPath('editor/js/commands/SetMaterialValueCommand.js', ctx),
            getMediaPath('editor/js/commands/SetMaterialColorCommand.js', ctx),
            getMediaPath('editor/js/commands/SetMaterialMapCommand.js', ctx),
            getMediaPath('editor/js/commands/SetSceneCommand.js', ctx),
            getMediaPath('editor/js/libs/html2canvas.js', ctx),
            getMediaPath('editor/js/libs/three.html.js', ctx),
            getMediaPath('editor.js', ctx)
        ];

        return scripts
            .map(source => `<script nonce="${nonce}" src="${source}"></script>`)
            .join('\n');
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