export interface MediaItemConfig {
  id: string;
  type: 'video' | 'image';
  url: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: number;
}

// AUDIT-FIX: BUG-006 - Central gesture watchdog
import { gestureWatchdog } from '../core/gestureWatchdog';


export class MediaWindow {
  el: HTMLElement;
  config: MediaItemConfig;
  private videoEl: HTMLVideoElement | null = null;
  private isDragging = false;
  private isResizing = false;
  private activeResizeCorner = '';
  private dragStartX = 0;
  private dragStartY = 0;
  private initialX = 0;
  private initialY = 0;
  private initialW = 0;
  private initialH = 0;

  private onCloseCb: (id: string) => void;
  private onFocusCb: (id: string) => void;

  constructor(
    config: MediaItemConfig,
    onClose: (id: string) => void,
    onFocus: (id: string) => void
  ) {
    this.config = config;
    this.onCloseCb = onClose;
    this.onFocusCb = onFocus;
    this.el = this.createDOM();
    this.bindEvents();
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoEl;
  }

  private createDOM(): HTMLElement {
    const win = document.createElement('div');
    win.className = 'media-window';
    win.id = `media-win-${this.config.id}`;
    win.style.left = `${this.config.x}px`;
    win.style.top = `${this.config.y}px`;
    win.style.width = `${this.config.width}px`;
    win.style.height = `${this.config.height}px`;

    const isVideo = this.config.type === 'video';

    win.innerHTML = `
      <div class="media-window-header" data-drag-handle="true">
        <span class="media-window-title" title="${this.config.name}">${this.config.name}</span>
        <div class="media-window-controls">
          <button class="media-win-btn" data-btn-close="true" title="Close">✕</button>
        </div>
      </div>
      <div class="media-window-content">
        ${
          isVideo
            ? `<video src="${this.config.url}" playsinline loop muted></video>
               <div class="media-video-controls">
                 <button class="media-win-btn" data-btn-play="true">▶</button>
                 <input type="range" class="media-seek" data-seek="true" min="0" max="100" value="0" />
                 <button class="media-win-btn" data-btn-mute="true">🔇</button>
                 <select class="media-win-btn" data-speed="true" style="background:#111; font-size:11px;">
                   <option value="0.5">0.5x</option>
                   <option value="1.0" selected>1.0x</option>
                   <option value="1.5">1.5x</option>
                   <option value="2.0">2.0x</option>
                 </select>
               </div>`
            : `<img src="${this.config.url}" alt="${this.config.name}" draggable="false" />`
        }
      </div>
      <!-- 4 Corner Resize Handles -->
      <div class="resize-handle resize-tl" data-resize="tl"></div>
      <div class="resize-handle resize-tr" data-resize="tr"></div>
      <div class="resize-handle resize-bl" data-resize="bl"></div>
      <div class="resize-handle resize-br" data-resize="br"></div>
    `;

    if (isVideo) {
      this.videoEl = win.querySelector('video');
    }

    return win;
  }

  private bindEvents(): void {
    // Focus on pointerdown
    this.el.addEventListener('pointerdown', () => {
      this.onFocusCb(this.config.id);
    });

    // Close button
    const closeBtn = this.el.querySelector('[data-btn-close]');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onCloseCb(this.config.id);
    });

    // Header drag
    const header = this.el.querySelector('.media-window-header') as HTMLElement;
    const stopDrag = (e?: PointerEvent) => {
      if (this.isDragging) {
        this.isDragging = false;
        gestureWatchdog.unregisterGesture(`media-drag-${this.config.id}`);
        if (e) {
          try {
            header.releasePointerCapture(e.pointerId);
          } catch {}
        }
      }
    };

    header.addEventListener('pointerdown', (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.media-win-btn')) return;
      this.isDragging = true;
      header.setPointerCapture(e.pointerId);
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.initialX = parseFloat(this.el.style.left) || 0;
      this.initialY = parseFloat(this.el.style.top) || 0;
      gestureWatchdog.registerGesture(`media-drag-${this.config.id}`, () => stopDrag(), e.pointerId);
    });

    header.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isDragging) return;
      gestureWatchdog.recordActivity(`media-drag-${this.config.id}`);
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      const newX = Math.max(0, Math.min(window.innerWidth - 100, this.initialX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 60, this.initialY + dy));
      this.el.style.left = `${newX}px`;
      this.el.style.top = `${newY}px`;
      this.config.x = newX;
      this.config.y = newY;
    });

    header.addEventListener('pointerup', stopDrag);
    header.addEventListener('pointercancel', stopDrag);
    header.addEventListener('lostpointercapture', () => stopDrag());

    // Corner Resizing
    const handles = this.el.querySelectorAll<HTMLElement>('.resize-handle');
    handles.forEach((h) => {
      h.addEventListener('pointerdown', (e: PointerEvent) => {
        e.stopPropagation();
        this.isResizing = true;
        this.activeResizeCorner = h.getAttribute('data-resize')!;
        h.setPointerCapture(e.pointerId);
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.initialX = parseFloat(this.el.style.left) || 0;
        this.initialY = parseFloat(this.el.style.top) || 0;
        this.initialW = parseFloat(this.el.style.width) || 300;
        this.initialH = parseFloat(this.el.style.height) || 200;
        gestureWatchdog.registerGesture(`media-resize-${this.config.id}`, () => stopResize(), e.pointerId);
      });

      h.addEventListener('pointermove', (e: PointerEvent) => {
        if (!this.isResizing) return;
        gestureWatchdog.recordActivity(`media-resize-${this.config.id}`);
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;

        let newW = this.initialW;
        let newH = this.initialH;
        let newX = this.initialX;
        let newY = this.initialY;

        if (this.activeResizeCorner === 'br') {
          newW = Math.max(180, this.initialW + dx);
          newH = Math.max(120, newW / this.config.aspectRatio);
        } else if (this.activeResizeCorner === 'bl') {
          newW = Math.max(180, this.initialW - dx);
          newH = Math.max(120, newW / this.config.aspectRatio);
          newX = this.initialX + (this.initialW - newW);
        } else if (this.activeResizeCorner === 'tr') {
          newW = Math.max(180, this.initialW + dx);
          newH = Math.max(120, newW / this.config.aspectRatio);
          newY = this.initialY + (this.initialH - newH);
        } else if (this.activeResizeCorner === 'tl') {
          newW = Math.max(180, this.initialW - dx);
          newH = Math.max(120, newW / this.config.aspectRatio);
          newX = this.initialX + (this.initialW - newW);
          newY = this.initialY + (this.initialH - newH);
        }

        this.el.style.width = `${Math.round(newW)}px`;
        this.el.style.height = `${Math.round(newH)}px`;
        this.el.style.left = `${Math.round(newX)}px`;
        this.el.style.top = `${Math.round(newY)}px`;

        this.config.width = newW;
        this.config.height = newH;
        this.config.x = newX;
        this.config.y = newY;
      });

      const stopResize = (e?: PointerEvent) => {
        if (this.isResizing) {
          this.isResizing = false;
          gestureWatchdog.unregisterGesture(`media-resize-${this.config.id}`);
          if (e) {
            try {
              h.releasePointerCapture(e.pointerId);
            } catch {}
          }
        }
      };
      h.addEventListener('pointerup', stopResize);
      h.addEventListener('pointercancel', stopResize);
      h.addEventListener('lostpointercapture', () => stopResize());
    });

    // Video custom controls
    if (this.videoEl) {
      const v = this.videoEl;
      const playBtn = this.el.querySelector('[data-btn-play]') as HTMLElement;
      const muteBtn = this.el.querySelector('[data-btn-mute]') as HTMLElement;
      const seekSlider = this.el.querySelector('[data-seek]') as HTMLInputElement;
      const speedSelect = this.el.querySelector('[data-speed]') as HTMLSelectElement;

      playBtn?.addEventListener('click', () => {
        if (v.paused) {
          v.play();
          playBtn.textContent = '⏸';
        } else {
          v.pause();
          playBtn.textContent = '▶';
        }
      });

      muteBtn?.addEventListener('click', () => {
        v.muted = !v.muted;
        muteBtn.textContent = v.muted ? '🔇' : '🔊';
      });

      v.addEventListener('timeupdate', () => {
        if (v.duration && !this.isDragging) {
          seekSlider.value = `${(v.currentTime / v.duration) * 100}`;
        }
      });

      seekSlider?.addEventListener('input', () => {
        if (v.duration) {
          v.currentTime = (Number(seekSlider.value) / 100) * v.duration;
        }
      });

      speedSelect?.addEventListener('change', () => {
        v.playbackRate = Number(speedSelect.value);
      });
    }
  }

  destroy(): void {
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.src = '';
    }
    this.el.remove();
  }
}
