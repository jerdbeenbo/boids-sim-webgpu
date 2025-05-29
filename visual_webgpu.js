import init, { Flock } from './pkg/boids_sim.js';

//check to see if this browser can support websgpu
if (!navigator.gpu) {
    throw new Error("WebGPU not support on this browser.");
}

//get an adapter for webgpu
const adapter = await navigator.gpu.requestAdapter();
//check if adapter can be found
if (!adapter) {
  throw new Error("No appropriate GPUAdapter found.");
}

//once adapter is initialised, request GPU device, encoder and create workgroup size
const device = await adapter.requestDevice();
const encoder = device.createCommandEncoder();
const WORKGROUP_SIZE = 64;

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
    
    const flock = new Flock(1500);
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('webgpu');

    //configure canvas for webgpu
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({
        device: device,
        format: canvasFormat,
    });
    
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
            ctx.arc(positions[i], positions[i + 1], 1, 0, Math.PI * 2);
            ctx.fill();
        }
        
        updateFPS();
        requestAnimationFrame(animate);
    }
    
    requestAnimationFrame(animate);
}

run(); //start the simulation