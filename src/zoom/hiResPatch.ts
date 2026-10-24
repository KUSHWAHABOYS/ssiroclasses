// SSIRO-UPDATE: Hi-Res Patch Renderer for Magnifier Lens & Zoom
import { store } from '../state/store';
import { layerManager } from '../core/layers';

export interface PatchCrop {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
}

export interface RenderedPatch {
  canvas: HTMLCanvasElement;
  crop: PatchCrop;
  ready: boolean;
}

export class HiResPatchManager {
  private activePatches: Map<string, RenderedPatch> = new Map();
  private debounceTimer = 0;

  /**
   * Request a hi-res crop for the lens or visible screen area.
   */
  requestPatch(
    id: string,
    crop: PatchCrop,
    onReady: (patch: RenderedPatch) => void
  ): void {
    window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(async () => {
      try {
        const patch = await this.renderPatch(crop);
        if (patch) {
          this.activePatches.set(id, patch);
          onReady(patch);
        }
      } catch (e) {
        console.warn('Hi-res patch render skipped:', e);
      }
    }, 120);
  }

  getPatch(id: string): RenderedPatch | null {
    return this.activePatches.get(id) || null;
  }

  /**
   * Release all patches on slide change or clear.
   */
  clear(): void {
    window.clearTimeout(this.debounceTimer);
    this.activePatches.clear();
  }

  private async renderPatch(crop: PatchCrop): Promise<RenderedPatch | null> {
    const currentDeck = store.getState().currentDeck;
    const currentPageNum = store.getState().currentPage;
    if (!currentDeck || !currentDeck.pages) return null;

    const page = currentDeck.pages[currentPageNum - 1];
    if (!page) return null;

    // Cap at 8192px and 40 megapixels per spec
    const maxDim = 8192;
    const maxPixels = 40_000_000;

    let targetW = Math.max(1, Math.round(crop.sourceWidth * crop.scale));
    let targetH = Math.max(1, Math.round(crop.sourceHeight * crop.scale));

    if (targetW > maxDim || targetH > maxDim || targetW * targetH > maxPixels) {
      const downScale = Math.min(maxDim / targetW, maxDim / targetH, Math.sqrt(maxPixels / (targetW * targetH)));
      targetW = Math.max(1, Math.floor(targetW * downScale));
      targetH = Math.max(1, Math.floor(targetH * downScale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (page.sourceType === 'pdf' && page.renderData) {
      const pageProxy = page.renderData;
      // Calculate viewport taking into account crop offset
      const viewport = pageProxy.getViewport({ scale: crop.scale });
      const transform = [
        1, 0, 0, 1,
        -crop.sourceX * crop.scale,
        -crop.sourceY * crop.scale
      ];

      await pageProxy.render({
        canvasContext: ctx,
        viewport,
        transform
      }).promise;
    } else if (page.renderData) {
      ctx.drawImage(
        page.renderData,
        crop.sourceX,
        crop.sourceY,
        crop.sourceWidth,
        crop.sourceHeight,
        0,
        0,
        targetW,
        targetH
      );
    }

    return {
      canvas,
      crop,
      ready: true
    };
  }
}

export const hiResPatchManager = new HiResPatchManager();
