import { MediaWindow } from './mediaWindow';
import { store } from '../state/store';

export class OverlayManager {
  private mediaLayerEl!: HTMLElement;
  private windows: Map<string, MediaWindow> = new Map();
  private maxWindows = 4;
  private zCounter = 21;
  private compareBarEl: HTMLElement | null = null;
  private isCompareMode = false;

  init(): void {
    this.mediaLayerEl = document.getElementById('mediaLayer') as HTMLElement;
    this.bindFileInput();
    this.bindSlideChange();
  }

  private bindFileInput(): void {
    const input = document.getElementById('fileInputMedia') as HTMLInputElement;
    input?.addEventListener('change', () => {
      if (input.files && input.files.length > 0) {
        for (let i = 0; i < input.files.length; i++) {
          if (this.windows.size >= this.maxWindows) break;
          this.addMediaFile(input.files[i]);
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

  addMediaFile(file: File): void {
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
    const id = `med-${Date.now()}-${Math.random()}`;

    // Compute initial cascade placement
    const offset = this.windows.size * 32;
    const initialW = Math.min(520, window.innerWidth * 0.45);
    const initialH = Math.min(320, window.innerHeight * 0.45);

    const win = new MediaWindow(
      {
        id,
        type: isVideo ? 'video' : 'image',
        url,
        name: file.name,
        x: 80 + offset,
        y: 80 + offset,
        width: initialW,
        height: initialH,
        aspectRatio: 16 / 9
      },
      (closeId) => this.removeWindow(closeId),
      (focusId) => this.bringToFront(focusId)
    );

    win.el.style.zIndex = `${++this.zCounter}`;
    this.mediaLayerEl.appendChild(win.el);
    this.windows.set(id, win);

    this.updateCompareBar();
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

  // Side-by-side compare layout (auto-tiles two windows 50/50 each at 48% width)
  toggleCompare(): void {
    const winList = Array.from(this.windows.values());
    if (winList.length < 2) return;

    this.isCompareMode = !this.isCompareMode;
    if (this.isCompareMode) {
      const w1 = winList[0];
      const w2 = winList[1];

      const stageW = window.innerWidth;
      const stageH = window.innerHeight;
      const targetW = Math.round(stageW * 0.47);
      const targetH = Math.round(targetW / (16 / 9));
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
      w2.el.style.left = `${Math.round(stageW * 0.51)}px`;
      w2.el.style.top = `${targetY}px`;
      w2.el.style.width = `${targetW}px`;
      w2.el.style.height = `${targetH}px`;
      w2.config.x = Math.round(stageW * 0.51);
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
            <span>⇄ Compare 50/50</span>
          </button>
          <button class="header-btn" id="btnSyncPlayPause">
            <span>⏯ Sync Play/Pause</span>
          </button>
          <button class="header-btn" id="btnClearMedia" style="color:#f87171;">
            <span>✕ Remove All</span>
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
        v.play();
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
