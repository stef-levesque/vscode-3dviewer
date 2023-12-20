import * as vscode from 'vscode';
import { MeshEditorProvider } from './MeshEditorProvider';
import { MeshViewerProvider } from './MeshViewerProvider';

export function handleOpenIn3dViewerCommand() {
    openUserSelectedFileInEditor(MeshViewerProvider.viewType);
}

export function handleOpenIn3dEditorCommand() {
    openUserSelectedFileInEditor(MeshEditorProvider.viewType);
}


async function openUserSelectedFileInEditor(editorViewType: string) {
    const selectedFiles = await vscode.window.showOpenDialog({
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: 'Open',
        canSelectFiles: true,
        filters: {
            'Model files': [ '3ds', 'dae', 'fbx', 'obj', 'stl', 'ply' ]
        }
    });

    if(selectedFiles) {
        vscode.commands.executeCommand('vscode.openWith', selectedFiles[0], editorViewType);
    }
}