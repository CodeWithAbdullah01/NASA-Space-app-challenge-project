import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/controls/OrbitControls.js';

// Set up the scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

// Set renderer size
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set up controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;

// Set up camera position
camera.position.set(-3, 3, 5);

// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5);
scene.add(ambientLight);

// Create Sun
const sunGeometry = new THREE.SphereGeometry(1.5, 32, 32);
const sunTexture = new THREE.TextureLoader().load('sun.jpg');
const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture, transparent: true, opacity: 0.8 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

// Add a point light to the Sun
const sunLight = new THREE.PointLight(0xFFFF00, 1.5, 100);
sunLight.position.set(sun.position.x, sun.position.y, sun.position.z);
scene.add(sunLight);

// Add additional directional light for overall illumination
const additionalLight = new THREE.DirectionalLight(0xFFFFFF, 0.5);
additionalLight.position.set(5, 10, 5);
scene.add(additionalLight);

// Create Earth with texture
const earthGeometry = new THREE.SphereGeometry(0.2, 32, 32);
const earthTexture = new THREE.TextureLoader().load('eday.jpg');
const earthMaterial = new THREE.MeshStandardMaterial({ map: earthTexture });
const earth = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earth);

// Sidebar message
const messageDiv = document.createElement('div');
messageDiv.className = 'message';
messageDiv.innerHTML = 'Zoom in and click on an asteroid to show information related to it.';
messageDiv.style.position = 'absolute';
messageDiv.style.top = '10px';
messageDiv.style.right = '10px';
messageDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
messageDiv.style.padding = '10px';
messageDiv.style.borderRadius = '5px';
messageDiv.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
document.body.appendChild(messageDiv);

// Fetching data
const apiKey = 'Z1FfZbDm64vTkDJktG2CMMXdOiJbXB3Tm3tJtBOQ';
const today = new Date();
const startDate = today.toISOString().split('T')[0];
const endDate = startDate;

const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=${apiKey}`;

const asteroids = [];
const textureLoader = new THREE.TextureLoader();

// Load textures for asteroids
const textures = [
    textureLoader.load('asteroid3.jpg'),
    textureLoader.load('asteroid4.jpg')
];

// Function to create more realistic asteroid geometry
function realisticAsteroidGeometry() {
    const baseGeometry = new THREE.SphereGeometry(1, 16, 16);
    const positionAttribute = baseGeometry.attributes.position;

    for (let i = 0; i < positionAttribute.count; i++) {
        const noise = (Math.random() - 0.5) * 0.2;
        positionAttribute.setXYZ(i, 
            positionAttribute.getX(i) + noise, 
            positionAttribute.getY(i) + noise, 
            positionAttribute.getZ(i) + noise
        );
    }
    
    positionAttribute.needsUpdate = true;
    return baseGeometry;
}

// Create a function to generate a label for each asteroid
function createLabel(name, isHazardous) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontSize = 32;
    canvas.width = 256;
    canvas.height = 128;
    context.font = `${fontSize}px Arial`;
    context.fillStyle = isHazardous ? 'red' : 'white';
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    context.fillText(name, 10, fontSize);
    context.strokeText(name, 10, fontSize);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;

    const labelMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const labelSprite = new THREE.Sprite(labelMaterial);
    labelSprite.scale.set(1, 0.5, 1);
    return labelSprite;
}

let isAnimating = true; // State to control animation

function fetchAsteroids() {
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const nearEarthObjects = data.near_earth_objects;

            for (const date in nearEarthObjects) {
                const asteroidData = nearEarthObjects[date];

                asteroidData.forEach((asteroid) => {
                    const { name, estimated_diameter, close_approach_data, is_potentially_hazardous_asteroid } = asteroid;
                    const miss_distance = parseFloat(close_approach_data[0].miss_distance.kilometers);
                    const relative_velocity = parseFloat(close_approach_data[0].relative_velocity.kilometers_per_second);

                    const asteroidDiameter = (estimated_diameter.kilometers.estimated_diameter_min + estimated_diameter.kilometers.estimated_diameter_max) / 2;
                    const sizeRatio = asteroidDiameter / (2 * 6371);

                    const radius = Math.max(0.02, sizeRatio * 10);
                    const geometry = realisticAsteroidGeometry();
                    geometry.scale(radius, radius, radius);

                    const texture = textures[Math.floor(Math.random() * textures.length)];
                    const material = new THREE.MeshPhongMaterial({ map: texture });
                    const asteroidMesh = new THREE.Mesh(geometry, material);

                    const orbitRadius = 4 + (miss_distance / 100000000);
                    const angleOffset = Math.random() * Math.PI * 2;

                    asteroidMesh.position.x = orbitRadius * Math.cos(angleOffset);
                    asteroidMesh.position.z = orbitRadius * Math.sin(angleOffset);

                    scene.add(asteroidMesh);

                    const label = createLabel(name, is_potentially_hazardous_asteroid);
                    label.position.copy(asteroidMesh.position);
                    scene.add(label);

                    asteroids.push({
                        mesh: asteroidMesh,
                        label: label,
                        name: name,
                        diameter: estimated_diameter.kilometers,
                        miss_distance: miss_distance,
                        relative_velocity: relative_velocity,
                        hazardous: is_potentially_hazardous_asteroid,
                        angle: angleOffset,
                        speed: relative_velocity * 0.0001
                    });

                    asteroidMesh.userData = asteroid;
                });
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
            alert('Failed to fetch asteroid data. Please try again later.');
        });
}

function showAsteroidData(asteroid) {
    const hazardous = asteroid.is_potentially_hazardous_asteroid ? 'Yes' : 'No';
    messageDiv.innerHTML = 
        `<h3>${asteroid.name}</h3>
        <p><strong>Diameter:</strong> ${asteroid.estimated_diameter.kilometers.estimated_diameter_max.toFixed(2)} km</p>
        <p><strong>Miss Distance:</strong> ${asteroid.close_approach_data[0].miss_distance.kilometers} km</p>
        <p><strong>Relative Velocity:</strong> ${asteroid.close_approach_data[0].relative_velocity.kilometers_per_second} km/s</p>
        <p><strong>Hazardous:</strong> ${hazardous}</p>`;
}

function animate() {
    requestAnimationFrame(animate);

    if (isAnimating) {
        const earthOrbitSpeed = 0.0001;
        const time = performance.now() * earthOrbitSpeed;

        earth.position.x = 4 * Math.cos(time);
        earth.position.z = 4 * Math.sin(time);
        earth.rotation.y += 0.01;
        earth.rotation.x = 23.5 * (Math.PI / 180);

        sunLight.position.copy(sun.position);

        asteroids.forEach(asteroid => {
            asteroid.angle += asteroid.speed;
            const orbitRadius = 4 + (asteroid.miss_distance / 100000000);

            asteroid.mesh.position.x = orbitRadius * Math.cos(asteroid.angle);
            asteroid.mesh.position.z = orbitRadius * Math.sin(asteroid.angle);
            asteroid.label.position.copy(asteroid.mesh.position);

            const distance = camera.position.distanceTo(asteroid.label.position);
            const scale = Math.min(1 / distance, 18 / 32);
            asteroid.label.scale.set(scale, scale * 0.5, scale);

            const maxScale = 18 / 32;
            asteroid.label.scale.set(Math.min(scale, maxScale), Math.min(scale * 0.5, maxScale * 0.5), Math.min(scale, maxScale));
        });
    }

    controls.update();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Create control buttons
const buttonContainer = document.createElement('div');
buttonContainer.style.position = 'absolute';
buttonContainer.style.top = '10px';
buttonContainer.style.left = '10px';
buttonContainer.style.zIndex = '10';

const buttonStyle = `
    background-color: rgba(0, 128, 255, 0.8);
    color: white;
    border: none;
    padding: 10px;
    margin: 5px;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    cursor: pointer;
    transition: background-color 0.3s, transform 0.2s;
`;

const startButton = document.createElement('button');
startButton.innerText = 'Start Simulation';
startButton.style.cssText = buttonStyle;
startButton.onmouseenter = () => startButton.style.backgroundColor = 'rgba(0, 102, 204, 0.8)';
startButton.onmouseleave = () => startButton.style.backgroundColor = 'rgba(0, 128, 255, 0.8)';
startButton.onclick = () => {
    isAnimating = true;
};
buttonContainer.appendChild(startButton);

const stopButton = document.createElement('button');
stopButton.innerText = 'Stop Simulation';
stopButton.style.cssText = buttonStyle;
stopButton.onmouseenter = () => stopButton.style.backgroundColor = 'rgba(0, 102, 204, 0.8)';
stopButton.onmouseleave = () => stopButton.style.backgroundColor = 'rgba(0, 128, 255, 0.8)';
stopButton.onclick = () => {
    isAnimating = false;
};
buttonContainer.appendChild(stopButton);

document.body.appendChild(buttonContainer);

// Raycaster for detecting clicks on asteroids
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Event listener for mouse clicks
window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(asteroids.map(a => a.mesh));

    if (intersects.length > 0) {
        const asteroid = intersects[0].object.userData;
        showAsteroidData(asteroid);
    }
});

// Landing page logic
document.addEventListener('DOMContentLoaded', () => {
    const landingPage = document.getElementById('landing-page');
    const startButton = document.getElementById('start-button');

    startButton.addEventListener('click', () => {
        landingPage.classList.add('hidden');
        
        setTimeout(() => {
            fetchAsteroids().then(() => {
                animate();
            });
        }, 1000); 
    });
});

fetchAsteroids().then(() => {
    animate();
});
