// @ts-check

'use strict';

(function () {

    // VSCode webview doesn't support modal window
    window.alert = window.parent.alert;
    window.confirm = window.parent.confirm;

    // Send message back to host
    window['messageHost'] = (m) => { 
        window.parent.postMessage({ 
            command: "did-click-link", 
            data: `command:3dviewer.onMessage?${encodeURIComponent(JSON.stringify(m))}` 
        }, "file://"); }

    // Display on the side when a file is exported
    window.URL.createObjectURL = (blob) => {
        var reader = new FileReader();
        reader.addEventListener("loadend", () => {
            window.parent.postMessage({
                command: "did-click-link",
                data: `command:3dviewer.displayString?${encodeURIComponent(JSON.stringify(reader.result))}`
            }, "file://");
        });
        reader.readAsText(blob);
        return "#";
    }

}());