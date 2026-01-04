import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

let geometry;
let mesh;
let flying = 0;

// Audio history buffer: Array of Arrays (rows x cols)
const terrainHistory = [];

export const params = {
    speed: 0.05,
    heightScale: 40,
    noiseScale: 0.5,
    wireframe: true,
    colorHigh: '#ff00cc',
    colorLow: '#00ccff',
    width: 300,
    depth: 300,
    segments: 24,
    audioStrength: 60
};

const cHigh = new THREE.Color(params.colorHigh);
const cLow = new THREE.Color(params.colorLow);

export function createTerrain(scene) {
    // Cleanup if already exists
    if (mesh) {
        scene.remove(mesh);
        geometry.dispose();
        mesh.material.dispose();
    }

    const width = params.width;
    const depth = params.depth;
    const segments = params.segments;

    geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const count = geometry.attributes.position.count;
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

    const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        wireframe: params.wireframe,
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Reset history
    terrainHistory.length = 0;
    for (let i = 0; i <= segments; i++) {
        terrainHistory.push(new Array(segments + 1).fill(0));
    }

    return mesh;
}

export function updateTerrain(frequencyData, deltaTime) {
    if (!geometry) return;

    flying -= params.speed * (deltaTime * 10);

    const positions = geometry.attributes.position;
    const colors = geometry.attributes.color;

    const widthSegments = geometry.parameters.widthSegments;
    const heightSegments = geometry.parameters.heightSegments;
    const cols = widthSegments + 1;
    const rows = heightSegments + 1;

    cHigh.set(params.colorHigh);
    cLow.set(params.colorLow);
    mesh.material.wireframe = params.wireframe;

    // --- AUDIO DATA PROCESSING ---
    const newRow = new Array(cols).fill(0);

    if (frequencyData) {

        for (let x = 0; x < cols; x++) {
            // Normalize x to -1..0..1
            // const ndx = (x / (cols - 1)) * 2 - 1;
            // const freqIndex = Math.floor(Math.abs(ndx) * (frequencyData.length / 2));

            const freqIndex = Math.floor((x / cols) * frequencyData.length * 0.8);
            const val = frequencyData[freqIndex] || 0;
            newRow[x] = val / 255.0;
        }
    }

    terrainHistory.pop();
    terrainHistory.unshift(newRow);

    // --- GEOMETRY UPDATE ---
    let yoff = flying;

    for (let y = 0; y < rows; y++) {
        let xoff = 0;

        const audioRow = terrainHistory[y];

        for (let x = 0; x < cols; x++) {
            const index = y * cols + x;

            const noiseVal = noise2D(xoff, yoff);
            let height = THREE.MathUtils.mapLinear(noiseVal, -1, 1, -params.heightScale / 2, params.heightScale / 2);

            const audioVal = audioRow ? audioRow[x] : 0;

            height += audioVal * params.audioStrength;

            positions.setY(index, height);

            // Colors
            const alpha = (height + 20) / (params.heightScale + 40);
            const r = THREE.MathUtils.lerp(cLow.r, cHigh.r, alpha);
            const g = THREE.MathUtils.lerp(cLow.g, cHigh.g, alpha);
            const b = THREE.MathUtils.lerp(cLow.b, cHigh.b, alpha);
            colors.setXYZ(index, r, g, b);

            xoff += params.noiseScale;
        }
        yoff += params.noiseScale;
    }

    positions.needsUpdate = true;
    colors.needsUpdate = true;
    geometry.computeVertexNormals();
}
