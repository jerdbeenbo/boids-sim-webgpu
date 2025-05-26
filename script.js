import init, { Flock } from './pkg/boids_sim.js';

async function run() {
    await init();
    
    const flock = new Flock(100);
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    function animate() {
        flock.update();
        const positions = flock.get_positions();
        
        // Clear and draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < positions.length; i += 2) {
            ctx.beginPath();
            ctx.arc(positions[i], positions[i + 1], 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        requestAnimationFrame(animate);
    }
    animate();
}

run();  //Start the simulation