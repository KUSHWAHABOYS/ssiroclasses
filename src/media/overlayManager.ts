import { MediaWindow, MediaItemConfig } from './mediaWindow';
import { store } from '../state/store';

export class OverlayManager {
  private mediaLayerEl!: HTMLElement;
  private windows: Map<string, MediaWindow> = new Map();
  private maxWindows = 4;
  private zCounter = 37;
  private compareBarEl: HTMLElement | null = null;
  private isCompareMode = false;

  init(): void {
    this.mediaLayerEl = document.getElementById('mediaLayer') as HTMLElement;
    this.bindFileInput();
    this.bindSlideChange();
  }

  private bindFileInput(): void {
    const input = document.getElementById('fileInputMedia') as HTMLInputElement;
    input?.addEventListener('change', async () => {
      if (input.files && input.files.length > 0) {
        for (let i = 0; i < input.files.length; i++) {
          if (this.windows.size >= this.maxWindows) break;
          await this.addMediaFile(input.files[i]);
        }
        input.value = '';
      }
    });
  }

  private bindSlideChange(): void {
    store.subscribe((state, prev) => {
      if (state.currentPage !== prev.currentPage && state.settings.clearMediaOnSlideChange) {
        this.clearAll();
      }
    });
  }

  async addMediaFile(file: File): Promise<void> {
    if (this.windows.size >= this.maxWindows) {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: 'अधिकतम 4 मीडिया विंडो की सीमा पूरी हो गई है।', isError: true }
        })
      );
      return;
    }

    const isVideo = file.type.startsWith('video');
    const url = URL.createObjectURL(file);
    const id = `med-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // 1. Analyze media dimensions & aspect ratio
    const dims = isVideo ? await this.probeVideo(url) : await this.probeImage(url);
    const naturalW = dims.width || (isVideo ? 1920 : 1280);
    const naturalH = dims.height || (isVideo ? 1080 : 720);
    const aspectRatio = naturalW / naturalH;
    const isPortrait = aspectRatio < 0.95; // Shorts / Reels / Portrait Photos

    // 2. Viewport dimensions
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const headerH = 40;

    let targetW = 420;
    let targetH = 680;
    let targetX = 40;
    let targetY = 60;

    if (isPortrait) {
      // Shorts / Reels / Vertical Video:
      // Auto-fit to height (up to 82vh) with exact aspect ratio (ZERO black side bars)
      // Auto-dock to the right side of the screen, leaving PPT slide content on left clear!
      const availH = Math.min(viewportH - 120, Math.max(460, viewportH * 0.82));
      const contentH = availH - headerH;
      const contentW = Math.round(contentH * aspectRatio);

      targetW = Math.max(260, Math.min(viewportW * 0.46, contentW));
      targetH = Math.round((targetW / aspectRatio) + headerH);

      // Dock on right side with comfortable margin
      targetX = Math.max(20, viewportW - targetW - 36);
      targetY = Math.max(56, Math.round((viewportH - targetH) / 2));
    } else {
      // Landscape Video / Standard Photo:
      // Open large in presentation view (near full screen / centered) preserving aspect ratio
      const maxAvailW = viewportW * 0.86;
      const maxAvailH = viewportH * 0.82;

      if (maxAvailW / aspectRatio + headerH <= maxAvailH) {
        targetW = Math.round(maxAvailW);
        targetH = Math.round((targetW / aspectRatio) + headerH);
      } else {
        targetH = Math.round(maxAvailH);
        targetW = Math.round((targetH - headerH) * aspectRatio);
      }

      targetX = Math.max(20, Math.round((viewportW - targetW) / 2));
      targetY = Math.max(56, Math.round((viewportH - targetH) / 2));
    }

    // Offset cascaded windows if multiple exist
    const cascadeOffset = (this.windows.size % 4) * 24;
    if (this.windows.size > 0 && !isPortrait) {
      targetX = Math.min(viewportW - targetW - 20, targetX + cascadeOffset);
      targetY = Math.min(viewportH - targetH - 20, targetY + cascadeOffset);
    }

    const config: MediaItemConfig = {
      id,
      type: isVideo ? 'video' : 'image',
      url,
      name: file.name,
      x: targetX,
      y: targetY,
      width: targetW,
      height: targetH,
      aspectRatio,
      isPortrait,
      nativeWidth: naturalW,
      nativeHeight: naturalH
    };

    const win = new MediaWindow(
      config,
      (closeId) => this.removeWindow(closeId),
      (focusId) => this.bringToFront(focusId)
    );

    win.el.style.zIndex = `${++this.zCounter}`;
    this.mediaLayerEl.appendChild(win.el);
    this.windows.set(id, win);

    // Auto-focus the new media window
    this.bringToFront(id);

    // Switch to select tool so the user can interact freely without ink interference
    if (store.getState().activeTool !== 'select') {
      store.setState({ activeTool: 'select' });
    }

    this.updateCompareBar();
  }

  private probeVideo(url: string): Promise<{ width: number; height: number; duration: number }> {
    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = url;

      let resolved = false;
      const onDone = () => {
        if (resolved) return;
        resolved = true;
        const w = v.videoWidth || 1920;
        const h = v.videoHeight || 1080;
        const d = v.duration || 0;
        v.onloadedmetadata = null;
        v.onerror = null;
        v.src = '';
        resolve({ width: w, height: h, duration: d });
      };

      v.onloadedmetadata = onDone;
      v.onerror = () => {
        if (resolved) return;
        resolved = true;
        resolve({ width: 1920, height: 1080, duration: 0 });
      };

      // Fallback timeout
      setTimeout(() => {
        if (!resolved) {
          onDone();
        }
      }, 1500);
    });
  }

  private probeImage(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth || 1280, height: img.naturalHeight || 720 });
      };
      img.onerror = () => {
        resolve({ width: 1280, height: 720 });
      };
      img.src = url;
    });
  }

  bringToFront(id: string): void {
    const win = this.windows.get(id);
    if (win) {
      win.el.style.zIndex = `${++this.zCounter}`;
      this.windows.forEach((w) => w.el.classList.remove('active-focus'));
      win.el.classList.add('active-focus');
    }
  }

  removeWindow(id: string): void {
    const win = this.windows.get(id);
    if (win) {
      URL.revokeObjectURL(win.config.url);
      win.destroy();
      this.windows.delete(id);
      this.updateCompareBar();
    }
  }

  clearAll(): void {
    for (const win of this.windows.values()) {
      URL.revokeObjectURL(win.config.url);
      win.destroy();
    }
    this.windows.clear();
    this.removeCompareBar();
  }

  // Side-by-side compare layout
  toggleCompare(): void {
    const winList = Array.from(this.windows.values());
    if (winList.length < 2) return;

    this.isCompareMode = !this.isCompareMode;
    if (this.isCompareMode) {
      const w1 = winList[0];
      const w2 = winList[1];

      const stageW = window.innerWidth;
      const stageH = window.innerHeight;
      const targetW = Math.round(stageW * 0.46);
      const targetH = Math.round(stageH * 0.8);
      const targetY = Math.round((stageH - targetH) / 2);

      // Left window
      w1.el.style.left = `${Math.round(stageW * 0.02)}px`;
      w1.el.style.top = `${targetY}px`;
      w1.el.style.width = `${targetW}px`;
      w1.el.style.height = `${targetH}px`;
      w1.config.x = Math.round(stageW * 0.02);
      w1.config.y = targetY;
      w1.config.width = targetW;
      w1.config.height = targetH;

      // Right window
      w2.el.style.left = `${Math.round(stageW * 0.52)}px`;
      w2.el.style.top = `${targetY}px`;
      w2.el.style.width = `${targetW}px`;
      w2.el.style.height = `${targetH}px`;
      w2.config.x = Math.round(stageW * 0.52);
      w2.config.y = targetY;
      w2.config.width = targetW;
      w2.config.height = targetH;
    }
  }

  private updateCompareBar(): void {
    if (this.windows.size >= 2) {
      if (!this.compareBarEl) {
        this.compareBarEl = document.createElement('div');
        this.compareBarEl.className = 'media-compare-bar';
        this.compareBarEl.innerHTML = `
          <button class="header-btn" id="btnTileCompare">
            <span>⇄ 50/50 तुलना (Compare)</span>
          </button>
          <button class="header-btn" id="btnSyncPlayPause">
            <span>⏯ साथ में चलाएं (Sync)</span>
          </button>
          <button class="header-btn" id="btnClearMedia" style="color:#f87171;">
            <span>✕ सभी बंद करें</span>
          </button>
        `;
        document.getElementById('stage')!.appendChild(this.compareBarEl);

        document.getElementById('btnTileCompare')?.addEventListener('click', () => this.toggleCompare());
        document.getElementById('btnSyncPlayPause')?.addEventListener('click', () => this.syncPlayPause());
        document.getElementById('btnClearMedia')?.addEventListener('click', () => this.clearAll());
      }
    } else {
      this.removeCompareBar();
    }
  }

  private syncPlayPause(): void {
    const videos = Array.from(this.windows.values())
      .map((w) => w.getVideoElement())
      .filter((v): v is HTMLVideoElement => v !== null);

    if (videos.length === 0) return;
    const shouldPlay = videos.some((v) => v.paused);
    for (const v of videos) {
      if (shouldPlay) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    }
  }

  private removeCompareBar(): void {
    if (this.compareBarEl) {
      this.compareBarEl.remove();
      this.compareBarEl = null;
    }
  }
}

export const overlayManager = new OverlayManager();
