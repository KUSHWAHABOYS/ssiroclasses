// Test Setup: DOM & 2D Canvas Mock for Vitest
// Set up immediately so module top-level singletons can find DOM elements on import

const mockCtx = {
  save: () => {},
  restore: () => {},
  scale: () => {},
  resetTransform: () => {},
  translate: () => {},
  rotate: () => {},
  beginPath: () => {},
  closePath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
  arc: () => {},
  quadraticCurveTo: () => {},
  bezierCurveTo: () => {},
  rect: () => {},
  clearRect: () => {},
  fillRect: () => {},
  strokeRect: () => {},
  ellipse: () => {},
  fillText: () => {},
  measureText: (text: string) => ({ width: text.length * 12 }),
  setLineDash: () => {},
  drawImage: () => {},
  getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  putImageData: () => {},
  canvas: { width: 3840, height: 2160 },
  lineCap: 'round',
  lineJoin: 'round',
  lineWidth: 1,
  strokeStyle: '#000',
  fillStyle: '#000',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over'
} as any;

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function () {
    return mockCtx;
  } as any;

  HTMLCanvasElement.prototype.toDataURL = function () {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  };
}

if (typeof document !== 'undefined') {
  document.body.innerHTML = `
    <div id="stage" style="width: 3840px; height: 2160px;">
      <canvas id="slideCanvas" width="3840" height="2160"></canvas>
      <canvas id="annotationCanvas" width="3840" height="2160"></canvas>
      <canvas id="previewCanvas" width="3840" height="2160"></canvas>
      <div id="toolbarContainer"></div>
      <div id="toastContainer"></div>
      <div id="settingsPanel"></div>
    </div>
  `;
}
