// When the window has finished loading, execute the main function
window.onload = function () {
  main();
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

  // Create a render pass in a command buffer and submit it
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
  pass.draw(4); // Draw using 4 vertices
  pass.end();

  // Submit the command buffer to the GPU queue for execution
  device.queue.submit([encoder.finish()]);
}
