// When the window has finished loading, execute the main function
window.onload = function () {
  main();
};

async function main() {
  const gpu = navigator.gpu;
  const adapter = await gpu.requestAdapter();
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

  const objDoc = new OBJDoc("teapot");
  try {
    const response = await fetch("../../common/objects/teapot.obj");
    if (response.ok) {
      const text = await response.text();
      const scale = 2;
      const reverse = true;
      await objDoc.parse(text, scale, reverse);
    }
  } catch (error) {
    console.log("ruh roh", error);
  }

  const drawingInfo = objDoc.getDrawingInfo();
  const vertices = drawingInfo.vertices;
  const indices = drawingInfo.indices;

  positionBuffer = device.createBuffer({
    size: (vertices.byteLength + 3) & ~3,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  indexBuffer = device.createBuffer({
    size: (indices.byteLength + 3) & ~3,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(positionBuffer, 0, vertices);
  device.queue.writeBuffer(indexBuffer, 0, indices);

  console.log("Number of Triangles: ", indices.length);

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
      frontFace: "ccw",
      cullMode: "back",
      stripIndexFormat: "uint32",
    },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: positionBuffer } },
      { binding: 1, resource: { buffer: indexBuffer } },
    ],
  });

  // GPURenderPassDescriptor
  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: undefined, // asign later in frame
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

  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
  renderPass.setPipeline(pipeline);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.draw(4, 1, 0, 0);

  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
}
