let scene = new THREE.Scene();

// We initialize a standard camera, but we will overwrite its projection matrix manually every frame
let camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);

let renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lighting
let light = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
scene.add(light);
let dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(0, 5, 5);
scene.add(dirLight);

// Loader
let loader = new THREE.GLTFLoader();

loader.load('portalView.glb', (gltf) => {
  scene.add(gltf.scene);
});

document.getElementById('upload').addEventListener('change', (e) => {
  if(e.target.files.length === 0) return;
  let file = e.target.files[0];
  let url = URL.createObjectURL(file);

  loader.load(url, (gltf) => {
    scene.clear();
    scene.add(light);
    scene.add(dirLight);
    scene.add(gltf.scene);
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
// Define the physical size of the screen window in our 3D world
const screenWidth = 2.0; 
let screenHeight = screenWidth * (window.innerHeight / window.innerWidth);

// Smoothing variables to eliminate jitter
let currentPos = new THREE.Vector3(0, 0, 3);
let targetPos = new THREE.Vector3(0, 0, 3);

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
    // X is inverted so it acts like a mirror
    let rawX = (nose.x - 0.5) * -4.0; 
    let rawY = -(nose.y - 0.5) * 4.0;
    
    // Z depth scaling (FaceMesh Z is relative, we amplify it for depth perception)
    let rawZ = 2.5 + (face[10].z * -8.0); 

    // Constrain Z so the camera never clips through the monitor plane (Z=0)
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

  // 1. LERP (Linear Interpolation) to kill all jitter
  currentPos.lerp(targetPos, 0.15); // 0.15 is the smoothing factor. Lower = smoother but laggier.
  
  // 2. Move the camera, but DO NOT rotate it. Keep it looking straight ahead.
  camera.position.copy(currentPos);
  camera.rotation.set(0, 0, 0);

  // 3. OFF-AXIS PROJECTION (The Window Illusion)
  screenHeight = screenWidth * (window.innerHeight / window.innerWidth);
  
  let near = 0.1;
  let far = 1000;
  let dist = camera.position.z;

  // Calculate the physical boundaries of the screen relative to the camera's current position
  let left = -screenWidth / 2 - camera.position.x;
  let right = screenWidth / 2 - camera.position.x;
  let bottom = -screenHeight / 2 - camera.position.y;
  let top = screenHeight / 2 - camera.position.y;

  // Scale the boundaries down to the camera's near clipping plane
  let scale = near / dist;
  
  // Override the projection matrix entirely
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
