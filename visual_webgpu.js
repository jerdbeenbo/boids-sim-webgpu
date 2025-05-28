import init, { Flock } from './pkg/boids_sim.js';

const BOID_AMOUNT = 3000;

// Check WebGPU support
if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.");
}

// Get adapter and device
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.");
}

const device = await adapter.requestDevice();

// Shader code - the "instructions" for the GPU
const shaderCode = `
    @group(0) @binding(0) var<storage, read> boidPositions: array<vec2f>;

    @vertex
    fn vs_main(
        @builtin(vertex_index) vertexIndex: u32,
        @builtin(instance_index) instanceIndex: u32
    ) -> @builtin(position) vec4f {
        // Triangle shape for boid
        let triangle = array<vec2f, 3>(
            vec2f( 0.0, -2.0),   // top
            vec2f(-1.0,  1.0),   // bottom left  
            vec2f( 1.0,  1.0)    // bottom right
        );
        
        // Get this boid's position from the buffer
        let boidPos = boidPositions[instanceIndex];
        
        // Add triangle vertex to boid position
        let worldPos = triangle[vertexIndex] + boidPos;
        
        // Convert to clip space (your canvas is 1200x800)
        let clipPos = vec2f(
            (worldPos.x / 600.0) - 1.0,   // -1 to 1
            1.0 - (worldPos.y / 400.0)    // -1 to 1, flipped Y
        );
        
        return vec4f(clipPos, 0.0, 1.0);
    }

    @fragment
    fn fs_main() -> @location(0) vec4f {
        return vec4f(1.0, 1.0, 0.0, 1.0); // yellow
    }
`;

// FPS tracking
let lastCalledTime = performance.now();
let frameCount = 0;
let fps = 0;

function updateFPS() {
    const now = performance.now();
    const delta = (now - lastCalledTime) / 1000;
    lastCalledTime = now;
    fps = 1 / delta;
    
    frameCount++;
    if (frameCount % 60 === 0) {
        document.getElementById('fps-display').textContent = `FPS: ${fps.toFixed(1)}`;
    }
}

async function run() {
    await init();
    
    const flock = new Flock(BOID_AMOUNT);
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('webgpu');

    // Configure canvas
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat,
    });

    // Create shader module
    const shaderModule = device.createShaderModule({
        code: shaderCode
    });

    // Create buffer for boid positions
    const positionBuffer = device.createBuffer({
        size: BOID_AMOUNT * 2 * 4, // N boids * 2 floats * 4 bytes each
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Create bind group layout (describes what data shaders expect)
    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "read-only-storage" }
        }]
    });

    // Create bind group (connects actual buffer to layout)
    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: positionBuffer }
        }]
    });

    // Create render pipeline
    const renderPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        }),
        vertex: {
            module: shaderModule,
            entryPoint: "vs_main",
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fs_main",
            targets: [{
                format: canvasFormat
            }]
        },
        primitive: {
            topology: "triangle-list",
        }
    });

    let lastTime = 0;
    
    function animate(currentTime) {
        // Calculate delta time
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        
        // Update boid simulation
        if (deltaTime > 0 && deltaTime < 0.1) {
            flock.update_with_delta(deltaTime);
        }
        
        // Get positions and upload to GPU
        const positions = flock.get_positions();
        device.queue.writeBuffer(positionBuffer, 0, new Float32Array(positions));

        // Create command encoder
        const encoder = device.createCommandEncoder();
        
        // Begin render pass
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: "clear",
                storeOp: "store",
            }]
        });

        // Set pipeline and draw
        pass.setPipeline(renderPipeline);
        pass.setBindGroup(0, bindGroup); // Bind the position data
        pass.draw(3, BOID_AMOUNT); // 3 vertices per triangle, n instances (boids)
        pass.end();

        // Submit commands
        device.queue.submit([encoder.finish()]);
        
        updateFPS();
        requestAnimationFrame(animate);
    }
    
    requestAnimationFrame(animate);
}

run();