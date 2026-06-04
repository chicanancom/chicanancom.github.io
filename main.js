import LegendaryCursor from 'legendary-cursor';
import * as THREE from 'three';

// --- Background Scene with Stars and Clouds ---
let scene, camera, renderer, starPoints, backStars, cloudMesh, cloudMaterial;

function initBackground() {
    const canvas = document.getElementById('bg-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    // Cap pixel ratio at 1.5 for high performance on Retina/High-DPI screens
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // --- 1. Starfield ---
    function createStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.4, 'rgba(128,128,255,0.2)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
    const starTexture = createStarTexture();

    const backStarCount = 3000;
    const backStarGeo = new THREE.BufferGeometry();
    const backStarPos = new Float32Array(backStarCount * 3);
    for (let i = 0; i < backStarCount; i++) {
        const r = 500;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        backStarPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        backStarPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        backStarPos[i * 3 + 2] = r * Math.cos(phi);
    }
    backStarGeo.setAttribute('position', new THREE.BufferAttribute(backStarPos, 3));
    const backStarMat = new THREE.PointsMaterial({
        size: 1.5,
        color: 0xffffff,
        map: starTexture,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    backStars = new THREE.Points(backStarGeo, backStarMat);
    scene.add(backStars);

    const starCount = 1500;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const colors = [
        new THREE.Color('#7bbcfb'), // Blue
        new THREE.Color('#ffffff'), // White
        new THREE.Color('#fff5d1'), // Yellow
        new THREE.Color('#ffccaa'), // Orange
        new THREE.Color('#ff8888'), // Red
    ];

    for (let i = 0; i < starCount; i++) {
        const r = 100 + Math.random() * 300;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPositions[i * 3 + 2] = r * Math.cos(phi);

        const color = colors[Math.floor(Math.random() * colors.length)];
        starColors[i * 3] = color.r;
        starColors[i * 3 + 1] = color.g;
        starColors[i * 3 + 2] = color.b;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
        size: 4.0,
        map: starTexture,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    starPoints = new THREE.Points(starGeometry, starMaterial);
    scene.add(starPoints);

    // --- 2. Cloud Shader (Dense & Rich) ---
    cloudMaterial = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
            time: { value: 0 },
            scroll: { value: 0 },
            opacity: { value: 0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform float time;
            uniform float scroll;
            uniform float opacity;

            float noise(vec2 p) {
                return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
            }

            float smoothNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f*f*(3.0-2.0*f);
                float a = noise(i);
                float b = noise(i + vec2(1.0, 0.0));
                float c = noise(i + vec2(0.0, 1.0));
                float d = noise(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                // Reduced octaves from 6 to 4 for major performance gains on mobile/GPU
                for(int i=0; i<4; i++){
                    v += a * smoothNoise(p);
                    p *= 2.0;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                vec2 uv = vUv * 2.5 + vec2(0.0, scroll * 0.4);
                float n = fbm(uv + time * 0.04);
                
                // Deep космический colors
                vec3 col1 = vec3(0.05, 0.15, 0.4); // Dark Blue
                vec3 col2 = vec3(0.4, 0.2, 0.6); // Purple Glow
                
                // Expanded smoothstep for DENSE clouds
                float cloud = smoothstep(0.1, 0.8, n); 
                vec3 finalColor = mix(col1, col2, n);
                
                // Increased alpha multiplier for "thick" look
                gl_FragColor = vec4(finalColor, cloud * opacity * 0.9);
            }
        `,
        depthWrite: false
    });

    const cloudGeo = new THREE.PlaneGeometry(35, 35);
    cloudMesh = new THREE.Mesh(cloudGeo, cloudMaterial);
    cloudMesh.position.z = 2;
    scene.add(cloudMesh);

    scene.add(cloudMesh);

    animate();
}


function animate() {
    if (!starPoints || !backStars) {
        requestAnimationFrame(animate);
        return;
    }
    requestAnimationFrame(animate);

    // Skip rendering if tab is hidden/backgrounded to save CPU/GPU cycles
    if (document.hidden) return;

    const time = performance.now() * 0.001;
    const scrollY = window.scrollY;

    if (cloudMaterial) {
        cloudMaterial.uniforms.time.value = time;
        const windowHeight = window.innerHeight;

        // Denser clouds coverage
        const cloudOpacity = Math.min(1.0, scrollY / (windowHeight * 0.6));
        cloudMaterial.uniforms.opacity.value = cloudOpacity;
        cloudMaterial.uniforms.scroll.value = scrollY * 0.002;
        cloudMesh.position.y = scrollY * 0.005;
    }

    // --- Hyperspace Scroll Effect ---
    // Move star layers towards camera based on scroll (Parallax)
    starPoints.position.z = scrollY * 0.15;
    backStars.position.z = scrollY * 0.08;

    // Slight FOV zoom effect creates "tunnel" feeling
    camera.fov = 75 + Math.min(20, scrollY * 0.015);
    camera.updateProjectionMatrix();

    starPoints.rotation.y = time * 0.02 + scrollY * 0.0003;
    starPoints.rotation.x = time * 0.01;
    backStars.rotation.y = -time * 0.01;

    renderer.render(scene, camera);
}


function initTilt() {
    const cards = document.querySelectorAll('.project-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', e => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 15;
            const rotateY = (centerX - x) / 15;
            card.style.transform = `perspective(1000px) translateY(-10px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = `perspective(1000px) translateY(0) rotateX(0) rotateY(0)`;
        });
    });
}

function revealOnScroll() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.project-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(50px)';
        card.style.transition = 'all 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        observer.observe(card);
    });
}

window.addEventListener('resize', () => {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

window.addEventListener('DOMContentLoaded', () => {
    initBackground();
    initTilt();
    revealOnScroll();


    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const target = document.querySelector(targetId);
            if (target) { target.scrollIntoView({ behavior: 'smooth' }); }
        });
    });

    // Only initialize the cursor effect on non-touch devices, and with optimized settings
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) {
        LegendaryCursor.init({
            lineSize: 0.15,
            opacityDecrement: 0.55,
            speedExpFactor: 0.8,
            lineExpFactor: 0.6,
            sparklesCount: 20, // Reduced from 65 to avoid lagging browser rendering thread
            maxOpacity: 0.99,
        });
    }
});
