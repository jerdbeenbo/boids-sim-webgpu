//check to see if this browser can support webgpu
if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.");
}

//get an adapter for webgpu
const adapter = await navigator.gpu.requestAdapter();
//check if adapter can be found
if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.");
}

//once adapter is initialised, request GPU device
const device = await adapter.requestDevice();

const NUM_BOIDS = 12500;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const WORKGROUP_SIZE = 64;

//for tracking FPS
let lastCalledTime = performance.now();
let frameCount = 0;
let fps = 0;

function updateFPS() {
    const now = performance.now();
    const delta = (now - lastCalledTime) / 1000;
    lastCalledTime = now;
    fps = 1 / delta;
    
    frameCount++;
    
    // Display FPS every 60 frames to avoid flickering
    if (frameCount % 60 === 0) {
        document.getElementById('fps-display').textContent = `FPS: ${fps.toFixed(1)} | Boids: ${NUM_BOIDS}`;
    }
}

// Load your compute shader
async function loadComputeShader() {
    const response = await fetch('./compute_shader.wgsl');
    return await response.text();
}

// Render shader for drawing boids
const renderShaderCode = `
    struct Boid {
        position: vec2f,
        velocity: vec2f,
        acceleration: vec2f,
        max_speed: f32,
        max_force: f32,
    }

    @group(0) @binding(0) var<storage, read> boids: array<Boid>;

    @vertex
    fn vs_main(
        @builtin(vertex_index) vertexIndex: u32,
        @builtin(instance_index) instanceIndex: u32
    ) -> @builtin(position) vec4f {
        // Triangle shape
        let triangle = array<vec2f, 3>(
            vec2f( 0.0, -0.5),   // top
            vec2f(-1.0,  1.0),   // bottom left  
            vec2f( 1.0,  1.0)    // bottom right
        );
        
        let boidPos = boids[instanceIndex].position;
        let worldPos = triangle[vertexIndex] + boidPos;
        
        // Convert to clip space
        let clipPos = vec2f(
            (worldPos.x / 600.0) - 1.0,
            1.0 - (worldPos.y / 400.0)
        );
        
        return vec4f(clipPos, 0.0, 1.0);
    }

    @fragment
    fn fs_main() -> @location(0) vec4f {
        return vec4f(1.0, 1.0, 0.0, 1.0); // yellow
    }
`;

async function run() {
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('webgpu');

    // Configure canvas
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat,
    });

    // Load your compute shader
    const computeShaderCode = await loadComputeShader();

    // Create buffers
    const boidDataSize = NUM_BOIDS * 5 * 4; // 5 floats per boid * 4 bytes (position, velocity, acceleration, max_speed, max_force)
    const boidBuffer = device.createBuffer({
        size: boidDataSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const paramsBuffer = device.createBuffer({
        size: 16, // 4 floats * 4 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Initialize boids with random positions and velocities
    const initialBoidData = new Float32Array(NUM_BOIDS * 5);
    for (let i = 0; i < NUM_BOIDS; i++) {
        const baseIndex = i * 5;
        initialBoidData[baseIndex + 0] = Math.random() * CANVAS_WIDTH;      // x position
        initialBoidData[baseIndex + 1] = Math.random() * CANVAS_HEIGHT;     // y position  
        initialBoidData[baseIndex + 2] = (Math.random() - 0.5) * 4.0;       // x velocity
        initialBoidData[baseIndex + 3] = (Math.random() - 0.5) * 4.0;       // y velocity
        initialBoidData[baseIndex + 4] = 0.0;                               // x acceleration
        // Note: max_speed and max_force are constants in your shader, so we don't need to store them per boid
    }
    device.queue.writeBuffer(boidBuffer, 0, initialBoidData);

    // Create compute pipeline
    const computeShaderModule = device.createShaderModule({ code: computeShaderCode });
    const computeBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
        ]
    });

    const computePipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
        compute: { module: computeShaderModule, entryPoint: "main" }
    });

    const computeBindGroup = device.createBindGroup({
        layout: computeBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: boidBuffer } },
            { binding: 1, resource: { buffer: paramsBuffer } }
        ]
    });

    // Create render pipeline
    const renderShaderModule = device.createShaderModule({ code: renderShaderCode });
    const renderBindGroupLayout = device.createBindGroupLayout({
        entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } }]
    });

    const renderPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
        vertex: { module: renderShaderModule, entryPoint: "vs_main" },
        fragment: {
            module: renderShaderModule,
            entryPoint: "fs_main",
            targets: [{ format: canvasFormat }]
        },
        primitive: { topology: "triangle-list" }
    });

    const renderBindGroup = device.createBindGroup({
        layout: renderBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: boidBuffer } }]
    });

    let lastFrameTime = 0;
    
    function animate(currentTime) {
        const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.016); // Cap at 60fps
        lastFrameTime = currentTime;
        
        if (deltaTime > 0) {
            // Update parameters for your compute shader
            const params = new Float32Array([deltaTime, CANVAS_WIDTH, CANVAS_HEIGHT, NUM_BOIDS]);
            device.queue.writeBuffer(paramsBuffer, 0, params);

            const encoder = device.createCommandEncoder();

            // Compute pass - runs your WGSL compute shader
            const computePass = encoder.beginComputePass();
            computePass.setPipeline(computePipeline);
            computePass.setBindGroup(0, computeBindGroup);
            computePass.dispatchWorkgroups(Math.ceil(NUM_BOIDS / WORKGROUP_SIZE));
            computePass.end();

            // Render pass - draws the results
            const renderPass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store",
                }]
            });

            renderPass.setPipeline(renderPipeline);
            renderPass.setBindGroup(0, renderBindGroup);
            renderPass.draw(3, NUM_BOIDS); // 3 vertices per triangle, NUM_BOIDS instances
            renderPass.end();

            device.queue.submit([encoder.finish()]);
        }
        
        updateFPS();
        requestAnimationFrame(animate);
    }
    
    requestAnimationFrame(animate);
}

run();