import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const settings = {
  autoRotate: false,
  rotateSpeed: 1.0,
  wireframe: false,
  grid: false,
  shadows: true,
  lightIntensity: 1.0,
  bgColor: '#e5e7eb',
  animationSpeed: 1.0,
  lightAzimuth: 45,
  lightElevation: 60
};

let scene, camera, renderer, controls;
let modelGroup, mainModel;
let gridHelper, ambientLight, dirLight, hemiLight, floorMat;
let mixer, activeAction;
let animations = [];
let modelMaxDim = 1.0;
let modelHeight = 0.5;
let selectedNode = null;

let defaultCameraPos = new THREE.Vector3();
let defaultControlsTarget = new THREE.Vector3();
let targetCameraPos = new THREE.Vector3();
let targetControlsTarget = new THREE.Vector3();
let isAnimatingCamera = false;

let customModelUrl = null;
let customModelName = "";

function init() {
  const container = document.getElementById('canvas-container');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(settings.bgColor);
  scene.fog = new THREE.FogExp2(settings.bgColor, 0.015);

  modelGroup = new THREE.Group();
  scene.add(modelGroup);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(5, 4, 5);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.01;
  controls.target.set(0, 0, 0);
  controls.addEventListener('start', () => {
    isAnimatingCamera = false;
  });

  gridHelper = new THREE.GridHelper(30, 30, 0x7c3aed, 0x444444);
  gridHelper.position.y = 0;
  gridHelper.visible = settings.grid;
  scene.add(gridHelper);

  const floorGeo = new THREE.PlaneGeometry(1000, 1000);
  floorMat = new THREE.ShadowMaterial({ opacity: Math.min(0.9, settings.lightIntensity * 0.45) });
  const floorPlane = new THREE.Mesh(floorGeo, floorMat);
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.position.y = -0.001;
  floorPlane.receiveShadow = false;
  scene.add(floorPlane);

  setupLighting();

  window.addEventListener('resize', onWindowResize);

  setupUI();

  loadModel('./autosave2_10632_autosave.glb', false);

  animate();
}

function setupLighting() {
  hemiLight = new THREE.HemisphereLight(0xffffff, 0x222222, 0.15);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  ambientLight = new THREE.AmbientLight(0xffffff, 0.02);
  scene.add(ambientLight);

  dirLight = new THREE.DirectionalLight(0xffffff, 1.8 * settings.lightIntensity);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);
  updateLightPosition();
}

function updateLightPosition() {
  const azRad = THREE.MathUtils.degToRad(settings.lightAzimuth);
  const elRad = THREE.MathUtils.degToRad(settings.lightElevation);
  const dist = modelMaxDim * 2 + 5;
  dirLight.position.set(
    dist * Math.cos(elRad) * Math.sin(azRad),
    dist * Math.sin(elRad),
    dist * Math.cos(elRad) * Math.cos(azRad)
  );
  dirLight.target.position.set(0, 0, 0);
  if (!dirLight.target.parent) scene.add(dirLight.target);
  dirLight.target.updateMatrixWorld();
}

let toonGradientTexture = null;
function getToonGradientTexture() {
  if (toonGradientTexture) return toonGradientTexture;

  const colors = new Uint8Array([0, 255]);
  toonGradientTexture = new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat);
  toonGradientTexture.minFilter = THREE.NearestFilter;
  toonGradientTexture.magFilter = THREE.NearestFilter;
  toonGradientTexture.generateMipmaps = false;
  toonGradientTexture.needsUpdate = true;

  return toonGradientTexture;
}

function fixMaterial(mat, child) {
  if (!mat) return mat;

  const hasVertexColors = !!(child && child.geometry && child.geometry.attributes.color);

  const gradientMap = getToonGradientTexture();

  const name = (mat.name || '').toLowerCase();
  const meshName = (child && child.name || '').toLowerCase();
  let color = mat.color ? mat.color.clone() : new THREE.Color(0xffffff);

  if (meshName.includes('cube010_1') || name.includes('cube010_1')) {
    color.setHex(0x111113);
  } else if (name.includes('brow') || name.includes('lash') || name.includes('beard') || name.includes('mustache') || name.includes('eyebrow') || name.includes('eyelash') || name.includes('facial') || name.includes('face_hair')) {
    color.setHex(0x111113);
  } else if (name.includes('hair')) {
    color.setHex(0xd91a1a);
  } else if (name.includes('clothes') || name.includes('shoe') || name.includes('pant')) {
    color.setHex(0x111113);
  } else if (hasVertexColors && color.getHex() === 0x000000) {
    color.setHex(0xffffff);
  }

  const map = mat.map || null;
  const normalMap = mat.normalMap || null;
  const aoMap = mat.aoMap || null;

  const isEyeOrBrow =
    name.includes('eye') ||
    name.includes('brow') ||
    name.includes('lash') ||
    meshName.includes('eye') ||
    meshName.includes('brow') ||
    meshName.includes('lash') ||
    meshName.includes('cube010_1') ||
    name.includes('hair')
    ;

  if (isEyeOrBrow) {
    const newMat = new THREE.MeshBasicMaterial({
      name: mat.name,
      color: color,
      map: map,
      vertexColors: hasVertexColors || !!mat.vertexColors,
      transparent: mat.transparent ?? (mat.opacity < 1.0),
      opacity: mat.opacity ?? 1.0,
      alphaTest: mat.alphaTest ?? 0.0,
      depthWrite: mat.depthWrite ?? true,
      side: THREE.DoubleSide,
      wireframe: settings.wireframe
    });

    if (mat.dispose) mat.dispose();
    console.info(`[fixMaterial] Replaced "${mat.name || mat.type}" → MeshBasicMaterial (Eye/Brow)`);
    return newMat;
  }

  const newMat = new THREE.MeshToonMaterial({
    name: mat.name,
    color: color,
    map: map,
    normalMap: normalMap,
    aoMap: aoMap,
    gradientMap: gradientMap,
    vertexColors: hasVertexColors || !!mat.vertexColors,
    transparent: mat.transparent ?? (mat.opacity < 1.0),
    opacity: mat.opacity ?? 1.0,
    alphaTest: mat.alphaTest ?? 0.0,
    depthWrite: mat.depthWrite ?? true,
    side: THREE.DoubleSide,
    wireframe: settings.wireframe
  });

  if (mat.dispose) mat.dispose();

  console.info(`[fixMaterial] Replaced "${mat.name || mat.type}" → MeshToonMaterial (Color: #${color.getHexString()}, VertexColors: ${newMat.vertexColors})`);
  return newMat;
}

function createOutline(mesh) {
  if (!mesh.geometry) return;

  const outlineMat = new THREE.MeshPhongMaterial({
    color: 0x000000,
    side: THREE.BackSide,
    shininess: 0,
    depthWrite: true
  });

  outlineMat.onBeforeCompile = (shader) => {
    const thickness = modelMaxDim * 0.0035;
    shader.uniforms.outlineThickness = { value: thickness };

    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `uniform float outlineThickness;
       void main() {`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       transformed += normal * outlineThickness;`
    );
  };

  let outlineMesh;
  if (mesh.isSkinnedMesh) {
    outlineMesh = new THREE.SkinnedMesh(mesh.geometry, outlineMat);
    outlineMesh.skeleton = mesh.skeleton;
    outlineMesh.bindMatrix = mesh.bindMatrix;
    outlineMesh.bindMatrixInverse = mesh.bindMatrixInverse;
  } else {
    outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
  }

  outlineMesh.name = 'outline';
  outlineMesh.castShadow = false;
  outlineMesh.receiveShadow = false;

  mesh.add(outlineMesh);
}

function clearModelGroup() {
  while (modelGroup.children.length > 0) {
    const child = modelGroup.children[0];
    modelGroup.remove(child);
    child.traverse((node) => {
      if (node.isMesh) {
        if (node.name !== 'outline') {
          node.geometry.dispose();
        }
        if (Array.isArray(node.material)) {
          node.material.forEach(m => { if (m && m.dispose) m.dispose(); });
        } else if (node.material) {
          if (node.material.dispose) node.material.dispose();
        }
      }
    });
  }

  if (mixer) {
    mixer.stopAllAction();
    mixer = null;
    const animSelect = document.getElementById('animation-select');
    animSelect.innerHTML = '';
    document.getElementById('animation-section').style.display = 'none';
  }
}

function loadModel(url, isBackup) {
  const loader = new GLTFLoader();
  const statusEl = document.getElementById('loader-status');
  const progressBarEl = document.getElementById('progress-bar');
  const progressTextEl = document.getElementById('progress-text');

  if (isBackup === undefined) {
    isBackup = url.includes('backup1');
  }

  const loadingOverlay = document.getElementById('loading-overlay');
  progressBarEl.style.width = '0%';
  progressTextEl.innerText = '0%';
  statusEl.innerText = 'Đang kết nối và tải file mô hình 3D...';
  loadingOverlay.style.opacity = '1';
  loadingOverlay.style.display = 'flex';

  loader.load(
    url,
    (gltf) => {
      clearModelGroup();

      mainModel = gltf.scene;
      modelGroup.add(mainModel);

      const meshes = [];
      mainModel.traverse((child) => {
        if (child.isMesh) {
          const meshName = (child.name || '').toLowerCase();
          
          if (isBackup) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            const hasEyeOrBrowMat = mats.some(m => {
              if (!m) return false;
              const name = (m.name || '').toLowerCase();
              return name.includes('eye') || name.includes('brow') || name.includes('lash');
            });
            const isEyeOrBrow = hasEyeOrBrowMat || meshName.includes('eye') || meshName.includes('brow') || meshName.includes('lash');

            child.userData.isEyeOrBrow = isEyeOrBrow;

            if (isEyeOrBrow) {
              child.castShadow = false;
              child.receiveShadow = false;
            } else {
              child.castShadow = !settings.wireframe;
              child.receiveShadow = !settings.wireframe;
            }

            if (Array.isArray(child.material)) {
              child.material = child.material.map(mat => fixMaterial(mat, child));
            } else if (child.material) {
              child.material = fixMaterial(child.material, child);
            }
          } else {
            child.castShadow = !settings.wireframe;
            child.receiveShadow = !settings.wireframe;
          }

          meshes.push(child);
        }
      });

      if (isBackup) {
        meshes.forEach(createOutline);
      }

      mainModel.traverse((child) => {
        if (child.isMesh && child.name !== 'outline' && child.geometry) {
          child.geometry.computeVertexNormals();
        }
      });

      const box = new THREE.Box3().setFromObject(mainModel);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      mainModel.position.x = -center.x;
      mainModel.position.y = -box.min.y;
      mainModel.position.z = -center.z;

      modelMaxDim = Math.max(size.x, size.y, size.z);
      modelHeight = size.y;

      controls.target.set(0, modelHeight / 2, 0);
      camera.position.set(modelMaxDim * 1.2, modelHeight + modelMaxDim * 0.4, modelMaxDim * 1.2);
      controls.update();

      defaultControlsTarget.copy(controls.target);
      defaultCameraPos.copy(camera.position);

      scene.remove(gridHelper);
      gridHelper = new THREE.GridHelper(modelMaxDim * 3, 30, 0x7c3aed, 0x333344);
      gridHelper.position.y = 0;
      gridHelper.visible = settings.grid;
      scene.add(gridHelper);

      dirLight.position.set(modelMaxDim * 1.5, modelMaxDim * 2, modelMaxDim * 1.5);
      dirLight.shadow.camera.top = modelMaxDim * 1.5;
      dirLight.shadow.camera.bottom = -modelMaxDim * 1.5;
      dirLight.shadow.camera.left = -modelMaxDim * 1.5;
      dirLight.shadow.camera.right = modelMaxDim * 1.5;
      dirLight.shadow.camera.near = 0.1;
      dirLight.shadow.camera.far = modelMaxDim * 10;
      dirLight.shadow.camera.updateProjectionMatrix();

      let trianglesCount = 0;
      let verticesCount = 0;

      mainModel.traverse((child) => {
        if (child.isMesh && child.name !== 'outline') {
          const geometry = child.geometry;
          if (geometry.index) {
            trianglesCount += geometry.index.count / 3;
          } else if (geometry.attributes.position) {
            trianglesCount += geometry.attributes.position.count / 3;
          }
          if (geometry.attributes.position) {
            verticesCount += geometry.attributes.position.count;
          }
        }
      });

      document.getElementById('stat-triangles').innerText = trianglesCount.toLocaleString();
      document.getElementById('stat-vertices').innerText = verticesCount.toLocaleString();
      document.getElementById('stat-bounds').innerText = `${size.x.toFixed(2)}m x ${size.y.toFixed(2)}m x ${size.z.toFixed(2)}m`;

      if (url.startsWith('blob:')) {
        document.querySelector('.file-name').innerText = customModelName || 'custom.glb';
      } else {
        document.querySelector('.file-name').innerText = url.split('/').pop();
      }

      animations = gltf.animations;
      if (animations && animations.length > 0) {
        mixer = new THREE.AnimationMixer(mainModel);
        const animSelect = document.getElementById('animation-select');
        animSelect.innerHTML = '';

        animations.forEach((clip, index) => {
          const option = document.createElement('option');
          option.value = index;
          option.text = clip.name || `Animation ${index + 1}`;
          animSelect.appendChild(option);
        });

        document.getElementById('animation-section').style.display = 'block';

        playAnimation(0);
      }

      const loadingOverlay = document.getElementById('loading-overlay');
      loadingOverlay.style.opacity = '0';
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 800);

      buildHierarchyTree();
    },
    (xhr) => {
      if (xhr.lengthComputable) {
        const percent = Math.min(99, Math.round((xhr.loaded / xhr.total) * 100));
        progressBarEl.style.width = `${percent}%`;
        progressTextEl.innerText = `${percent}%`;

        if (percent < 30) {
          statusEl.innerText = 'Đang đọc cấu trúc file GLB...';
        } else if (percent < 70) {
          statusEl.innerText = 'Đang tải lưới bề mặt (meshes) và vân bề mặt (textures)...';
        } else if (percent < 99) {
          statusEl.innerText = 'Đang nén dữ liệu mô hình...';
        } else {
          statusEl.innerText = 'Đang hoàn tất và khởi dựng môi trường 3D...';
        }
      } else {
        statusEl.innerText = `Đang tải: ${(xhr.loaded / (1024 * 1024)).toFixed(1)} MB...`;
      }
    },
    (error) => {
      console.error('Lỗi khi tải GLB:', error);
      statusEl.innerText = 'Lỗi! Không thể tải mô hình 3D. Vui lòng kiểm tra lại file GLB.';
      statusEl.style.color = '#ef4444';
      progressTextEl.innerText = 'Error';
      progressTextEl.style.color = '#ef4444';
    }
  );
}

function playAnimation(index) {
  if (!mixer || !animations[index]) return;

  if (activeAction) {
    activeAction.fadeOut(0.3);
  }

  const clip = animations[index];
  activeAction = mixer.clipAction(clip);
  activeAction.reset();
  activeAction.setEffectiveTimeScale(settings.animationSpeed);
  activeAction.fadeIn(0.3);
  activeAction.play();

  document.getElementById('play-pause-text').innerText = 'Tạm dừng';
  const icon = document.getElementById('play-pause-icon');
  icon.setAttribute('data-lucide', 'pause');
  lucide.createIcons();
}

function buildHierarchyTree() {
  const treeContainer = document.getElementById('hierarchy-tree');
  treeContainer.innerHTML = '';

  function getNodeType(obj) {
    if (obj.isScene) return 'scene';
    if (obj.isMesh) return 'mesh';
    if (obj.isSkinnedMesh) return 'mesh';
    if (obj.isLight) return 'light';
    if (obj.isCamera) return 'camera';
    return 'group';
  }

  function getTypeIcon(type) {
    const icons = {
      scene: 'globe',
      mesh: 'box',
      group: 'folder',
      light: 'sun',
      camera: 'video'
    };
    return icons[type] || 'circle';
  }

  function getTypeBadge(type) {
    const labels = {
      mesh: ['MESH', 'badge-mesh'],
      group: ['GROUP', 'badge-group'],
    };
    return labels[type] || null;
  }

  const EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_CLOSED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  function buildNode(obj, depth) {
    if (obj === gridHelper) return null;
    if (obj.isDirectionalLightHelper || obj.isGridHelper) return null;
    if (obj.isBone) return null;

    const type = getNodeType(obj);

    const visibleChildren = (obj.children || []).filter(c => !c.isBone);
    const hasChildren = visibleChildren.length > 0;

    const nodeEl = document.createElement('div');
    nodeEl.className = 'tree-node';

    const rowEl = document.createElement('div');
    rowEl.className = 'tree-node-row';
    rowEl.style.paddingLeft = `${12 + depth * 16}px`;

    if (hasChildren) {
      const toggleBtn = document.createElement('div');
      toggleBtn.className = 'tree-toggle-btn';
      toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
      rowEl.appendChild(toggleBtn);

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const childrenEl = nodeEl.querySelector(':scope > .tree-children');
        if (childrenEl) {
          childrenEl.classList.toggle('open');
          toggleBtn.classList.toggle('open');
        }
      });
    } else {
      const spacer = document.createElement('div');
      spacer.className = 'tree-spacer';
      rowEl.appendChild(spacer);
    }

    const iconEl = document.createElement('div');
    iconEl.className = `tree-icon icon-${type}`;
    iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${getIconSVGPath(getTypeIcon(type))}</svg>`;
    rowEl.appendChild(iconEl);

    const labelEl = document.createElement('div');
    labelEl.className = 'tree-label' + (obj.name ? '' : ' muted');
    labelEl.textContent = obj.name || `(${type})`;
    labelEl.title = obj.name || `(${type})`;
    rowEl.appendChild(labelEl);

    const badgeInfo = getTypeBadge(type);
    if (badgeInfo) {
      const badge = document.createElement('span');
      badge.className = `tree-badge ${badgeInfo[1]}`;
      badge.textContent = badgeInfo[0];
      rowEl.appendChild(badge);
    }

    if (type !== 'scene') {
      const eyeBtn = document.createElement('button');
      eyeBtn.className = 'tree-eye-btn';
      eyeBtn.title = 'Bật/Tắt hiển thị';
      eyeBtn.innerHTML = EYE_OPEN;
      eyeBtn.dataset.visible = 'true';

      eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = eyeBtn.dataset.visible === 'true';
        obj.visible = !isVisible;
        eyeBtn.dataset.visible = String(!isVisible);
        eyeBtn.innerHTML = !isVisible ? EYE_OPEN : EYE_CLOSED;
        eyeBtn.classList.toggle('hidden-eye', isVisible);
        rowEl.classList.toggle('node-hidden', isVisible);
      });

      rowEl.appendChild(eyeBtn);
    }

    rowEl.addEventListener('click', () => {
      if (selectedNode) {
        const prev = treeContainer.querySelector('.tree-node-row.selected');
        if (prev) prev.classList.remove('selected');
      }
      rowEl.classList.add('selected');
      selectedNode = obj;

      if (obj.isMesh || obj.isGroup) {
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          controls.target.copy(center);
          controls.update();
        }
      }
    });

    nodeEl.appendChild(rowEl);

    if (hasChildren) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children' + (depth < 2 ? ' open' : '');

      if (depth < 2) {
        const btn = rowEl.querySelector('.tree-toggle-btn');
        if (btn) btn.classList.add('open');
      }

      visibleChildren.forEach(child => {
        const childEl = buildNode(child, depth + 1);
        if (childEl) childrenContainer.appendChild(childEl);
      });

      if (childrenContainer.childElementCount > 0) {
        nodeEl.appendChild(childrenContainer);
      }
    }

    return nodeEl;
  }

  const root = buildNode(scene, 0);
  if (root) treeContainer.appendChild(root);
}

function getIconSVGPath(name) {
  const paths = {
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    'git-branch': '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    circle: '<circle cx="12" cy="12" r="10"/>'
  };
  return paths[name] || paths.circle;
}

function loadLocalFile(file) {
  if (customModelUrl) {
    URL.revokeObjectURL(customModelUrl);
  }
  customModelUrl = URL.createObjectURL(file);
  customModelName = file.name;

  const modelSelect = document.getElementById('model-select');
  const customOption = modelSelect.querySelector('option[value="custom"]');
  customOption.disabled = false;
  customOption.text = `Mô hình của tôi (${customModelName})`;
  modelSelect.value = "custom";

  loadModel(customModelUrl, true);
}

function setupUI() {
  const toggleRotate = document.getElementById('toggle-rotate');
  toggleRotate.addEventListener('change', (e) => {
    settings.autoRotate = e.target.checked;
  });

  const rotateSpeed = document.getElementById('rotate-speed');
  rotateSpeed.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settings.rotateSpeed = val;
    document.getElementById('rotate-speed-val').innerText = `${val.toFixed(1)}x`;
  });

  const toggleWireframe = document.getElementById('toggle-wireframe');
  toggleWireframe.addEventListener('change', (e) => {
    settings.wireframe = e.target.checked;
    modelGroup.traverse((child) => {
      if (child.isMesh) {
        if (child.name !== 'outline') {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => { if (m) m.wireframe = settings.wireframe; });

          if (child.userData.isEyeOrBrow) {
            child.castShadow = false;
            child.receiveShadow = false;
          } else {
            child.castShadow = !settings.wireframe;
            child.receiveShadow = !settings.wireframe;
          }
        } else {
          child.visible = !settings.wireframe;
        }
      }
    });
  });

  const toggleGrid = document.getElementById('toggle-grid');
  toggleGrid.addEventListener('change', (e) => {
    settings.grid = e.target.checked;
    if (gridHelper) gridHelper.visible = settings.grid;
  });

  const toggleShadows = document.getElementById('toggle-shadows');
  toggleShadows.addEventListener('change', (e) => {
    settings.shadows = e.target.checked;
    dirLight.castShadow = settings.shadows;
  });

  const lightIntensity = document.getElementById('light-intensity');
  lightIntensity.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settings.lightIntensity = val;
    dirLight.intensity = 1.8 * val;
    hemiLight.intensity = 0.15 * (0.5 + 0.5 * val);
    if (floorMat) {
      floorMat.opacity = Math.min(0.9, val * 0.45);
    }
    document.getElementById('light-intensity-val').innerText = val.toFixed(1);
  });

  const lightAzimuth = document.getElementById('light-azimuth');
  lightAzimuth.addEventListener('input', (e) => {
    settings.lightAzimuth = parseFloat(e.target.value);
    document.getElementById('light-azimuth-val').innerText = `${settings.lightAzimuth}°`;
    updateLightPosition();
  });

  const lightElevation = document.getElementById('light-elevation');
  lightElevation.addEventListener('input', (e) => {
    settings.lightElevation = parseFloat(e.target.value);
    document.getElementById('light-elevation-val').innerText = `${settings.lightElevation}°`;
    updateLightPosition();
  });

  const colorPresets = document.querySelectorAll('.color-preset');
  colorPresets.forEach(preset => {
    preset.addEventListener('click', (e) => {
      colorPresets.forEach(btn => btn.classList.remove('active'));
      preset.classList.add('active');

      const hex = preset.getAttribute('data-color');
      settings.bgColor = hex;
      scene.background.set(hex);
      scene.fog.color.set(hex);
    });
  });

  const animSelect = document.getElementById('animation-select');
  animSelect.addEventListener('change', (e) => {
    playAnimation(parseInt(e.target.value));
  });

  const btnPlayPause = document.getElementById('btn-play-pause');
  btnPlayPause.addEventListener('click', () => {
    if (!activeAction) return;

    const icon = document.getElementById('play-pause-icon');
    const text = document.getElementById('play-pause-text');

    if (activeAction.isRunning()) {
      activeAction.paused = true;
      text.innerText = 'Chạy tiếp';
      icon.setAttribute('data-lucide', 'play');
    } else {
      activeAction.paused = false;
      if (!activeAction.isRunning()) {
        activeAction.play();
      }
      text.innerText = 'Tạm dừng';
      icon.setAttribute('data-lucide', 'pause');
    }
    lucide.createIcons();
  });

  const animSpeed = document.getElementById('animation-speed');
  animSpeed.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    settings.animationSpeed = val;
    document.getElementById('animation-speed-val').innerText = `${val.toFixed(1)}x`;
    if (activeAction) {
      activeAction.setEffectiveTimeScale(val);
    }
  });

  const helpBtn = document.getElementById('help-btn');
  const helpModal = document.getElementById('help-modal');
  const closeModal = document.querySelector('.close-modal');

  helpBtn.addEventListener('click', () => {
    helpModal.classList.add('modal-visible');
  });

  closeModal.addEventListener('click', () => {
    helpModal.classList.remove('modal-visible');
  });

  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      helpModal.classList.remove('modal-visible');
    }
  });

  const btnUpload = document.getElementById('btn-upload');
  const fileInput = document.getElementById('file-input');

  btnUpload.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      loadLocalFile(file);
    }
  });

  const container = document.getElementById('canvas-container');

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
      loadLocalFile(file);
    }
  });

  const btnFrontFace = document.getElementById('btn-view-front-face');
  btnFrontFace.addEventListener('click', () => {
    const params = getFaceFocusParameters();
    animateCameraTo(params.position, params.target);
  });

  const btnViewReset = document.getElementById('btn-view-reset');
  btnViewReset.addEventListener('click', () => {
    animateCameraTo(defaultCameraPos, defaultControlsTarget);
  });

  lucide.createIcons();

  const hierarchyToggle = document.getElementById('hierarchy-toggle');
  hierarchyToggle.addEventListener('click', () => {
    const panel = document.getElementById('hierarchy-panel');
    panel.classList.toggle('collapsed');
  });

  document.getElementById('hierarchy-tree').innerHTML =
    '<div class="hierarchy-placeholder">Chưa có mô hình được tải...</div>';

  const resizeHandle = document.getElementById('hierarchy-resize');
  const hierarchyPanel = document.getElementById('hierarchy-panel');
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartWidth = hierarchyPanel.offsetWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const dx = resizeStartX - e.clientX;
    const newWidth = Math.min(600, Math.max(220, resizeStartWidth + dx));
    hierarchyPanel.style.width = `${newWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });

  const modelSelect = document.getElementById('model-select');
  modelSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'backup1') {
      loadModel('./backup1.glb', true);
    } else if (val === 'autosave') {
      loadModel('./autosave2_10632_autosave.glb', false);
    } else if (val === 'custom' && customModelUrl) {
      loadModel(customModelUrl, true);
    }
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer) {
    mixer.update(delta);
  }

  controls.update();

  if (settings.autoRotate && modelGroup) {
    modelGroup.rotation.y += 0.005 * settings.rotateSpeed;
  } else if (!settings.autoRotate && modelGroup) {
    modelGroup.rotation.y = modelGroup.rotation.y % (Math.PI * 2);
  }

  if (isAnimatingCamera) {
    camera.position.lerp(targetCameraPos, 0.08);
    controls.target.lerp(targetControlsTarget, 0.08);

    if (camera.position.distanceTo(targetCameraPos) < 0.01 &&
      controls.target.distanceTo(targetControlsTarget) < 0.01) {
      camera.position.copy(targetCameraPos);
      controls.target.copy(targetControlsTarget);
      isAnimatingCamera = false;
    }
  }

  renderer.render(scene, camera);
}

function animateCameraTo(position, target) {
  targetCameraPos.copy(position);
  targetControlsTarget.copy(target);
  isAnimatingCamera = true;
}

function getFaceFocusParameters() {
  let targetMesh = null;

  modelGroup.traverse((child) => {
    if (child.isMesh && child.name !== 'outline') {
      const name = child.name.toLowerCase();
      if (name.includes('head') || name.includes('face') || name.includes('eye') || name.includes('cheek') || name.includes('nose')) {
        if (!targetMesh || name.includes('head') || name.includes('face')) {
          targetMesh = child;
        }
      }
    }
  });

  const focusTarget = new THREE.Vector3();
  let focusDistance = modelMaxDim * 0.5;

  if (targetMesh) {
    const box = new THREE.Box3().setFromObject(targetMesh);
    box.getCenter(focusTarget);
    const size = box.getSize(new THREE.Vector3());
    focusDistance = Math.max(size.x, size.y, size.z) * 2.2;
    if (focusDistance < 0.1) focusDistance = modelMaxDim * 0.4;
  } else {
    focusTarget.set(0, modelHeight * 0.82, 0);
    focusDistance = modelMaxDim * 0.5;
  }

  const focusCameraPos = new THREE.Vector3(
    focusTarget.x,
    focusTarget.y,
    focusTarget.z + focusDistance
  );

  return { target: focusTarget, position: focusCameraPos };
}

window.onload = () => {
  init();
};
