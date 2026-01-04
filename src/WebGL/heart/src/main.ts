import * as THREE from 'three';
import './style.css';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// --- Configuration ---
const CONFIG = {
    particleCount: 100000,
    heartScale: 8,
    rotationSpeed: 0.005,
    color1: new THREE.Color(0xff2266), // Pinkish red
    color2: new THREE.Color(0xff55aa), // Bright pink
    color3: new THREE.Color(0xffffff), // White highlights
    snowParticleCount: 30000,
};

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020205);
scene.fog = new THREE.FogExp2(0x020205, 0.05);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('app')?.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const pointLight1 = new THREE.PointLight(0xffaa00, 2, 20);
pointLight1.position.set(5, 5, 5);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x00ff88, 1.5, 15);
pointLight2.position.set(-5, 8, -5);
scene.add(pointLight2);

// --- Post-Processing (Bloom) ---
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,  // Hơi giảm cường độ sáng
    0.5,  // Tăng bán kính nhòe
    1.5   // Tăng ngưỡng (threshold) để chỉ những hạt thật sáng mới tỏa sáng
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// --- Particle Texture ---
function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;

    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// --- Particle Generation ---
function createHeartParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(CONFIG.particleCount * 3);
    const colors = new Float32Array(CONFIG.particleCount * 3);
    const sizes = new Float32Array(CONFIG.particleCount);
    const phases = new Float32Array(CONFIG.particleCount);
    const intensities = new Float32Array(CONFIG.particleCount);

    for (let i = 0; i < CONFIG.particleCount; i++) {
        phases[i] = Math.random() * Math.PI * 2;
        intensities[i] = 1.0;

        // 3D Heart Parametric Equation (Ball-over-heart style)
        // x = 16 * sin^3(t)
        // y = 13 * cos(t) - 5 * cos(2t) - 2 * cos(3t) - cos(4t)
        // z = scaled depth

        const t = Math.random() * Math.PI * 2;
        const u = Math.random() * Math.PI - Math.PI / 2; // Range for depth

        // Standard parametric heart in 2D
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(45 * t);

        // Add 3D volume by scaling x/y based on z
        // A simple sphere-like volume mapping: x' = x * cos(u), y' = y * cos(u), z' = thickness * sin(u)
        const cosU = Math.cos(u);
        const sinU = Math.sin(u);
        const thickness = 7;

        x *= cosU;
        y *= cosU;
        const z = thickness * sinU;

        // Scale and shift
        const scale = CONFIG.heartScale * 0.05;
        positions[i * 3 + 0] = x * scale;
        positions[i * 3 + 1] = y * scale + 8; // Offset upwards
        positions[i * 3 + 2] = z * scale;

        // Add some noise for volume density
        const noise = (Math.random() - 0.5) * 0.2;
        positions[i * 3 + 0] += noise;
        positions[i * 3 + 1] += noise;
        positions[i * 3 + 2] += noise;

        let col = new THREE.Color();
        const rand = Math.random();

        if (rand > 0.98) {
            col = CONFIG.color3; // White highlights
            intensities[i] = 3.0;
        } else if (rand > 0.9) {
            col = CONFIG.color2; // Bright pink
            intensities[i] = 1.5;
        } else {
            col.copy(CONFIG.color1); // Deep red/pink
            col.offsetHSL(Math.random() * 0.05 - 0.025, 0, Math.random() * 0.2 - 0.1);
        }

        colors[i * 3 + 0] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;

        sizes[i] = (Math.random() * 0.08 + 0.04) * (2.0 + Math.random() * 2.0);
        if (intensities[i] > 1.0) sizes[i] *= 1.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('intensity', new THREE.BufferAttribute(intensities, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uTexture: { value: createParticleTexture() }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexShader: `
            uniform float uTime;
            attribute float size;
            attribute float phase;
            attribute float intensity;
            attribute vec3 color;
            varying vec3 vColor;
            varying float vOpacity;
            varying float vIntensity;

            void main() {
                vColor = color;
                vIntensity = intensity;
                float twinkle = sin(uTime * 3.0 + phase) * 0.5 + 0.5;
                vOpacity = 0.4 + 0.6 * twinkle;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z) * (0.8 + 0.4 * twinkle);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D uTexture;
            varying vec3 vColor;
            varying float vOpacity;
            varying float vIntensity;
            void main() {
                vec4 texColor = texture2D(uTexture, gl_PointCoord);
                if (texColor.a < 0.2) discard;
                gl_FragColor = vec4(vColor * vIntensity, vOpacity * texColor.a);
            }
        `
    });

    return new THREE.Points(geometry, material);
}

function createSnowParticles() {
    const geometry = new THREE.BufferGeometry();
    const count = CONFIG.snowParticleCount;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 1] = Math.random() * 30;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 40;

        velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.05;
        velocities[i * 3 + 1] = -(Math.random() * 0.05 + 0.02);
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uTexture: { value: createParticleTexture() }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexShader: `
            uniform float uTime;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = 0.2 * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D uTexture;
            void main() {
                vec4 texColor = texture2D(uTexture, gl_PointCoord);
                if (texColor.a < 0.2) discard;
                // Nhân màu với 3.0 để phát sáng qua Bloom
                gl_FragColor = vec4(vec3(0.9, 0.95, 1.0) * 3.0, texColor.a * 0.8);
            }
        `
    });

    return { points: new THREE.Points(geometry, material), velocities };
}

let tree = createHeartParticles();
scene.add(tree);



const { points: snow, velocities: snowVelocities } = createSnowParticles();
snow.geometry.setDrawRange(0, 15000);
scene.add(snow);

// --- UI Integration ---
const bloomThresholdInput = document.getElementById('bloom-threshold') as HTMLInputElement;
const bloomThresholdVal = document.getElementById('bloom-threshold-val') as HTMLElement;
const snowDensityInput = document.getElementById('snow-density') as HTMLInputElement;
const snowDensityVal = document.getElementById('snow-density-val') as HTMLElement;
const cameraSpeedInput = document.getElementById('camera-speed') as HTMLInputElement;
const cameraSpeedVal = document.getElementById('camera-speed-val') as HTMLElement;

let currentSnowDensity = 15000;

bloomThresholdInput.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    bloomPass.threshold = val;
    bloomThresholdVal.innerText = val.toFixed(2);
});

snowDensityInput.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    currentSnowDensity = val;
    snowDensityVal.innerText = val.toString();
    snow.geometry.setDrawRange(0, val);
});

cameraSpeedInput.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    controls.autoRotateSpeed = val;
    cameraSpeedVal.innerText = val.toFixed(1);
});



// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    const time = Date.now() * 0.001;

    // Update uniforms
    if (tree.material instanceof THREE.ShaderMaterial) {
        tree.material.uniforms.uTime.value = time;
    }

    tree.rotation.y += CONFIG.rotationSpeed;

    // Pulsing lights
    pointLight1.intensity = 2 + Math.sin(time * 2) * 0.5;
    pointLight2.intensity = 1.5 + Math.cos(time * 1.5) * 0.3;

    // Snow Animation
    const positions = snow.geometry.attributes.position.array as Float32Array;
    // Only update active snow particles
    for (let i = 0; i < currentSnowDensity; i++) {
        positions[i * 3 + 0] += snowVelocities[i * 3 + 0];
        positions[i * 3 + 1] += snowVelocities[i * 3 + 1];
        positions[i * 3 + 2] += snowVelocities[i * 3 + 2];

        // Reset snow when it falls below ground
        if (positions[i * 3 + 1] < -2) {
            positions[i * 3 + 1] = 25;
            positions[i * 3 + 0] = (Math.random() - 0.5) * 40;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
        }
    }
    snow.geometry.attributes.position.needsUpdate = true;

    controls.update();
    composer.render();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();
