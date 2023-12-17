// When the window has finished loading, execute the main function
window.onload = function () {
  main();
};

const colors = {
  red: { r: 0.8, g: 0.2, b: 0.2 },
  green: { r: 0.2, g: 0.6, b: 0.2 },
  yellow: { r: 0.8, g: 0.8, b: 0.2 },
  orange: { r: 0.8, g: 0.4, b: 0.0 },
  pink: { r: 0.8, g: 0.5, b: 0.6 },
  teal: { r: 0.2, g: 0.4, b: 0.4 },
  cyan: { r: 0.0, g: 0.8, b: 0.8 },
  lavender: { r: 0.7, g: 0.5, b: 0.7 },
};

const shaders = {
  Plain: 0,
  Lambertian: 1,
  Phong: 2,
  Mirror: 3,
  Glass: 4,
};

const plane = {
  Plain: 0,
  Checkered: 2,
};

async function main() {
  // Get the GPU object from the browser
  const gpu = navigator.gpu;

  // Request a GPU adapter (physical GPU device)
  const adapter = await gpu.requestAdapter();

  // Request a GPU device from the adapter
  const device = await adapter.requestDevice();

  // Get the canvas element by its ID
  const canvas = document.getElementById("c");

  // Get the GPU context for rendering on the canvas
  const context =
    canvas.getContext("gpupresent") || canvas.getContext("webgpu");

  // Get the preferred format for the canvas
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

  // Configure the GPU context with the device and canvas format
  context.configure({
    device: device,
    format: canvasFormat,
  });

  // Create a WebGPU shader module from the WGSL code in the HTML
  const wgsl = device.createShaderModule({
    code: document.getElementById("wgsl").text,
  });

  // Create a render pipeline with vertex and fragment shaders
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: wgsl,
      entryPoint: "main_vs",
    },
    fragment: {
      module: wgsl,
      entryPoint: "main_fs",
      targets: [{ format: canvasFormat }],
    },
    primitive: {
      topology: "triangle-strip",
    },
  });

  const uniformBuffer = device.createBuffer({
    size: 35, // number of bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuffer },
      },
    ],
  });

  let intensity = 2.0;
  let r = colors["red"].r;
  let g = colors["red"].g;
  let b = colors["red"].b;
  let s = 0;
  let p = 1;
  let ri = 1.6;

  const materialSelector = document.getElementById("materialSelector");

  for (const material in shaders) {
    const option = document.createElement("option");
    option.value = material;
    option.textContent = material.charAt(0).toUpperCase() + material.slice(1); // Capitalize the color name
    materialSelector.appendChild(option);
  }

  materialSelector.addEventListener("change", () => {
    const selectedMaterial = materialSelector.value;
    s = shaders[selectedMaterial];
    tick();
  });

  let uniforms = new Float32Array([r, g, b, s, intensity, p, ri]);
  device.queue.writeBuffer(uniformBuffer, 0, uniforms);

  function tick() {
    let uniforms = new Float32Array([r, g, b, s, intensity, p, ri]);
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(4); // Draw using 4 vertices
    pass.end();

    // Submit the command buffer to the GPU queue for execution
    device.queue.submit([encoder.finish()]);
  }

  tick();
}
