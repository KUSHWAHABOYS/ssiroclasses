import { store } from '../state/store';
import { layerManager } from '../core/layers';
import { translatorService } from '../ai/translatorService';
import { translatorCardManager } from './translatorCard';

export class TranslatorOverlayManager {
  private overlayEl: HTMLElement | null = null;
  private snipBoxEl: HTMLElement | null = null;

  private isSelecting = false;
  private startX = 0;
  private startY = 0;
  private currentRect: { x: number; y: number; width: number; height: number } | null = null;

  init(): void {
    const stage = document.getElementById('stage') || document.body;

    // Create transparent overlay container
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'translator-overlay hidden';
    this.overlayEl.id = 'translatorOverlay';

    // Sleek glowing Snip Box (zero text clutter)
    this.snipBoxEl = document.createElement('div');
    this.snipBoxEl.className = 'translator-snip-box';
    this.snipBoxEl.style.display = 'none';
    this.snipBoxEl.innerHTML = `
      <div class="snip-corner-handle tl"></div>
      <div class="snip-corner-handle tr"></div>
      <div class="snip-corner-handle bl"></div>
      <div class="snip-corner-handle br"></div>
    `;
    this.overlayEl.appendChild(this.snipBoxEl);

    stage.appendChild(this.overlayEl);

    this.bindEvents();
    this.bindStore();
  }

  private bindEvents(): void {
    if (!this.overlayEl) return;

    // Pointer events on overlay to draw the selection rectangle
    this.overlayEl.addEventListener('pointerdown', (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.translation-card')) return;

      this.isSelecting = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.currentRect = null;

      if (this.snipBoxEl) {
        this.snipBoxEl.style.left = `${this.startX}px`;
        this.snipBoxEl.style.top = `${this.startY}px`;
        this.snipBoxEl.style.width = '0px';
        this.snipBoxEl.style.height = '0px';
        this.snipBoxEl.style.display = 'block';
      }

      try {
        this.overlayEl!.setPointerCapture(e.pointerId);
      } catch {}
    });

    this.overlayEl.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isSelecting || !this.snipBoxEl) return;

      const currentX = e.clientX;
      const currentY = e.clientY;

      const left = Math.min(this.startX, currentX);
      const top = Math.min(this.startY, currentY);
      const width = Math.abs(currentX - this.startX);
      const height = Math.abs(currentY - this.startY);

      this.currentRect = { x: left, y: top, width, height };

      this.snipBoxEl.style.left = `${left}px`;
      this.snipBoxEl.style.top = `${top}px`;
      this.snipBoxEl.style.width = `${width}px`;
      this.snipBoxEl.style.height = `${height}px`;
    });

    const onPointerUp = async (e: PointerEvent) => {
      if (!this.isSelecting) return;
      this.isSelecting = false;

      try {
        this.overlayEl?.releasePointerCapture(e.pointerId);
      } catch {}

      if (!this.currentRect || this.currentRect.width < 25 || this.currentRect.height < 25) {
        // Selection too small - dismiss selection box
        if (this.snipBoxEl) this.snipBoxEl.style.display = 'none';
        return;
      }

      // Execute translation on selected region
      await this.processRegionTranslation(this.currentRect);
    };

    this.overlayEl.addEventListener('pointerup', onPointerUp);
    this.overlayEl.addEventListener('pointercancel', onPointerUp);
  }

  private async processRegionTranslation(rect: { x: number; y: number; width: number; height: number }): Promise<void> {
    translatorCardManager.showLoading(rect.x + rect.width, rect.y);

    try {
      const base64Png = this.captureRegionAsBase64(rect);
      const result = await translatorService.translateImageRegion(base64Png);
      translatorCardManager.showResult(result, rect.x + rect.width, rect.y);
    } catch (err: any) {
      console.error('Translation failed:', err);
      const isMissingKey = err.message === 'NO_API_KEY' || err.code === 'NO_API_KEY';
      translatorCardManager.showError(err.message, isMissingKey, rect.x + rect.width, rect.y);
    }
  }

  public async translateFullSlide(): Promise<void> {
    const slideCanvas = layerManager.slideCanvas;
    const fullRect = {
      x: 0,
      y: 0,
      width: slideCanvas.width || window.innerWidth,
      height: slideCanvas.height || window.innerHeight
    };

    if (this.snipBoxEl) {
      this.snipBoxEl.style.left = '40px';
      this.snipBoxEl.style.top = '60px';
      this.snipBoxEl.style.width = 'calc(100% - 80px)';
      this.snipBoxEl.style.height = 'calc(100% - 120px)';
      this.snipBoxEl.style.display = 'block';
    }

    translatorCardManager.showLoading(window.innerWidth / 2 - 290, 100);

    try {
      const base64Png = this.captureRegionAsBase64(fullRect);
      const result = await translatorService.translateImageRegion(base64Png);
      translatorCardManager.showResult(result, window.innerWidth / 2 - 290, 100);
    } catch (err: any) {
      console.error('Full slide translation failed:', err);
      const isMissingKey = err.message === 'NO_API_KEY' || err.code === 'NO_API_KEY';
      translatorCardManager.showError(err.message, isMissingKey, window.innerWidth / 2 - 290, 100);
    }
  }

  private captureRegionAsBase64(rect: { x: number; y: number; width: number; height: number }): string {
    const offscreen = document.createElement('canvas');
    const targetW = Math.max(1, Math.round(rect.width));
    const targetH = Math.max(1, Math.round(rect.height));
    offscreen.width = targetW;
    offscreen.height = targetH;
    const ctx = offscreen.getContext('2d');

    if (ctx) {
      const dpr = layerManager.getDimensions().dpr || 1;
      // 1. Draw slide canvas background and content
      ctx.drawImage(
        layerManager.slideCanvas,
        rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr,
        0, 0, targetW, targetH
      );

      // 2. Also draw any on-canvas text annotations / strokes
      ctx.drawImage(
        layerManager.annotationCanvas,
        rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr,
        0, 0, targetW, targetH
      );
    }

    const dataUrl = offscreen.toDataURL('image/png');
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  }

  private bindStore(): void {
    store.subscribe((state, prev) => {
      if (state.activeTool !== prev.activeTool) {
        if (state.activeTool === 'translate') {
          this.activate();
        } else {
          this.deactivate();
        }
      }
    });
  }

  private activate(): void {
    if (!this.overlayEl) return;
    this.overlayEl.classList.remove('hidden');
    if (this.snipBoxEl) this.snipBoxEl.style.display = 'none';
  }

  private deactivate(): void {
    if (!this.overlayEl) return;
    this.overlayEl.classList.add('hidden');
    if (this.snipBoxEl) this.snipBoxEl.style.display = 'none';

    // If user closed overlay while tool was translate, return to select tool
    if (store.getState().activeTool === 'translate') {
      store.setState({ activeTool: 'select' });
    }
  }
}

export const translatorOverlayManager = new TranslatorOverlayManager();
