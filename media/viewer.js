
var container, controls;
var camera, renderer, light;
var scene, gui, rendering;

var clock = new THREE.Clock();

var mixers = [];

var config = {
    wireframe: false,

    background: "#8f8f8f",
    onBackgroundChange: (color) => {scene.background = new THREE.Color(color); }
}

init();

function init() {

    container = document.createElement('div');
    document.body.appendChild(container);

    // user interface
    gui = new dat.GUI();
    rendering = gui.addFolder('rendering');

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.background);

    rendering.addColor(config, 'background').onChange(config.onBackgroundChange);

    rendering.add(config, 'wireframe').onChange( (wireframe) => {
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
    });

    // grid
    var gridHelper = new THREE.GridHelper(28, 28, 0x303030, 0x303030);
    gridHelper.position.set(0, - 0.04, 0);
    scene.add(gridHelper);

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

    var ext = meshToLoad.split('.').pop();

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

    loader.load(meshToLoad, function (file) {
        var object = file.scene ? file.scene : file;  
        object.mixer = new THREE.AnimationMixer(object);
        mixers.push(object.mixer);
        if (file.animations && file.animations[0]) {
            var action = object.mixer.clipAction(file.animations[0]);
            action.play();
        }
        object.name = 'MainObject';
        scene.add(object);

        var bbox = new THREE.BoxHelper(object);
        bbox.name = 'MainObjectBBox';
        scene.add(bbox);
        rendering.add(bbox, 'visible').name('show bounding box');

    }, onProgress, onError);

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // controls, camera
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 12, 0);
    camera.position.set(2, 18, 28);
    controls.update();

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