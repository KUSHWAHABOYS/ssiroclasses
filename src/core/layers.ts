export interface StageDimensions {
  width: number;
  height: number;
  dpr: number;
}

export class LayerManager {
  stageEl: HTMLElement;
  slideCanvas: HTMLCanvasElement;
  annotationCanvas: HTMLCanvasElement;
  previewCanvas: HTMLCanvasElement;

  slideCtx: CanvasRenderingContext2D;
  annotationCtx: CanvasRenderingContext2D;
  previewCtx: CanvasRenderingContext2D;

  private onResizeCallbacks: Array<(dims: StageDimensions) => void> = [];

  constructor() {
    this.stageEl = document.getElementById('stage') as HTMLElement;
    this.slideCanvas = document.getElementById('slideCanvas') as HTMLCanvasElement;
    this.annotationCanvas = document.getElementById('annotationCanvas') as HTMLCanvasElement;
    this.previewCanvas = document.getElementById('previewCanvas') as HTMLCanvasElement;

    // Use desynchronized where supported for lowest possible latency on 4K smart boards
    this.slideCtx = this.slideCanvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
    this.annotationCtx = this.annotationCanvas.getContext('2d', {
      alpha: true,
      desynchronized: true
    }) as CanvasRenderingContext2D;
    this.previewCtx = this.previewCanvas.getContext('2d', {
      alpha: true,
      desynchronized: true
    }) as CanvasRenderingContext2D;

    this.slideCtx.imageSmoothingEnabled = true;
    this.slideCtx.imageSmoothingQuality = 'high';

    this.initResizeListener();
  }

  private initResizeListener(): void {
    let resizeTimer: number;
    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        this.updateDimensions();
      }, 50);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
    this.updateDimensions();
  }

  updateDimensions(): StageDimensions {
    const rect = this.stageEl.getBoundingClientRect();
    const cssWidth = Math.max(320, Math.floor(rect.width || window.innerWidth));
    const cssHeight = Math.max(240, Math.floor(rect.height || window.innerHeight));
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    // Slide canvas
    this.slideCanvas.width = cssWidth;
    this.slideCanvas.height = cssHeight;
    this.slideCanvas.style.width = `${cssWidth}px`;
    this.slideCanvas.style.height = `${cssHeight}px`;

    // Annotation canvas (scaled by dpr for 4K sharpness)
    this.annotationCanvas.width = Math.floor(cssWidth * dpr);
    this.annotationCanvas.height = Math.floor(cssHeight * dpr);
    this.annotationCanvas.style.width = `${cssWidth}px`;
    this.annotationCanvas.style.height = `${cssHeight}px`;
    this.annotationCtx.resetTransform?.();
    this.annotationCtx.scale(dpr, dpr);
    this.annotationCtx.lineCap = 'round';
    this.annotationCtx.lineJoin = 'round';

    // Preview canvas
    this.previewCanvas.width = Math.floor(cssWidth * dpr);
    this.previewCanvas.height = Math.floor(cssHeight * dpr);
    this.previewCanvas.style.width = `${cssWidth}px`;
    this.previewCanvas.style.height = `${cssHeight}px`;
    this.previewCtx.resetTransform?.();
    this.previewCtx.scale(dpr, dpr);
    this.previewCtx.lineCap = 'round';
    this.previewCtx.lineJoin = 'round';

    const dims: StageDimensions = { width: cssWidth, height: cssHeight, dpr };
    for (const cb of this.onResizeCallbacks) {
      try {
        cb(dims);
      } catch (e) {
        console.error('Error in onResize callback:', e);
      }
    }
    return dims;
  }

  getDimensions(): StageDimensions {
    const rect = this.stageEl.getBoundingClientRect();
    return {
      width: rect.width || window.innerWidth,
      height: rect.height || window.innerHeight,
      dpr: Math.min(2, window.devicePixelRatio || 1)
    };
  }

  onResize(cb: (dims: StageDimensions) => void): void {
    this.onResizeCallbacks.push(cb);
  }

  // SSIRO-UPDATE: Inverse zoom coordinate conversion for drawing and ink
  private slideCoordsConverter?: (clientX: number, clientY: number) => { x: number; y: number };

  setSlideCoordsConverter(fn: (clientX: number, clientY: number) => { x: number; y: number }): void {
    this.slideCoordsConverter = fn;
  }

  toSlideCoords(clientX: number, clientY: number): { x: number; y: number } {
    if (this.slideCoordsConverter) {
      return this.slideCoordsConverter(clientX, clientY);
    }
    return this.toStageCoords(clientX, clientY);
  }

  toStageCoords(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.stageEl.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }
}

export const layerManager = new LayerManager();
