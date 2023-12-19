// When the window has finished loading, execute the main function
window.onload = function () {
  main();
};

//changing camera constant & aspect ratio
let width = 512;
let height = 512;
let frame = 0;

let positionBuffer;
let indexBuffer;
let normalBuffer;
let matIndicesBuffer;
let uniformBuffer;

//adding lenght of indices
let uniforms = new Float32Array([width, height, frame]);

async function main() {
  const gpu = navigator.gpu;
  const adapter = await gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const canvas = document.getElementById("c");
  const context =
    canvas.getContext("gpupresent") || canvas.getContext("webgpu");

  canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: canvasFormat,
  });
  wgsl = device.createShaderModule({
    code: document.getElementById("wgsl").text,
  });

  const objDoc = new OBJDoc("../../common/objects/CornellBoxWithBlocks.obj");
  try {
    const response = await fetch(
      "../../common/objects/CornellBoxWithBlocks.obj"
    );
    if (response.ok) {
      const text = await response.text();
      const scale = 1;
      const reverse = true;
      await objDoc.parse(text, scale, reverse);
    }
  } catch (error) {
    console.log("ruh roh", error);
  }

  const drawingInfo = objDoc.getDrawingInfo();

  const vertices = drawingInfo.vertices;
  const indices = drawingInfo.indices;
  const normals = drawingInfo.normals;
  const matIndices = drawingInfo.mat_indices;

  positionBuffer = await device.createBuffer({
    size: (vertices.byteLength + 3) & ~3,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  indexBuffer = await device.createBuffer({
    size: (indices.byteLength + 3) & ~3,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  normalBuffer = await device.createBuffer({
    size: (normals.byteLength + 3) & ~3,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  matIndicesBuffer = await device.createBuffer({
    size: (matIndices.byteLength + 3) & ~3,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  uniformBuffer = await device.createBuffer({
    size: 64, // number of bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  await device.queue.writeBuffer(positionBuffer, 0, vertices);
  await device.queue.writeBuffer(indexBuffer, 0, indices);
  await device.queue.writeBuffer(normalBuffer, 0, normals);
  await device.queue.writeBuffer(matIndicesBuffer, 0, matIndices);

  let textures = new Object();
  textures.width = canvas.width;
  textures.height = canvas.height;
  textures.renderSrc = device.createTexture({
    size: [canvas.width, canvas.height],
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    format: "rgba32float",
  });
  textures.renderDst = device.createTexture({
    size: [canvas.width, canvas.height],
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    format: "rgba32float",
  });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: wgsl,
      entryPoint: "main_vs",
    },
    fragment: {
      module: wgsl,
      entryPoint: "main_fs",
      targets: [{ format: canvasFormat }, { format: "rgba32float" }],
    },
    primitive: {
      topology: "triangle-strip",
    },
  });

  const render = async () => {
    frame += 1;
    let uniforms = new Uint32Array([width, height, frame]);

    // Parallelize GPU operations
    const writeBufferPromise = device.queue.writeBuffer(
      uniformBuffer,
      0,
      uniforms
    );

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: positionBuffer } },
        { binding: 1, resource: { buffer: indexBuffer } },
        { binding: 2, resource: { buffer: normalBuffer } },
        { binding: 3, resource: { buffer: matIndicesBuffer } },
        { binding: 4, resource: { buffer: uniformBuffer } },
        { binding: 5, resource: textures.renderDst.createView() },
      ],
    });

    const renderPassDescriptor = {
      colorAttachments: [
        {
          view: undefined,
          loadOp: "clear",
          clearValue: { r: 0.0, g: 0.5, b: 0.5, a: 1.0 },
          storeOp: "store",
        },
      ],
    };

    renderPassDescriptor.colorAttachments[0].view = context
      .getCurrentTexture()
      .createView();
    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: textures.renderSrc.createView(),
          loadOp: "load",
          storeOp: "store",
        },
      ],
    });

    // Wait for the GPU write operation to complete
    await writeBufferPromise;

    await renderPass.setPipeline(pipeline);
    await renderPass.setBindGroup(0, bindGroup);
    await renderPass.draw(4);
    await renderPass.end();

    commandEncoder.copyTextureToTexture(
      { texture: textures.renderSrc },
      { texture: textures.renderDst },
      [textures.width, textures.height]
    );

    await device.queue.submit([commandEncoder.finish()]);

    // Schedule the next frame
    requestAnimationFrame(render);
  };

  // Start the rendering loop
  render();
}
