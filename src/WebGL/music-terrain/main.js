import { setupScene } from './src/visuals.js';
import { createTerrain, updateTerrain, params as terrainParams } from './src/terrain.js';
import { setupAudio, getAudioData } from './src/audio.js';
import * as THREE from 'three';
import GUI from 'lil-gui';

const app = document.querySelector('#app');
const overlay = document.querySelector('#overlay');
const startBtn = document.querySelector('#start-btn');
const defaultBtn = document.querySelector('#default-btn');
const fileInput = document.querySelector('#file-input');
const trackInfo = document.querySelector('#track-info');
const trackLink = document.querySelector('#track-link');
let isRunning = false;

// Setup Scene
const { scene, camera, renderer, composer, bloomPass, controls } = setupScene(app);

// Setup Terrain
createTerrain(scene);

// GUI Setup
const gui = new GUI({ title: 'Visual Settings' });
const terrainFolder = gui.addFolder('Terrain').close();
terrainFolder.add(terrainParams, 'speed', 0.1, 2.0);
terrainFolder.add(terrainParams, 'heightScale', 1, 100);
terrainFolder.add(terrainParams, 'noiseScale', 0.01, 1.0);
terrainFolder.add(terrainParams, 'audioStrength', 0, 200);
terrainFolder.add(terrainParams, 'wireframe');
terrainFolder.addColor(terrainParams, 'colorHigh');
terrainFolder.addColor(terrainParams, 'colorLow');

const sizeFolder = gui.addFolder('Terrain Size (Reset)').close();
sizeFolder.add(terrainParams, 'width', 100, 1000).onChange(() => createTerrain(scene));
sizeFolder.add(terrainParams, 'depth', 100, 1000).onChange(() => createTerrain(scene));
sizeFolder.add(terrainParams, 'segments', 4, 128, 1).onChange(() => createTerrain(scene));

const bloomFolder = gui.addFolder('Bloom').close();
bloomFolder.add(bloomPass, 'strength', 0, 3).name('Strength');
bloomFolder.add(bloomPass, 'radius', 0, 1).name('Radius');
bloomFolder.add(bloomPass, 'threshold', 0, 1).name('Threshold');


// Animation Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();
    const audioData = getAudioData();

    updateTerrain(audioData, deltaTime);

    controls.update();

    composer.render();
}

// Initial render
composer.render();
animate(); // Start animation loop immediately but with no audio data it's just idle noise

// Interaction
startBtn.addEventListener('click', () => {
    fileInput.click();
});

defaultBtn.addEventListener('click', async () => {
    defaultBtn.textContent = 'Loading...';
    defaultBtn.disabled = true;
    startBtn.disabled = true;

    try {
        await setupAudio('./default/default.mp3');
        overlay.classList.add('hidden');

        trackLink.textContent = '小猫坏事做尽';
        trackLink.href = 'https://open.spotify.com/track/2IPYknCqUPlXgV8FwUH45c?si=1ce1687b39af41da';
        trackInfo.classList.remove('hidden');

        isRunning = true;
    } catch (err) {
        console.error(err);
        defaultBtn.textContent = 'Error loading default';
        startBtn.disabled = false;
    }
});

fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        startBtn.textContent = 'Loading...';
        startBtn.disabled = true;

        try {
            await setupAudio(file);
            overlay.classList.add('hidden');
            trackInfo.classList.add('hidden'); // Hide info for custom files
            isRunning = true;
        } catch (err) {
            console.error(err);
            startBtn.textContent = 'Error loading file';
        }
    }
});

// Drag and drop support on overlay
overlay.addEventListener('dragover', (e) => {
    e.preventDefault();
});

overlay.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('audio/')) {
            startBtn.textContent = 'Loading...';
            startBtn.disabled = true;

            try {
                await setupAudio(file);
                overlay.classList.add('hidden');
                trackInfo.classList.add('hidden'); // Hide info for custom files
                isRunning = true;
            } catch (err) {
                console.error(err);
                startBtn.textContent = 'Error loading file';
            }
        }
    }
});
