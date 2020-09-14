const clock = new THREE.Clock();
const userSettings = JSON.parse(document.getElementById('vscode-3dviewer-data').getAttribute('data-settings'));
const fpsLimit = userSettings.limitFps;

const userMenu = new dat.GUI();
const editorScene = new THREE.Scene();
const mainScene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, userSettings.near, userSettings.far);
const renderingFolder = userMenu.addFolder('Rendering');

renderingFolder.add(camera, 'near').onChange(() => camera.updateProjectionMatrix());
renderingFolder.add(camera, 'far').onChange(() => camera.updateProjectionMatrix());
renderingFolder.addColor(userSettings, 'background').onChange(onBackgroundChange);
renderingFolder.add(userSettings, 'wireframe').onChange(onWireframeChange);
renderingFolder.add(userSettings, 'grid').name('show grid').onChange((value) => { editorScene.getObjectByName('grid').visible = value; });
renderingFolder.add(userSettings, 'gridSize').min(1).max(100).step(1).onChange(() => { editorScene.remove(editorScene.getObjectByName('grid')); createGrid(); });
editorScene.background = new THREE.Color(userSettings.background);

createGrid();

const renderer = new THREE.WebGLRenderer({alpha: true});
renderer.autoClearColor = !userSettings.useEnvCube;
renderer.autoClearDepth = false;
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 12, 0);
camera.position.set(2, 18, 28);
controls.update();

const modelLoader = createModelLoader();
const mixers = [];

loadModel();
window.addEventListener('resize', onWindowResize, false);
window.addEventListener('message', onMessageReceived, false);

const light1 = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
const light2 = new THREE.DirectionalLight(0xffffff, 1.0);

light1.position.set(0, 1, 0);
light2.position.set(0, 1, 0);

mainScene.add(light2);
mainScene.add(light1);

const materials = generateMaterials(userSettings.useEnvCube);
let current_material = 0;

const effectController = {
    hue: 0.0,
    saturation: 0.8,
    lightness: 0.1,
    lhue: 0.04,
    lsaturation: 1.0,
    llightness: 0.5,
    updateColor: () => {
        if (mainScene.overrideMaterial) {
            const color = new THREE.Color();
            color.setHSL(this.hue, this.saturation, this.lightness);
            mainScene.overrideMaterial.color = color;
        }
    }
};

const colorFolder = userMenu.addFolder('Material color');
const hueMenu = colorFolder.add(effectController, 'hue', 0.0, 1.0).step(0.025);
const saturationMenu = colorFolder.add(effectController, 'saturation', 0.0, 1.0).step(0.025);
const lightnessMenu = colorFolder.add(effectController, 'lightness', 0.0, 1.0).step(0.025);

hueMenu.onChange(() => effectController.updateColor());
saturationMenu.onChange(() => effectController.updateColor());
lightnessMenu.onChange(() => effectController.updateColor());

const matFolder = userMenu.addFolder('Materials');
for (const mat in materials) {
    effectController[mat] = createEffectHandler(mat);
    matFolder.add(effectController, mat).name(mat);
}

animate();

function createModelLoader() {
    const fileToLoad = userSettings.fileToLoad;

    switch(fileToLoad.split('.').pop().toLowerCase()) {
        case '3ds': const loader = new THREE.TDSLoader();
                    loader.setPath(fileToLoad.substring(0, fileToLoad.lastIndexOf('/') + 1));
                    return loader;
        case 'dae': return new THREE.ColladaLoader();
        case 'fbx': return new THREE.FBXLoader();
        case 'stl': return new THREE.STLLoader();
        case 'ply': return new THREE.PLYLoader();
        default:    return new THREE.OBJLoader();
    }
}

function onMessageReceived(event) {
    const message = event.data;

    if(message === 'modelRefresh') {
        if(userSettings.hotReloadAutomatically) {
            reloadModel();
        }else{
            showModelReloadChangeDialog();
        }
    }
}

function reloadModel() {
    mixers.length = 0;
    mainScene.remove(mainScene.getObjectByName('MainObject'));
    removeFolder('Animation');
    removeFolder('Transform');
    removeFolder('Model');
    loadModel();
}

function showModelReloadChangeDialog() {
    if(!document.getElementById('reloadNotification')) {
        const notification = document.createElement('div');
        notification.id = 'reloadNotification';
        notification.className = 'show';
        notification.innerHTML = `<div>Model file has changed, reload model?</div><br>
                                  <button id = "yesButton">Yes</button>
                                  <button id = "noButton">No</button>`;

        document.body.appendChild(notification);

        const removeNotification = () => { notification.style.animation = 'fadeout 0.5s'; setTimeout(() => notification.remove(), 500); };
        document.getElementById('yesButton').addEventListener('click', () => { reloadModel(); removeNotification(); });
        document.getElementById('noButton').addEventListener('click', removeNotification);
    }
}

function removeFolder(name) {
    const folder = userMenu.__folders[name];

    if(folder) {
        folder.close();
        userMenu.__ul.removeChild(folder.domElement.parentNode);
        delete userMenu.__folders[name];
        userMenu.onResize();
    }
}

function createEffectHandler(id) {
    return () => {
        if (current_material != 0) {
            const oldMaterial = materials[current_material];
            oldMaterial.h = hueMenu.getValue();
            oldMaterial.s = saturationMenu.getValue();
            oldMaterial.l = lightnessMenu.getValue();
        }

        current_material = id;
        const mat = materials[id];
        mainScene.overrideMaterial = mat.m;
        onWireframeChange(userSettings.wireframe);

        hueMenu.setValue(mat.h);
        saturationMenu.setValue(mat.s);
        lightnessMenu.setValue(mat.l);
    };
}

function createGrid() {
    const gridHelper = new THREE.GridHelper(userSettings.gridSize, userSettings.gridSize, 0xc0c0c0, 0xc0c0c0);
    gridHelper.name = 'grid';
    gridHelper.position.set(0, - 0.04, 0);
    gridHelper.visible = userSettings.grid;
    editorScene.add(gridHelper);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onProgress(xhr) {
    if (xhr.lengthComputable) {
        const percentComplete = xhr.loaded / xhr.total * 100;
        console.log(Math.round(percentComplete) + '% downloaded');
    }
}

function loadModel() {
    modelLoader.load(userSettings.fileToLoad, file => {
        const object = file.scene ? file.scene : file.isGeometry || file.isBufferGeometry ? new THREE.Mesh(file) : file;
        object.mixer = new THREE.AnimationMixer(object);
        mixers.push(object.mixer);
        
        if(file.animations && file.animations.length) {
            const action = object.mixer.clipAction(file.animations[0]);
            action.play();
            const animationFolder = userMenu.addFolder('Animation');

            for(let i = 0; i < file.animations.length; ++i) {
                animationFolder.add(object.mixer.clipAction(file.animations[i]), 'play').name('play animation ' + i);
                animationFolder.add(object.mixer.clipAction(file.animations[i]), 'stop').name('stop animation ' + i);
            }
        }
       
        object.name = 'MainObject';
        mainScene.add(object);
        
        const transformFolder = userMenu.addFolder('Transform');
        transformFolder.add(object.position, 'x').name('pos x');
        transformFolder.add(object.position, 'y').name('pos y');
        transformFolder.add(object.position, 'z').name('pos z');
    
        transformFolder.add(object.scale, 'x').name('scale x');
        transformFolder.add(object.scale, 'y').name('scale y');
        transformFolder.add(object.scale, 'z').name('scale z');
    
        transformFolder.add(object.rotation, 'x').name('rot x').min(-Math.PI).max(Math.PI).step(Math.PI / 100);
        transformFolder.add(object.rotation, 'y').name('rot y').min(-Math.PI).max(Math.PI).step(Math.PI / 100);
        transformFolder.add(object.rotation, 'z').name('rot z').min(-Math.PI).max(Math.PI).step(Math.PI / 100);
    
        const modelFolder = userMenu.addFolder('Model');
        populateModelFolder(object, modelFolder, 'visible');
    
        const boundingBox = new THREE.BoxHelper(object);
        boundingBox.name = 'MainObjectBBox';
        boundingBox.visible = userSettings.boundingBox;
        editorScene.add(boundingBox);
        renderingFolder.add(boundingBox, 'visible').name('show bounding box');
    
        if (boundingBox.geometry) {
            boundingBox.geometry.computeBoundingSphere();
    
            if (boundingBox.geometry.boundingSphere) {
                const center = boundingBox.geometry.boundingSphere.center;
                const offset = boundingBox.geometry.boundingSphere.radius * 3;
    
                controls.target = center;
                camera.position.set(center.x + offset, center.y + offset, center.z + offset);
                camera.updateProjectionMatrix();
                controls.update();
            }
        }
    
        onWireframeChange(userSettings.wireframe);
    
    }, onProgress, xhr => console.log(xhr.toString()));
}

function populateModelFolder(baseObject, modelFolder, property) {
    if (baseObject) {
        const objectFolder = modelFolder.addFolder(baseObject.name ? baseObject.name : '{noname}');

        if (baseObject.children && baseObject.children.length) {
            objectFolder.add(baseObject, property);
            baseObject.children.filter(c => c.children && c.children.length).forEach(c => populateModelFolder(c, objectFolder, property));
            baseObject.children.filter(c => !(c.children && c.children.length)).forEach(c => populateModelFolder(c, objectFolder, property));
        } else {
            objectFolder.add(baseObject, property);
        }
    }
}

function onWireframeChange(wireframe) {
    if (mainScene.overrideMaterial) {
        mainScene.overrideMaterial.wireframe = wireframe;
    }

    const object = mainScene.getObjectByName('MainObject');
    if (object) {
        object.traverse(child => {
            if (child['material']) {
                const material = child['material'];

                if (Array.isArray(material)) {
                    for (const m of material) {
                        m.wireframe = wireframe;
                    }
                } else {
                    material.wireframe = wireframe;
                }
            }
        });
    }
}

function onBackgroundChange(color) {
    renderer.autoClearColor = true;
    editorScene.background = new THREE.Color(color);
}

function animate() {
    setTimeout(() => {
        requestAnimationFrame(animate);

        if (mixers.length > 0) {
            for (let i = 0; i < mixers.length; i++) {
                mixers[i].update(clock.getDelta());
            }
        }
    }, fpsLimit ? (1000 / fpsLimit) : 0);

    render();
}

function render() {
    renderer.render(editorScene, camera);
    renderer.render(mainScene, camera);
}

function generateMaterials(useEnvCube) {
    const path = 'textures/cube/Bridge2/';
    const format = '.jpg';
    const urls = [
        path + 'px' + format, path + 'nx' + format,
        path + 'py' + format, path + 'ny' + format,
        path + 'pz' + format, path + 'nz' + format
    ];

    const reflectionCube = new THREE.CubeTextureLoader().load(urls);
    const refractionCube = reflectionCube.clone();

    reflectionCube.format = THREE.RGBFormat;
    refractionCube.format = THREE.RGBFormat;
    refractionCube.mapping = THREE.CubeRefractionMapping;

    if (useEnvCube) {
        editorScene.background = reflectionCube;
    }

    const texture = new THREE.TextureLoader().load('textures/UV_Grid_Sm.jpg');
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

    return {
        'default':
        {
            m: null,
            h: 0, s: 0, l: 1
        },
        'chrome':
        {
            m: new THREE.MeshLambertMaterial({ color: 0xffffff, envMap: reflectionCube }),
            h: 0, s: 0, l: 1
        },
        'liquid':
        {
            m: new THREE.MeshLambertMaterial({ color: 0xffffff, envMap: refractionCube, refractionRatio: 0.85 }),
            h: 0, s: 0, l: 1
        },
        'shiny':
        {
            m: new THREE.MeshStandardMaterial({ color: 0x550000, envMap: reflectionCube, roughness: 0.1, metalness: 1.0 }),
            h: 0, s: 0.8, l: 0.2
        },
        'matte':
        {
            m: new THREE.MeshPhongMaterial({ color: 0x000000, specular: 0x111111, shininess: 1 }),
            h: 0, s: 0, l: 1
        },
        'flat':
        {
            m: new THREE.MeshPhongMaterial({ color: 0x000000, specular: 0x111111, shininess: 1, flatShading: true }),
            h: 0, s: 0, l: 1
        },
        'textured':
        {
            m: new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0x111111, shininess: 1, map: texture }),
            h: 0, s: 0, l: 1
        },
        'colors':
        {
            m: new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0xffffff, shininess: 2, vertexColors: THREE.VertexColors }),
            h: 0, s: 0, l: 1
        },
        'plastic':
        {
            m: new THREE.MeshPhongMaterial({ color: 0x000000, specular: 0x888888, shininess: 250 }),
            h: 0.6, s: 0.8, l: 0.1
        }
    }
}