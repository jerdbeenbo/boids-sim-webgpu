import init, { Flock } from './pkg/boids_sim.js';

//for tracking FPS
let lastCalledTime = performance.now();
let frameCount = 0;
let fps = 0;
let lastTime = 0;
const targetFPS = 60;
const interval = 1000 / targetFPS;  //milliseconds / frame

function updateFPS() {
    const now = performance.now();
    const delta = (now - lastCalledTime) / 1000;  // Fix: divide by 1000 outside parentheses
    lastCalledTime = now;
    fps = 1 / delta;
    
    frameCount++;
    
    // Display FPS every 60 frames to avoid flickering
    if (frameCount % 60 === 0) {
        //console.log(`FPS: ${fps.toFixed(1)}`);
        //display on screen:
        document.getElementById('fps-display').textContent = `FPS: ${fps.toFixed(1)}`;
    }
}

async function run() {
    await init();
    
    const flock = new Flock(600);
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    let lastTime = 0;
    
    function animate(currentTime) {
        // Calculate delta time in seconds
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        
        // Skip first frame (no valid delta)
        if (deltaTime > 0 && deltaTime < 0.1) { // Cap at 0.1s to handle tab switching
            flock.update_with_delta(deltaTime);
        }
        
        const positions = flock.get_positions();

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "yellow";
        
        for (let i = 0; i < positions.length; i += 2) {
            ctx.beginPath();
            ctx.arc(positions[i], positions[i + 1], 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        updateFPS();
        requestAnimationFrame(animate);
    }
    
    requestAnimationFrame(animate);
}

run(); //start the simulation