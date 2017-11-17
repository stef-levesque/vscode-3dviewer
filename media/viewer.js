
var container, controls;
var camera, renderer, light;
var editorScene, mainScene, gui, rendering;

var clock = new THREE.Clock();

var mixers = [];

init();

function init() {

    container = document.createElement('div');
    document.body.appendChild(container);

    // get user settings
    var settings = JSON.parse(document.getElementById('vscode-3dviewer-data').getAttribute('data-settings'));

    // user interface
    gui = new dat.GUI();
    rendering = gui.addFolder('Rendering');

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, settings.near, settings.far);
    rendering.add(camera, 'near').onChange(() => camera.updateProjectionMatrix());
    rendering.add(camera, 'far').onChange(() => camera.updateProjectionMatrix());

    editorScene = new THREE.Scene();
    editorScene.background = new THREE.Color(settings.background);
    mainScene = new THREE.Scene();


    rendering.addColor(settings, 'background').onChange((color) => { editorScene.background = new THREE.Color(color) });

    let setWireframe = (wireframe) => {
        if (mainScene.overrideMaterial) {
            mainScene.overrideMaterial.wireframe = wireframe;
        }
        /** @type {THREE.Object3D} */
        let object = mainScene.getObjectByName('MainObject');
        if (object) {
            object.traverse((child) => {
                if (child['material']) {
                    let material = child['material'];
                    if (Array.isArray(material)) {
                        for (let m of material) {
                            m.wireframe = wireframe;
                        }
                    } else  {
                        material.wireframe = wireframe;
                    }
                }
            });
        }
    };

    if (settings.wireframe) {
        setWireframe(settings.wireframe);
    }

    rendering.add(settings, 'wireframe').onChange( setWireframe );

    // grid
    let createGrid = () => {
        var gridHelper = new THREE.GridHelper(settings.gridSize, settings.gridSize, 0xc0c0c0, 0xc0c0c0);
        gridHelper.name = 'grid';
        gridHelper.position.set(0, - 0.04, 0);
        gridHelper.visible = settings.grid;
        editorScene.add(gridHelper);
    }
    createGrid();
    rendering.add(settings, 'grid').name('show grid').onChange((value) => { editorScene.getObjectByName('grid').visible = value; });
    rendering.add(settings, 'gridSize').min(1).max(100).step(1).onChange((value) => {editorScene.remove(editorScene.getObjectByName('grid')); createGrid();});

    // renderer
    renderer = new THREE.WebGLRenderer();
    renderer.autoClearColor = false;
    renderer.autoClearDepth = false;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // controls, camera
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 12, 0);
    camera.position.set(2, 18, 28);
    controls.update();

    // model
    var onProgress = function (xhr) {

        if (xhr.lengthComputable) {

            var percentComplete = xhr.loaded / xhr.total * 100;
            console.log(Math.round(percentComplete) + '% downloaded');

        }

    };

    var onError = function (xhr) {
        console.log(xhr.toString())
    };

    var fileToLoad = settings.fileToLoad;
    var ext = fileToLoad.split('.').pop();

    var loader;
    switch (ext) {
        case '3ds':
            loader = new THREE.TDSLoader();
            break;
        case 'dae':
            loader = new THREE.ColladaLoader();
            break;
        case 'fbx':
            loader = new THREE.FBXLoader();
            break;
        case 'stl':
            loader = new THREE.STLLoader();
            break;
        case 'obj':
        default:
            loader = new THREE.OBJLoader();
            break;
    }

    loader.load(fileToLoad, function (file) {
        window['file'] = file;
        
        var object = file.scene ? file.scene : 
                     file.isGeometry || file.isBufferGeometry ? new THREE.Mesh(file) : 
                     file;
        object.mixer = new THREE.AnimationMixer(object);
        mixers.push(object.mixer);
        if (file.animations && file.animations.length) {
            var action = object.mixer.clipAction(file.animations[0]);
            action.play();
            let animation = gui.addFolder('Animation');

            for (let i=0; i<file.animations.length; ++i) {
                animation.add( object.mixer.clipAction(file.animations[i]), 'play').name('play animation ' + i);
                animation.add( object.mixer.clipAction(file.animations[i]), 'stop').name('stop animation ' + i);
            }
        }
        object.name = 'MainObject';
        mainScene.add(object);

        /** 
         * @param {THREE.Object3D} baseObject 
         * @param {dat.GUI} baseFolder
         * @param {string} property
         * */
        let recursive = (baseObject, baseFolder, property) => {
            if (baseObject) {
                let newFolder = baseFolder.addFolder(baseObject.name ? baseObject.name : '{noname}');
                if (baseObject.children && baseObject.children.length) {
                    newFolder.add(baseObject, property);
                    baseObject.children.filter(c => c.children && c.children.length).forEach(c => recursive(c, newFolder, property));
                    baseObject.children.filter(c => !(c.children && c.children.length)).forEach(c => recursive(c, newFolder, property));
                } else {
                    newFolder.add(baseObject, property);
                }
            }
        }

        let transformFolder = gui.addFolder('Transform');
        transformFolder.add(object.position, 'pos x');
        transformFolder.add(object.position, 'pos y');
        transformFolder.add(object.position, 'pos z');
    
        transformFolder.add(object.scale, 'scale x');
        transformFolder.add(object.scale, 'scale y');
        transformFolder.add(object.scale, 'scale z');

        transformFolder.add(object.rotation, 'rot x').min(-Math.PI).max(Math.PI).step(Math.PI / 100);
        transformFolder.add(object.rotation, 'rot y').min(-Math.PI).max(Math.PI).step(Math.PI / 100);
        transformFolder.add(object.rotation, 'rot z').min(-Math.PI).max(Math.PI).step(Math.PI / 100);

        let modelFolder = gui.addFolder('Model');
        recursive(object, modelFolder, 'visible');

        var bbox = new THREE.BoxHelper(object);
        bbox.name = 'MainObjectBBox';
        bbox.visible = settings.boundingBox;
        editorScene.add(bbox);
        rendering.add(bbox, 'visible').name('show bounding box');

        if (bbox.geometry) {
            bbox.geometry.computeBoundingSphere();
            if (bbox.geometry.boundingSphere) {
                let center = bbox.geometry.boundingSphere.center;
                let offset = bbox.geometry.boundingSphere.radius * 3;
                controls.target = center;
                camera.position.set(center.x + offset, center.y + offset, center.z + offset);
                camera.updateProjectionMatrix();
                controls.update();
            }
        }

    }, onProgress, onError);

    window.addEventListener('resize', onWindowResize, false);

    light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    light.position.set(0, 1, 0);
    mainScene.add(light);

    light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(0, 1, 0);
    mainScene.add(light);


    // materials
    let materials = generateMaterials();
    var current_material = 0;

    let effectController = {
        hue: 0.0,
        saturation: 0.8,
        lightness: 0.1,
        lhue: 0.04,
        lsaturation: 1.0,
        llightness: 0.5,
        updateColor: function() {
            if (mainScene.overrideMaterial) {
                let color = new THREE.Color();
                color.setHSL(this.hue, this.saturation, this.lightness);
                mainScene.overrideMaterial.color = color;
            }
        }
    };
    
    let colorFolder = gui.addFolder("Material color");
    var m_h = colorFolder.add(effectController, "hue", 0.0, 1.0).step(0.025);
    var m_s = colorFolder.add(effectController, "saturation", 0.0, 1.0).step(0.025);
    var m_l = colorFolder.add(effectController, "lightness", 0.0, 1.0).step(0.025);

    m_h.onChange(() => effectController.updateColor());
    m_s.onChange(() => effectController.updateColor());
    m_l.onChange(() => effectController.updateColor());

    var createHandler = function( id ) {
        return function() {
            if (current_material != 0) {
                var mat_old = materials[ current_material ];
                mat_old.h = m_h.getValue();
                mat_old.s = m_s.getValue();
                mat_old.l = m_l.getValue();
            }
            current_material = id;
            var mat = materials[ id ];
            mainScene.overrideMaterial = mat.m;
            setWireframe(settings.wireframe);
            m_h.setValue( mat.h );
            m_s.setValue( mat.s );
            m_l.setValue( mat.l );
        };
    };

    let matFolder = gui.addFolder( "Materials" );
    for ( var m in materials ) {
        effectController[ m ] = createHandler( m );
        matFolder.add( effectController, m ).name( m );
    }

    animate();

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

//

function animate() {
    requestAnimationFrame(animate);

    if (mixers.length > 0) {
        for (var i = 0; i < mixers.length; i++) {
            mixers[i].update(clock.getDelta());
        }
    }

    render();
}

function render() {
    renderer.render(editorScene, camera);
    renderer.render(mainScene, camera);
}

function generateMaterials() {
    // environment map
    var path = "textures/cube/pisa/";
    var format = '.png';
    var urls = [
        path + 'px' + format, path + 'nx' + format,
        path + 'py' + format, path + 'ny' + format,
        path + 'pz' + format, path + 'nz' + format
    ];
    var cubeTextureLoader = new THREE.CubeTextureLoader();
    var reflectionCube = cubeTextureLoader.load( urls );
    reflectionCube.format = THREE.RGBFormat;
    var refractionCube = cubeTextureLoader.load( urls );
    reflectionCube.format = THREE.RGBFormat;
    refractionCube.mapping = THREE.CubeRefractionMapping;

    editorScene.background = reflectionCube;

    var texture = new THREE.TextureLoader().load( "textures/UV_Grid_Sm.jpg" );
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    var materials = {
        "default" : 
        {
            m: null,
            h: 0, s: 0, l: 1
        },
        "chrome" :
        {
            m: new THREE.MeshLambertMaterial( { color: 0xffffff, envMap: reflectionCube } ),
            h: 0, s: 0, l: 1
        },
        "liquid" :
        {
            m: new THREE.MeshLambertMaterial( { color: 0xffffff, envMap: refractionCube, refractionRatio: 0.85 } ),
            h: 0, s: 0, l: 1
        },
        "shiny"  :
        {
            m: new THREE.MeshStandardMaterial( { color: 0x550000, envMap: reflectionCube, roughness: 0.1, metalness: 1.0 } ),
            h: 0, s: 0.8, l: 0.2
        },
        "matte" :
        {
            m: new THREE.MeshPhongMaterial( { color: 0x000000, specular: 0x111111, shininess: 1 } ),
            h: 0, s: 0, l: 1
        },
        "flat" :
        {
            m: new THREE.MeshPhongMaterial( { color: 0x000000, specular: 0x111111, shininess: 1, flatShading: true } ),
            h: 0, s: 0, l: 1
        },
        "textured" :
        {
            m: new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0x111111, shininess: 1, map: texture } ),
            h: 0, s: 0, l: 1
        },
        "colors" :
        {
            m: new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0xffffff, shininess: 2, vertexColors: THREE.VertexColors } ),
            h: 0, s: 0, l: 1
        },
        "plastic" :
        {
            m: new THREE.MeshPhongMaterial( { color: 0x000000, specular: 0x888888, shininess: 250 } ),
            h: 0.6, s: 0.8, l: 0.1
        },
    }
    return materials;
}
