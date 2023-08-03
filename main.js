
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GUI } from 'dat.gui'

// CONSTANTS
const widthSegments = 50;   // number of segments, width
const heightSegments = 100; // number of segments, height
const radiusTop = 10;   // radius at the top
const radiusBottom = 10;    // radius at the bottom
const height = 100;  // overall height of the cylinder
const maxHeight = 100;  // related to spectrogram data scaling

// SCENE SET UP
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);



// CAMERA CONTROLS 
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enableZoom = true;



// EMPTY ARRAY TO FILL WITH "SPECTROGRAM" DATA TO USE
let spectrogramData = [];

// DEFINE MESH
let terrainMesh;



// MESH DETAILS
const material = new THREE.MeshPhongMaterial({
    color: 0x808080,
    shininess: 0,
    flatShading: true,
    wireframe: false
});

// GENERATE THE "SPECTROGRAM" BASED ON INPUT AUDIO
function generateSpectrogram(audioBuffer) {
    const audioData = audioBuffer.getChannelData(0); // We'll use only the first channel (mono audio)
    const audioDataLength = audioData.length;
    spectrogramData = [];

    // Calculate magnitude values for each frequency bin
    for (let i = 0; i < widthSegments; i++) {
        const startSample = Math.floor((i / widthSegments) * audioDataLength);
        const endSample = Math.floor(((i + 1) / widthSegments) * audioDataLength);
        let sum = 0;
        for (let j = startSample; j < endSample; j++) {
            sum += Math.abs(audioData[j]);
        }
        const magnitude = sum / (endSample - startSample);
        spectrogramData.push(magnitude);
    }
    

    // Regenerate terrain
    generateTerrain();
}


let filename = "empty";

// FILE UPLOAD FUNCTION
function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    console.log(file);
    filename = file.name.replace(/\.[^/.]+$/, "");

    reader.onload = async function () {
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(reader.result);
        generateSpectrogram(audioBuffer);
    };

    reader.readAsArrayBuffer(file);
}

// LISTEN FOR FILE UPLOADS OR CHANGES
document.getElementById('fileInput').addEventListener('change', handleFileUpload);

// "TERRAIN" OBJECT = the mesh surface 
let terrainGeometry;




function generateTerrain() {
    
    // GUI 
    const gui = new GUI();
    const objectFolder = gui.addFolder('Object');


    if (terrainMesh) {
        scene.remove(terrainMesh);    
        
    }

    terrainGeometry = new THREE.CylinderGeometry(
        radiusTop,
        radiusBottom,
        height,
        widthSegments,
        heightSegments
    );

    // Apply effects to the cylinder's vertices
    const vertices = terrainGeometry.getAttribute('position').array;
    const normalVectorAttribute = terrainGeometry.getAttribute('normal');

    for (let i = 0; i < widthSegments; i++) {
        const magnitude = spectrogramData[i];
        
        const dataHeight = magnitude * maxHeight;   // height related to the audio data processing 

        for (let j = 0; j <= heightSegments; j++) {
            const vertexIndex = i * (heightSegments + 1) + j;
            const vertex = vertices.slice(vertexIndex * 3, vertexIndex * 3 + 3);

            // Displace the vertex along the normal vector based on magnitude
            vertex[0] += normalVectorAttribute.getX(vertexIndex) * dataHeight;
            vertex[1] += normalVectorAttribute.getY(vertexIndex) * dataHeight;
            vertex[2] += normalVectorAttribute.getZ(vertexIndex) * dataHeight;

            vertices[vertexIndex * 3] = vertex[0];
            vertices[vertexIndex * 3 + 1] = vertex[1];
            vertices[vertexIndex * 3 + 2] = vertex[2];
        }
    }

    terrainGeometry.attributes.position.needsUpdate = true;

    // Create the terrain mesh
    terrainMesh = new THREE.Mesh(terrainGeometry, material);
    scene.add(terrainMesh);

    
    let xRot = objectFolder.add(terrainMesh.rotation, 'x', 0, Math.PI * 2);
    let yRot = objectFolder.add(terrainMesh.rotation, 'y', 0, Math.PI * 2);   
    let zRot = objectFolder.add(terrainMesh.rotation, 'z', 0, Math.PI * 2);  



    // Enable the export button after generating the terrain
    document.getElementById('exportButton').disabled = false;
}


// Add ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Add directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 0);
scene.add(directionalLight);

camera.position.z = 100;



// Render loop
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Update camera controls
    renderer.render(scene, camera);
}



// START RENDERING
animate();

// EXPORT FUNCTION
function exportSTL() {
    const exporter = new STLExporter();
    const stlString = exporter.parse(scene, { binary: true }); // Use binary format for efficiency

    const blob = new Blob([stlString], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename +'.stl' ;
    link.click();

    URL.revokeObjectURL(url);
}

// EXPORT FILE UPON BUTTON CLICK
document.addEventListener('DOMContentLoaded', () => {
    const exportButton = document.getElementById('exportButton');
    exportButton.addEventListener('click', exportSTL);
});
