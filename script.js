let scene = new THREE.Scene();

let camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.z = 3;

let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Light
let light = new THREE.HemisphereLight(0xffffff, 0x444444);
scene.add(light);

// Loader
let loader = new THREE.GLTFLoader();

// Load default model
loader.load('portalView.glb', (gltf) => {
  scene.add(gltf.scene);
});

// Upload support
document.getElementById('upload').addEventListener('change', (e) => {
  let file = e.target.files[0];
  let url = URL.createObjectURL(file);

  loader.load(url, (gltf) => {
    scene.clear();
    scene.add(light);
    scene.add(gltf.scene);
  });
});

// Webcam video
let video = document.createElement('video');

navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  video.srcObject = stream;
  video.play();
});

// MediaPipe FaceMesh
const faceMesh = new FaceMesh({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults((results) => {
  if (results.multiFaceLandmarks.length > 0) {
    let face = results.multiFaceLandmarks[0];

    let nose = face[1];

    let x = (nose.x - 0.5) * 4;
    let y = -(nose.y - 0.5) * 3;

    // simple depth estimate
    let z = 2 - face[10].z * 2;

    camera.position.x = x;
    camera.position.y = y;
    camera.position.z = z;

    camera.lookAt(0, 0, 0);
  }
});

// Run MediaPipe camera
const mpCamera = new Camera(video, {
  onFrame: async () => {
    await faceMesh.send({ image: video });
  },
  width: 640,
  height: 480
});

mpCamera.start();

// Render loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
