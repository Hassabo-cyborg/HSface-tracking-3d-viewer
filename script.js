let scene = new THREE.Scene();

// We initialize a standard camera, but we overwrite its projection matrix manually every frame
let camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 1000);

let renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lighting - Boosted to make the depth pop
let light = new THREE.HemisphereLight(0xffffff, 0x222222, 1.2);
scene.add(light);
let dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(2, 5, 5);
scene.add(dirLight);

// --- THE SECRET TO THE BOX ILLUSION ---
// We create a container and push it BACKWARD into the screen.
// This is what creates the "looking through a window" depth.
let modelContainer = new THREE.Group();
modelContainer.position.z = -1.5; // Push it 1.5 meters inside the monitor
scene.add(modelContainer);

// Loader
let loader = new THREE.GLTFLoader();

loader.load('portalView.glb', (gltf) => {
  modelContainer.add(gltf.scene);
});

document.getElementById('upload').addEventListener('change', (e) => {
  if(e.target.files.length === 0) return;
  let file = e.target.files[0];
  let url = URL.createObjectURL(file);

  loader.load(url, (gltf) => {
    // Clear the container, not the whole scene, so we keep our lights
    while(modelContainer.children.length > 0){ 
        modelContainer.remove(modelContainer.children[0]); 
    }
    modelContainer.add(gltf.scene);
  });
});

// Webcam setup
let video = document.createElement('video');
navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  video.srcObject = stream;
  video.play();
});

// UI Elements
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');
let isTrackingActive = false;

// --- 3D ILLUSION CALIBRATION --- //
const screenWidth = 2.0; 
let screenHeight = screenWidth * (window.innerHeight / window.innerWidth);

// Start the camera at a normal viewing distance (Z=2)
let currentPos = new THREE.Vector3(0, 0, 2);
let targetPos = new THREE.Vector3(0, 0, 2);

// FaceMesh Setup
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults((results) => {
  if (results.multiFaceLandmarks.length > 0) {
    if (!isTrackingActive && statusBadge) {
      statusBadge.classList.add('status-ready');
      statusText.innerText = "Tracking Active";
      isTrackingActive = true;
    }

    let face = results.multiFaceLandmarks[0];
    let nose = face[1];

    // 1. Map FaceMesh coordinates to physical movement
    // Reduced sensitivity to 1.5 (from 4.0) for realism
    // X is POSITIVE now to fix the reversed "mirror" effect
    let rawX = -(nose.x - 0.5) * 1.5; 
    let rawY = (nose.y - 0.5) * 1.5;
    
    // Minimal Z shifting. The illusion relies primarily on X/Y parallax
    let rawZ = 2.0 + (face[10].z * -1.0); 

    targetPos.set(rawX, rawY, Math.max(0.5, rawZ));
  }
});

const mpCamera = new Camera(video, {
  onFrame: async () => { await faceMesh.send({ image: video }); },
  width: 640,
  height: 480
});
mpCamera.start();

// --- RENDER LOOP & OFF-AXIS MATH --- //
function animate() {
  requestAnimationFrame(animate);

  // Smooth the movement heavily to feel like physical mass
  currentPos.lerp(targetPos, 0.12); 
  
  // Camera strictly follows position, ZERO rotation
  camera.position.copy(currentPos);
  camera.rotation.set(0, 0, 0);

  // --- OFF-AXIS PROJECTION (The Window Illusion) ---
  screenHeight = screenWidth * (window.innerHeight / window.innerWidth);
  
  let near = 0.01; // Pulled near plane much closer to prevent clipping
  let far = 1000;
  let dist = camera.position.z;

  // Calculate the physical boundaries of the screen relative to the camera
  let left = -screenWidth / 2 - camera.position.x;
  let right = screenWidth / 2 - camera.position.x;
  let bottom = -screenHeight / 2 - camera.position.y;
  let top = screenHeight / 2 - camera.position.y;

  // Scale the boundaries down to the camera's near clipping plane
  let scale = near / dist;
  
  // Override the projection matrix entirely to skew the lens
  camera.projectionMatrix.makePerspective(
    left * scale,
    right * scale,
    top * scale,
    bottom * scale,
    near,
    far
  );

  renderer.render(scene, camera);
}

animate();
