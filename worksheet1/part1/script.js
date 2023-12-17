// When the window loads, execute the main function
window.onload = function () {
  main();
};

async function main() {
  // Check for GPU availability in the user's system
  const gpu = navigator.gpu;

  // Request an adapter, which represents a physical GPU
  const adapter = await gpu.requestAdapter();

  // Request a device, which represents a logical GPU
  const device = await adapter.requestDevice();

  // Get the canvas element with ID "c"
  const canvas = document.getElementById("c");

  // Get the GPU rendering context from the canvas
  // Try to use "gpupresent" context, or fallback to "webgpu" context
  const context =
    canvas.getContext("gpupresent") || canvas.getContext("webgpu");

  // Get the preferred format for the canvas from the GPU
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

  // Configure the rendering context with the device and canvas format
  context.configure({
    device: device,
    format: canvasFormat,
  });

  // Create a render pass in a command buffer and prepare to submit it
  const encoder = device.createCommandEncoder();

  // Begin the render pass, specifying color attachments
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(), // Get the current texture view
        loadOp: "clear", // Clear the contents of the texture before rendering
        storeOp: "store", // Store the rendered contents
      },
    ],
  });

  // Insert rendering commands within this block

  // End the render pass
  pass.end();

  // Submit the command encoder to the device's queue for execution
  device.queue.submit([encoder.finish()]);
}
