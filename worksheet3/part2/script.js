// When the window has finished loading, execute the main function
window.onload = function () {
  main();
};

async function main() {
  const gpu = navigator.gpu;
  const adapter = await gpu.requestAdapter();
  console.log(adapter);
  const device = await adapter.requestDevice();
  const canvas = document.getElementById("c");
  const context =
    canvas.getContext("gpupresent") || canvas.getContext("webgpu");
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: canvasFormat,
  });
  const wgsl = device.createShaderModule({
    code: document.getElementById("wgsl").text,
  });

  // Function to get img data
  const getImgData = async () => {
    const image = document.getElementById("tex");
    const hiddenCanvas = document.getElementById("texcanvas");
    const ctx = hiddenCanvas.getContext("2d");
    ctx.drawImage(image, 0, 0, image.width, image.height);
    const imageData = ctx.getImageData(
      0,
      0,
      hiddenCanvas.width,
      hiddenCanvas.height
    );
    return imageData;
  };

  const GRASS = await getImgData();

  const uniformBuffer = device.createBuffer({
    size: 8, // number of bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  let textureData = new Uint8Array(GRASS.width * GRASS.height * 4);
  for (let i = 0; i < GRASS.height; ++i)
    for (let j = 0; j < GRASS.width; ++j)
      for (let k = 0; k < 4; ++k)
        textureData[(i * GRASS.width + j) * 4 + k] =
          GRASS.data[((GRASS.height - i - 1) * GRASS.width + j) * 4 + k];

  const texture = device.createTexture({
    size: [GRASS.width, GRASS.height, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
  });

  device.queue.writeTexture(
    { texture: texture },
    textureData,
    { offset: 0, bytesPerRow: GRASS.width * 4, rowsPerImage: GRASS.height },
    [GRASS.width, GRASS.height, 1]
  );

  let selectedWrapMode = "repeat";
  let selectedTexMode = "nearest";

  // Get references to the select elements
  const wrapModeSelect = document.getElementById("wrapMode");
  const filterModeSelect = document.getElementById("filterMode");

  texture.sampler = device.createSampler({
    addressModeU: selectedWrapMode,
    addressModeV: selectedWrapMode,
    minFilter: selectedTexMode,
    magFilter: selectedTexMode,
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

  let bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: texture.sampler },
      { binding: 1, resource: texture.createView() },
    ],
  });

  function tick() {
    const encoder = device.createCommandEncoder();

    texture.sampler = device.createSampler({
      addressModeU: selectedWrapMode,
      addressModeV: selectedWrapMode,
      minFilter: selectedTexMode,
      magFilter: selectedTexMode,
    });

    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.sampler },
        { binding: 1, resource: texture.createView() },
      ],
    });

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

  // Add event listeners to the select elements
  wrapModeSelect?.addEventListener("change", () => {
    selectedWrapMode = wrapModeSelect.value;
    tick();
  });

  filterModeSelect?.addEventListener("change", () => {
    selectedTexMode = filterModeSelect.value;
    tick();
  });

  tick();
}
