# vscode-3dsviewer

## Description

Preview 3D meshes in VSCode

## Main Features

Support multiple format:
* `3ds` 3D Studio Max
* `dae` Collada digital asset exchange
* `fbx` Filmbox
* `stl` STereo-Lithography
* `obj` Wavefront OBJ


![teapot](images/teapot.png)  
  
![sponza](images/sponza.png)  
  

## Commands

Right-click on a supported file in the explorer, and select `Preview Mesh`

## Configuration

|Name                   |Type      |Description
|-----------------------|----------|------------
|`3dviewer.wireframe`   |`boolean` |Display mesh in wireframe mode
|`3dviewer.background`  |`string`  |Set the default background color (e.g. '#8f8f8f')
|`3dviewer.boundingBox` |`boolean` |Display a bounding box around the model
|`3dviewer.grid`        |`boolean` |Display a grid at the origin
|`3dviewer.gridSize`    |`number`  |Set the size of the grid
|`3dviewer.near`        |`number`  |Set the near plane distance
|`3dviewer.far`         |`number`  |Set the far plane distance

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## Requirements

Visual Studio Code v1.18.0

## Credits

* [Visual Studio Code](https://code.visualstudio.com/)
* [THREE.js](https://threejs.org)
* [dat.GUI](http://workshop.chromeexperiments.com/examples/gui/#1--Basic-Usage)

## License

[MIT](LICENSE.md)