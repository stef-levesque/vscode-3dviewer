// VSCode webview doesn't support modal window
window.alert = top.alert;
window.confirm = top.confirm;

window.URL = window.URL || window.webkitURL;
window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;

const IS_MAC = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

Number.prototype.format = function () {
    return this.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
};

//

var editor = new Editor();

var viewport = new Viewport(editor);
document.body.appendChild(viewport.dom);

var script = new Script(editor);
document.body.appendChild(script.dom);

var player = new Player(editor);
document.body.appendChild(player.dom);

var toolbar = new Toolbar(editor);
document.body.appendChild(toolbar.dom);

var menubar = new Menubar(editor);
document.body.appendChild(menubar.dom);

var sidebar = new Sidebar(editor);
document.body.appendChild(sidebar.dom);

var modal = new UI.Modal();
document.body.appendChild(modal.dom);

//

//editor.setTheme( editor.config.getKey( 'theme' ) );



//

document.addEventListener('dragover', function (event) {

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';

}, false);

document.addEventListener('drop', function (event) {

    event.preventDefault();

    if (event.dataTransfer.files.length > 0) {

        editor.loader.loadFile(event.dataTransfer.files[0]);

    }

}, false);

document.addEventListener('keydown', function (event) {

    switch (event.keyCode) {

        case 8: // backspace

            event.preventDefault(); // prevent browser back

        case 46: // delete

            var object = editor.selected;

            if (confirm('Delete ' + object.name + '?') === false) return;

            var parent = object.parent;
            if (parent !== null) editor.execute(new RemoveObjectCommand(object));

            break;

        case 90: // Register Ctrl-Z for Undo, Ctrl-Shift-Z for Redo

            if (IS_MAC ? event.metaKey : event.ctrlKey) {

                event.preventDefault(); // Prevent Safari from opening/closing tabs

                if (event.shiftKey) {

                    editor.redo();

                } else {

                    editor.undo();

                }

            }

            break;

        case 87: // Register W for translation transform mode

            editor.signals.transformModeChanged.dispatch('translate');

            break;

        case 69: // Register E for rotation transform mode

            editor.signals.transformModeChanged.dispatch('rotate');

            break;

        case 82: // Register R for scaling transform mode

            editor.signals.transformModeChanged.dispatch('scale');

            break;

    }

}, false);

function onWindowResize(event) {

    editor.signals.windowResize.dispatch();

}

window.addEventListener('resize', onWindowResize, false);

onWindowResize();

//
const vscode = acquireVsCodeApi();

// Signal to VS Code that the webview is initialized.
vscode.postMessage({ type: 'ready' });

var isLoadingFromHash = false;
var hash = window.location.hash;

if (hash.substr(1, 5) === 'file=') {

    var file = hash.substr(6);

    if (confirm('Any unsaved data will be lost. Are you sure?')) {

        var loader = new THREE.FileLoader();
        loader.crossOrigin = '';
        loader.load(file, function (text) {

            editor.clear();
            editor.fromJSON(JSON.parse(text));

        });

        isLoadingFromHash = true;

    }

}

window.addEventListener( 'message', function ( e ) {
    const { type, body, requestId } = e.data;
    switch (type) {
        case 'loadFile':
            {
                editor.clear();

                if (!window.fileLoader) {
                    window.fileLoader = new THREE.FileLoader();
                    window.fileLoader.crossOrigin = '';
                    window.fileLoader.setResponseType( 'arraybuffer' );
                }
                window.fileLoader.load(body.path, (data) => { 
                    let file = new Blob([data]);
                    file.name = body.basename;
                    editor.loader.loadFile(file);
                });
            }
    }
});
