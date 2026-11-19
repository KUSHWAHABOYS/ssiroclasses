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
  isPortrait?: boolean;
  nativeWidth?: number;
  nativeHeight?: number;
}

import { gestureWatchdog } from '../core/gestureWatchdog';

export class MediaWindow {
  el: HTMLElement;
  config: MediaItemConfig;
  private videoEl: HTMLVideoElement | null = null;
  private isDragging = false;
  private isResizing = false;
  private activeResizeType = ''; // 'tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'
  private dragStartX = 0;
  private dragStartY = 0;
  private initialX = 0;
  private initialY = 0;
  private initialW = 0;
  private initialH = 0;

  // Maximize restore state
  private isMaximized = false;
  private preMaxX = 0;
  private preMaxY = 0;
  private preMaxW = 0;
  private preMaxH = 0;

  // Touch pinch state
  private initialPinchDist = 0;
  private initialPinchW = 0;
  private initialPinchH = 0;

  // Video controls auto-hide timer
  private controlsTimer: number | null = null;

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
    this.isolateEvents();
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.videoEl;
  }

  private createDOM(): HTMLElement {
    const win = document.createElement('div');
    win.className = `media-window ${this.config.isPortrait ? 'is-portrait-shorts' : 'is-landscape'}`;
    win.id = `media-win-${this.config.id}`;
    win.style.left = `${Math.round(this.config.x)}px`;
    win.style.top = `${Math.round(this.config.y)}px`;
    win.style.width = `${Math.round(this.config.width)}px`;
    win.style.height = `${Math.round(this.config.height)}px`;

    const isVideo = this.config.type === 'video';
    const isPortrait = !!this.config.isPortrait;

    // Badges
    const badgeHtml = isPortrait
      ? `<span class="media-badge shorts" title="Shorts / Reels (पोर्ट्रेट वीडियो)">📱 Shorts</span>`
      : isVideo
      ? `<span class="media-badge video" title="वीडियो (Video)">🎬 Video</span>`
      : `<span class="media-badge image" title="चित्र (Image)">🖼 Image</span>`;

    win.innerHTML = `
      <!-- Header Bar (Draggable) -->
      <div class="media-window-header" data-drag-handle="true">
        <div class="media-header-left">
          ${badgeHtml}
          <span class="media-window-title" title="${this.escapeHtml(this.config.name)}">${this.escapeHtml(this.config.name)}</span>
        </div>
        <div class="media-window-controls">
          <button class="media-win-btn btn-flip" data-btn-flip="true" title="साइड बदलें: बाएं ↔ दाएं (Flip Left/Right)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
          </button>
          <button class="media-win-btn btn-maximize" data-btn-maximize="true" title="फ़ुल स्क्रीन / सामान्य आकार (Maximize/Restore)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          </button>
          <button class="media-win-btn btn-close" data-btn-close="true" title="बंद करें (Close)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="media-window-content" id="mediaContent-${this.config.id}">
        ${
          isVideo
            ? `<video src="${this.config.url}" playsinline loop muted preload="auto"></video>
               <div class="media-video-controls" id="videoControls-${this.config.id}">
                 <button class="media-play-circle" data-btn-play="true" title="Play / Pause">
                   <svg class="icon-play" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                   <svg class="icon-pause" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                 </button>
                 <span class="media-time-label" data-time-label="true">0:00 / 0:00</span>
                 <input type="range" class="media-seek" data-seek="true" min="0" max="100" value="0" />
                 <button class="media-icon-btn" data-btn-mute="true" title="Mute / Unmute">
                   <svg class="icon-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                   <svg class="icon-unmuted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                 </button>
                 <select class="media-speed-select" data-speed="true" title="Playback Speed">
                   <option value="0.5">0.5×</option>
                   <option value="0.75">0.75×</option>
                   <option value="1.0" selected>1.0×</option>
                   <option value="1.25">1.25×</option>
                   <option value="1.5">1.5×</option>
                   <option value="2.0">2.0×</option>
                 </select>
               </div>`
            : `<img src="${this.config.url}" alt="${this.escapeHtml(this.config.name)}" draggable="false" />`
        }
      </div>

      <!-- 4 Corner Touch-Friendly Resize Handles -->
      <div class="resize-handle resize-tl" data-resize="tl" title="ऊपर-बाएं से आकार बदलें">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H2v12"/></svg>
      </div>
      <div class="resize-handle resize-tr" data-resize="tr" title="ऊपर-दाएं से आकार बदलें">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 2h12v12"/></svg>
      </div>
      <div class="resize-handle resize-bl" data-resize="bl" title="नीचे-बाएं से आकार बदलें">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14H2V2"/></svg>
      </div>
      <div class="resize-handle resize-br" data-resize="br" title="नीचे-दाएं से आकार बदलें">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 14h12V2"/></svg>
      </div>

      <!-- 4 Edge Resize Handles for Free Stretch -->
      <div class="resize-edge edge-t" data-resize="t" title="ऊपरी किनारे से आकार बदलें"></div>
      <div class="resize-edge edge-b" data-resize="b" title="निचले किनारे से आकार बदलें"></div>
      <div class="resize-edge edge-l" data-resize="l" title="बाएं किनारे से आकार बदलें"></div>
      <div class="resize-edge edge-r" data-resize="r" title="दाएं किनारे से आकार बदलें"></div>
    `;

    if (isVideo) {
      this.videoEl = win.querySelector('video');
    }

    return win;
  }

  /**
   * Complete Event Shielding:
   * Prevents all touch, pointer, mouse and wheel events from bubbling
   * to #zoomRoot, #stage, or triggering PPT slide movements/zooms.
   */
  private isolateEvents(): void {
    const events = [
      'pointerdown',
      'pointermove',
      'pointerup',
      'touchstart',
      'touchmove',
      'touchend',
      'mousedown',
      'mousemove',
      'mouseup',
      'click',
      'dblclick',
      'wheel',
      'contextmenu'
    ];

    events.forEach((evt) => {
      this.el.addEventListener(
        evt,
        (e) => {
          e.stopPropagation();
        },
        { passive: false }
      );
    });
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

    // Flip Left/Right side dock button
    const flipBtn = this.el.querySelector('[data-btn-flip]');
    flipBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.flipSide();
    });

    // Maximize / Restore button
    const maxBtn = this.el.querySelector('[data-btn-maximize]');
    maxBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximize();
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
      e.stopPropagation();
      this.isDragging = true;
      try {
        header.setPointerCapture(e.pointerId);
      } catch {}
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.initialX = parseFloat(this.el.style.left) || this.config.x;
      this.initialY = parseFloat(this.el.style.top) || this.config.y;
      gestureWatchdog.registerGesture(`media-drag-${this.config.id}`, () => stopDrag(), e.pointerId);
    });

    header.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isDragging) return;
      gestureWatchdog.recordActivity(`media-drag-${this.config.id}`);
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      const newX = Math.max(0, Math.min(window.innerWidth - 80, this.initialX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 50, this.initialY + dy));
      this.el.style.left = `${Math.round(newX)}px`;
      this.el.style.top = `${Math.round(newY)}px`;
      this.config.x = newX;
      this.config.y = newY;
    });

    header.addEventListener('pointerup', stopDrag);
    header.addEventListener('pointercancel', stopDrag);
    header.addEventListener('lostpointercapture', () => stopDrag());

    // Omni-directional Resizing (Corners & Edges)
    const resizeHandles = this.el.querySelectorAll<HTMLElement>('.resize-handle, .resize-edge');
    resizeHandles.forEach((h) => {
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

      h.addEventListener('pointerdown', (e: PointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        this.isResizing = true;
        this.activeResizeType = h.getAttribute('data-resize')!;
        try {
          h.setPointerCapture(e.pointerId);
        } catch {}
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.initialX = parseFloat(this.el.style.left) || this.config.x;
        this.initialY = parseFloat(this.el.style.top) || this.config.y;
        this.initialW = parseFloat(this.el.style.width) || this.config.width;
        this.initialH = parseFloat(this.el.style.height) || this.config.height;
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

        const headerH = 40;
        const aspect = this.config.aspectRatio || 16 / 9;

        switch (this.activeResizeType) {
          case 'br': {
            newW = Math.max(220, this.initialW + dx);
            newH = Math.max(160, Math.round((newW - 2) / aspect + headerH));
            break;
          }
          case 'bl': {
            newW = Math.max(220, this.initialW - dx);
            newH = Math.max(160, Math.round((newW - 2) / aspect + headerH));
            newX = this.initialX + (this.initialW - newW);
            break;
          }
          case 'tr': {
            newW = Math.max(220, this.initialW + dx);
            newH = Math.max(160, Math.round((newW - 2) / aspect + headerH));
            newY = this.initialY + (this.initialH - newH);
            break;
          }
          case 'tl': {
            newW = Math.max(220, this.initialW - dx);
            newH = Math.max(160, Math.round((newW - 2) / aspect + headerH));
            newX = this.initialX + (this.initialW - newW);
            newY = this.initialY + (this.initialH - newH);
            break;
          }
          case 'r': {
            newW = Math.max(220, this.initialW + dx);
            break;
          }
          case 'l': {
            newW = Math.max(220, this.initialW - dx);
            newX = this.initialX + (this.initialW - newW);
            break;
          }
          case 'b': {
            newH = Math.max(160, this.initialH + dy);
            break;
          }
          case 't': {
            newH = Math.max(160, this.initialH - dy);
            newY = this.initialY + (this.initialH - newH);
            break;
          }
        }

        // Boundary checks
        newW = Math.min(window.innerWidth - 20, newW);
        newH = Math.min(window.innerHeight - 30, newH);
        newX = Math.max(0, Math.min(window.innerWidth - 60, newX));
        newY = Math.max(0, Math.min(window.innerHeight - 60, newY));

        this.el.style.width = `${Math.round(newW)}px`;
        this.el.style.height = `${Math.round(newH)}px`;
        this.el.style.left = `${Math.round(newX)}px`;
        this.el.style.top = `${Math.round(newY)}px`;

        this.config.width = newW;
        this.config.height = newH;
        this.config.x = newX;
        this.config.y = newY;
      });

      h.addEventListener('pointerup', stopResize);
      h.addEventListener('pointercancel', stopResize);
      h.addEventListener('lostpointercapture', () => stopResize());
    });

    // Touch pinch-to-resize on the window itself
    this.el.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (e.touches.length === 2) {
          e.stopPropagation();
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          this.initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          this.initialPinchW = parseFloat(this.el.style.width) || this.config.width;
          this.initialPinchH = parseFloat(this.el.style.height) || this.config.height;
        }
      },
      { passive: false }
    );

    this.el.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (e.touches.length === 2 && this.initialPinchDist > 0) {
          e.stopPropagation();
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
          const scale = dist / Math.max(1, this.initialPinchDist);

          const newW = Math.max(220, Math.min(window.innerWidth - 30, this.initialPinchW * scale));
          const newH = Math.max(160, Math.min(window.innerHeight - 40, this.initialPinchH * scale));

          this.el.style.width = `${Math.round(newW)}px`;
          this.el.style.height = `${Math.round(newH)}px`;
          this.config.width = newW;
          this.config.height = newH;
        }
      },
      { passive: false }
    );

    this.el.addEventListener(
      'touchend',
      (e: TouchEvent) => {
        if (e.touches.length < 2) {
          this.initialPinchDist = 0;
        }
      },
      { passive: true }
    );

    // Video custom player controls & auto-hide
    if (this.videoEl) {
      this.bindVideoControls();
    }
  }

  private flipSide(): void {
    const viewportW = window.innerWidth;
    const currentX = parseFloat(this.el.style.left) || this.config.x;
    const currentW = parseFloat(this.el.style.width) || this.config.width;

    let targetX = 36;
    // If currently on the left half, flip to right half
    if (currentX < viewportW / 2) {
      targetX = viewportW - currentW - 36;
    }

    this.el.style.transition = 'left 250ms cubic-bezier(0.16, 1, 0.3, 1)';
    this.el.style.left = `${Math.round(targetX)}px`;
    this.config.x = targetX;

    setTimeout(() => {
      this.el.style.transition = '';
    }, 260);
  }

  private toggleMaximize(): void {
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    if (!this.isMaximized) {
      this.isMaximized = true;
      this.preMaxX = parseFloat(this.el.style.left) || this.config.x;
      this.preMaxY = parseFloat(this.el.style.top) || this.config.y;
      this.preMaxW = parseFloat(this.el.style.width) || this.config.width;
      this.preMaxH = parseFloat(this.el.style.height) || this.config.height;

      const fullW = viewportW - 40;
      const fullH = viewportH - 80;
      const targetX = 20;
      const targetY = 56;

      this.el.style.transition = 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)';
      this.el.style.left = `${targetX}px`;
      this.el.style.top = `${targetY}px`;
      this.el.style.width = `${fullW}px`;
      this.el.style.height = `${fullH}px`;
      this.config.x = targetX;
      this.config.y = targetY;
      this.config.width = fullW;
      this.config.height = fullH;

      setTimeout(() => {
        this.el.style.transition = '';
      }, 250);
    } else {
      this.isMaximized = false;
      this.el.style.transition = 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)';
      this.el.style.left = `${this.preMaxX}px`;
      this.el.style.top = `${this.preMaxY}px`;
      this.el.style.width = `${this.preMaxW}px`;
      this.el.style.height = `${this.preMaxH}px`;
      this.config.x = this.preMaxX;
      this.config.y = this.preMaxY;
      this.config.width = this.preMaxW;
      this.config.height = this.preMaxH;

      setTimeout(() => {
        this.el.style.transition = '';
      }, 250);
    }
  }

  private bindVideoControls(): void {
    if (!this.videoEl) return;
    const v = this.videoEl;

    const playBtn = this.el.querySelector('[data-btn-play]') as HTMLElement;
    const iconPlay = this.el.querySelector('.icon-play') as HTMLElement;
    const iconPause = this.el.querySelector('.icon-pause') as HTMLElement;
    const muteBtn = this.el.querySelector('[data-btn-mute]') as HTMLElement;
    const iconMuted = this.el.querySelector('.icon-muted') as HTMLElement;
    const iconUnmuted = this.el.querySelector('.icon-unmuted') as HTMLElement;
    const seekSlider = this.el.querySelector('[data-seek]') as HTMLInputElement;
    const speedSelect = this.el.querySelector('[data-speed]') as HTMLSelectElement;
    const timeLabel = this.el.querySelector('[data-time-label]') as HTMLElement;
    const controlsBar = this.el.querySelector('.media-video-controls') as HTMLElement;

    const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const updatePlayState = () => {
      if (v.paused) {
        if (iconPlay) iconPlay.style.display = 'block';
        if (iconPause) iconPause.style.display = 'none';
      } else {
        if (iconPlay) iconPlay.style.display = 'none';
        if (iconPause) iconPause.style.display = 'block';
      }
    };

    const togglePlay = () => {
      if (v.paused) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
      updatePlayState();
    };

    playBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    // Clicking video surface directly toggles play/pause
    v.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
      this.wakeControls();
    });

    // Mute/Unmute
    muteBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      v.muted = !v.muted;
      if (v.muted) {
        if (iconMuted) iconMuted.style.display = 'block';
        if (iconUnmuted) iconUnmuted.style.display = 'none';
      } else {
        if (iconMuted) iconMuted.style.display = 'none';
        if (iconUnmuted) iconUnmuted.style.display = 'block';
      }
    });

    // Time update & scrubber sync
    v.addEventListener('timeupdate', () => {
      if (v.duration && !this.isDragging) {
        seekSlider.value = `${(v.currentTime / v.duration) * 100}`;
        if (timeLabel) {
          timeLabel.textContent = `${formatTime(v.currentTime)} / ${formatTime(v.duration)}`;
        }
      }
    });

    seekSlider?.addEventListener('input', (e) => {
      e.stopPropagation();
      if (v.duration) {
        v.currentTime = (Number(seekSlider.value) / 100) * v.duration;
      }
    });

    speedSelect?.addEventListener('change', (e) => {
      e.stopPropagation();
      v.playbackRate = Number(speedSelect.value);
    });

    // Auto-hide controls when idle
    const wakeControls = () => {
      if (controlsBar) {
        controlsBar.classList.remove('faded');
      }
      if (this.controlsTimer) window.clearTimeout(this.controlsTimer);
      if (!v.paused) {
        this.controlsTimer = window.setTimeout(() => {
          if (!v.paused && controlsBar) {
            controlsBar.classList.add('faded');
          }
        }, 2800);
      }
    };

    this.wakeControls = wakeControls;
    this.el.addEventListener('pointermove', wakeControls, { passive: true });
    this.el.addEventListener('touchstart', wakeControls, { passive: true });

    v.addEventListener('play', () => {
      updatePlayState();
      wakeControls();
    });
    v.addEventListener('pause', () => {
      updatePlayState();
      if (controlsBar) controlsBar.classList.remove('faded');
    });

    // Autoplay muted on creation
    v.play().catch(() => {});
    updatePlayState();
  }

  private wakeControls: () => void = () => {};

  destroy(): void {
    if (this.controlsTimer) {
      window.clearTimeout(this.controlsTimer);
    }
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.src = '';
    }
    this.el.remove();
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
