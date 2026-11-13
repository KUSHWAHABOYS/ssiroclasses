import { DeckPage, store } from '../state/store';
import { layerManager, StageDimensions } from '../core/layers';

export interface RenderedSlideMetrics {
  destX: number;
  destY: number;
  destWidth: number;
  destHeight: number;
  scale: number;
  dominantColor: string;
}

interface CacheEntry {
  pageNumber: number;
  bitmap: ImageBitmap;
  metrics: RenderedSlideMetrics;
  lastUsed: number;
  viewW: number;
  viewH: number;
  fitMode: string;
}

export class SlideRenderer {
  private cache: Map<number, CacheEntry> = new Map();
  private maxCacheSize = 5;
  private currentMetrics: RenderedSlideMetrics = {
    destX: 0,
    destY: 0,
    destWidth: 1920,
    destHeight: 1080,
    scale: 1,
    dominantColor: '#000000'
  };

  getCurrentMetrics(): RenderedSlideMetrics {
    return this.currentMetrics;
  }

  // SSIRO-UPDATE: Expose current 3x bitmap for Magnifier Lens crisp rendering
  getCurrentBitmap(): ImageBitmap | null {
    const currentPage = store.getState().currentPage;
    return this.cache.get(currentPage)?.bitmap || null;
  }

  clearCache(): void {
    for (const entry of this.cache.values()) {
      entry.bitmap.close?.();
    }
    this.cache.clear();
  }

  async renderSlide(page: DeckPage, dims?: StageDimensions): Promise<RenderedSlideMetrics> {
    const stageDims = dims || layerManager.getDimensions();
    const { width: viewW, height: viewH } = stageDims;
    const currentFitMode = store.getState().settings.fitMode;

    // Check cache: must match pageNumber, viewport dimensions AND fitMode
    const cached = this.cache.get(page.pageNumber);
    if (cached && cached.viewW === viewW && cached.viewH === viewH && cached.fitMode === currentFitMode) {
      cached.lastUsed = Date.now();
      this.blitToSlideCanvas(cached.bitmap, cached.metrics, viewW, viewH);
      this.currentMetrics = cached.metrics;
      store.setState({ dominantEdgeColor: cached.metrics.dominantColor });
      return cached.metrics;
    }

    // Render fresh
    const { bitmap, metrics } = await this.renderPageToBitmap(page, viewW, viewH);
    this.setCache(page.pageNumber, bitmap, metrics, viewW, viewH, currentFitMode);
    this.blitToSlideCanvas(bitmap, metrics, viewW, viewH);
    this.currentMetrics = metrics;
    store.setState({ dominantEdgeColor: metrics.dominantColor });

    return metrics;
  }

  // Pre-render adjacent pages for instant navigation
  async preRenderAdjacent(pages: DeckPage[], currentPage: number): Promise<void> {
    const dims = layerManager.getDimensions();
    const currentFitMode = store.getState().settings.fitMode;
    const nextIdx = currentPage; // 1-based next page is at index currentPage
    const prevIdx = currentPage - 2;

    if (nextIdx < pages.length && !this.cache.has(pages[nextIdx].pageNumber)) {
      this.renderPageToBitmap(pages[nextIdx], dims.width, dims.height)
        .then(({ bitmap, metrics }) => this.setCache(pages[nextIdx].pageNumber, bitmap, metrics, dims.width, dims.height, currentFitMode))
        .catch(() => {});
    }

    if (prevIdx >= 0 && !this.cache.has(pages[prevIdx].pageNumber)) {
      this.renderPageToBitmap(pages[prevIdx], dims.width, dims.height)
        .then(({ bitmap, metrics }) => this.setCache(pages[prevIdx].pageNumber, bitmap, metrics, dims.width, dims.height, currentFitMode))
        .catch(() => {});
    }
  }

  private async renderPageToBitmap(
    page: DeckPage,
    viewW: number,
    viewH: number
  ): Promise<{ bitmap: ImageBitmap; metrics: RenderedSlideMetrics }> {
    const { fitMode, renderQuality } = store.getState().settings;

    // Compute fit vs fill vs stretch layout
    const srcW = page.width;
    const srcH = page.height;

    let destW = viewW;
    let destH = viewH;
    let destX = 0;
    let destY = 0;
    let baseScale = 1;

    if (fitMode === 'fill') {
      const scaleW = viewW / srcW;
      const scaleH = viewH / srcH;
      // Full View / Fill: fill viewport completely without aspect ratio distortion
      const maxScale = Math.max(scaleW, scaleH);
      baseScale = maxScale;
      destW = srcW * baseScale;
      destH = srcH * baseScale;
      destX = (viewW - destW) / 2;
      destY = (viewH - destH) / 2;
    } else if (fitMode === 'stretch') {
      destW = viewW;
      destH = viewH;
      destX = 0;
      destY = 0;
      baseScale = Math.min(viewW / srcW, viewH / srcH);
    } else {
      // 'fit' (default) - uniform scale, no distortion
      const scaleW = viewW / srcW;
      const scaleH = viewH / srcH;
      baseScale = Math.min(scaleW, scaleH);
      destW = srcW * baseScale;
      destH = srcH * baseScale;
      destX = (viewW - destW) / 2;
      destY = (viewH - destH) / 2;
    }

    // Physical pixel target on 4K display:
    const dpr = layerManager.getDimensions().dpr || 1;
    const physicalTargetW = destW * dpr;

    // Supersampling multiplier: Ensure vector PDF rasterization targets physical display pixels (4K UHD)
    let targetMultiplier = renderQuality === '2x' ? 1.0 : (dpr >= 2 ? 1.5 : 2.0);
    const maxDimension = 8192;
    const maxSafeScale = Math.min(maxDimension / srcW, maxDimension / srcH, 6.0);

    let effectiveScale = Math.min((physicalTargetW / srcW) * targetMultiplier, maxSafeScale);
    // Never fall below 1:1 physical pixel density
    effectiveScale = Math.max(effectiveScale, baseScale * dpr);

    // Build offscreen canvas
    let offscreenW = Math.max(1, Math.floor(srcW * effectiveScale));
    let offscreenH = Math.max(1, Math.floor(srcH * effectiveScale));

    // Cap total megapixels (~64 MP safety ceiling for Android 4K WebView memory)
    if (offscreenW * offscreenH > 64_000_000) {
      effectiveScale = Math.min(physicalTargetW / srcW, maxSafeScale);
      offscreenW = Math.floor(srcW * effectiveScale);
      offscreenH = Math.floor(srcH * effectiveScale);
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = offscreenW;
    offscreen.height = offscreenH;
    const offCtx = offscreen.getContext('2d', { alpha: false })!;
    offCtx.imageSmoothingEnabled = true;
    offCtx.imageSmoothingQuality = 'high';

    if (page.sourceType === 'pdf') {
      const pageProxy = page.renderData;
      const viewport = pageProxy.getViewport({ scale: effectiveScale });
      await pageProxy.render({
        canvasContext: offCtx,
        viewport
      }).promise;
    } else if (page.sourceType === 'image' || page.sourceType === 'canvas') {
      offCtx.drawImage(page.renderData, 0, 0, offscreenW, offscreenH);
    }

    // AUDIT-FIX: BUG-010 - Apply manual crop or auto-trim if enabled (ZEN-5)
    const { autoTrimMargins, manualCropTop = 0, manualCropBottom = 0, manualCropLeft = 0, manualCropRight = 0 } = store.getState().settings;
    let finalCanvas = offscreen;
    if (manualCropTop > 0 || manualCropBottom > 0 || manualCropLeft > 0 || manualCropRight > 0) {
      const cropL = Math.floor((manualCropLeft / 100) * offscreenW);
      const cropR = Math.floor((manualCropRight / 100) * offscreenW);
      const cropT = Math.floor((manualCropTop / 100) * offscreenH);
      const cropB = Math.floor((manualCropBottom / 100) * offscreenH);
      const croppedW = Math.max(10, offscreenW - cropL - cropR);
      const croppedH = Math.max(10, offscreenH - cropT - cropB);

      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = croppedW;
      croppedCanvas.height = croppedH;
      const cropCtx = croppedCanvas.getContext('2d')!;
      cropCtx.drawImage(offscreen, cropL, cropT, croppedW, croppedH, 0, 0, croppedW, croppedH);
      finalCanvas = croppedCanvas;
    }

    // Sample 4 corners to extract dominant edge background color
    const dominantColor = this.sampleCornerColor(offCtx, offscreenW, offscreenH);

    const bitmap = await createImageBitmap(finalCanvas);
    const metrics: RenderedSlideMetrics = {
      destX: Math.round(destX),
      destY: Math.round(destY),
      destWidth: Math.round(destW),
      destHeight: Math.round(destH),
      scale: effectiveScale,
      dominantColor
    };

    return { bitmap, metrics };
  }

  private sampleCornerColor(ctx: CanvasRenderingContext2D, w: number, h: number): string {
    try {
      // Sample 4 corners (4x4 pixels each)
      const samples = [
        ctx.getImageData(2, 2, 1, 1).data,
        ctx.getImageData(w - 3, 2, 1, 1).data,
        ctx.getImageData(2, h - 3, 1, 1).data,
        ctx.getImageData(w - 3, h - 3, 1, 1).data
      ];

      let r = 0, g = 0, b = 0;
      for (const s of samples) {
        r += s[0];
        g += s[1];
        b += s[2];
      }
      r = Math.round(r / 4);
      g = Math.round(g / 4);
      b = Math.round(b / 4);

      return `rgb(${r}, ${g}, ${b})`;
    } catch {
      return '#000000';
    }
  }

  private blitToSlideCanvas(bitmap: ImageBitmap, m: RenderedSlideMetrics, viewW: number, viewH: number): void {
    const ctx = layerManager.slideCtx;
    const dpr = layerManager.getDimensions().dpr || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // AUDIT-FIX: BUG-010 - Support remainder fill modes: background, blur, black (ZEN-6)
    const { streamRemainderMode } = store.getState().settings;
    if (streamRemainderMode === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, viewW, viewH);
    } else if (streamRemainderMode === 'blur') {
      ctx.save();
      ctx.filter = 'blur(16px)';
      ctx.drawImage(bitmap, 0, 0, viewW, viewH);
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.restore();
    } else {
      // 'background' (default) - Fill surrounding area with sampled dominant edge color
      ctx.fillStyle = m.dominantColor;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    // Blit supersampled bitmap with pristine 4K sharpness
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, m.destX, m.destY, m.destWidth, m.destHeight);

    ctx.restore();
  }

  private setCache(
    pageNumber: number,
    bitmap: ImageBitmap,
    metrics: RenderedSlideMetrics,
    viewW: number,
    viewH: number,
    fitMode: string
  ): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Evict least recently used
      let oldestKey: number | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.cache.entries()) {
        if (v.lastUsed < oldestTime) {
          oldestTime = v.lastUsed;
          oldestKey = k;
        }
      }
      if (oldestKey !== null) {
        this.cache.get(oldestKey)?.bitmap.close?.();
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(pageNumber, { pageNumber, bitmap, metrics, lastUsed: Date.now(), viewW, viewH, fitMode });
  }
}

export const slideRenderer = new SlideRenderer();
