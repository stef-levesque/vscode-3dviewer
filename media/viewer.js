
var container, controls;
var camera, renderer, light;
var scene, gui, rendering;

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

    scene = new THREE.Scene();
    scene.background = new THREE.Color(settings.background);

    rendering.addColor(settings, 'background').onChange((color) => { scene.background = new THREE.Color(color) });

    let setWireframe = (wireframe) => {
        /** @type {THREE.Object3D} */
        let object = scene.getObjectByName('MainObject');
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
    var gridHelper = new THREE.GridHelper(28, 28, 0x303030, 0x303030);
    gridHelper.position.set(0, - 0.04, 0);
    gridHelper.visible = settings.grid;
    scene.add(gridHelper);
    rendering.add(gridHelper, 'visible').name('show grid');

    // renderer
    renderer = new THREE.WebGLRenderer();
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
        case 'obj':
        default:
            loader = new THREE.OBJLoader();
            break;
    }

    loader.load(fileToLoad, function (file) {
        var object = file.scene ? file.scene : file;  
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
        scene.add(object);

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

        let modelFolder = gui.addFolder('Model');
        recursive(object, modelFolder, 'visible');

        var bbox = new THREE.BoxHelper(object);
        bbox.name = 'MainObjectBBox';
        bbox.visible = settings.boundingBox;
        scene.add(bbox);
        rendering.add(bbox, 'visible').name('show bounding box');

        bbox.geometry.computeBoundingSphere();
        let center = bbox.geometry.boundingSphere.center;
        let offset = bbox.geometry.boundingSphere.radius * 3;
        controls.target = center;
        camera.position.set(center.x + offset, center.y + offset, center.z + offset);
        camera.updateProjectionMatrix();
        controls.update();

    }, onProgress, onError);

    window.addEventListener('resize', onWindowResize, false);

    light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    light.position.set(0, 1, 0);
    scene.add(light);

    light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(0, 1, 0);
    scene.add(light);

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
    renderer.render(scene, camera);
}