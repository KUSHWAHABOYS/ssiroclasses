import { store } from '../state/store';
import { annotationStore } from '../draw/annotationStore';
import { layerManager } from '../core/layers';

// ============================================================================
// 1. CLASSROOM COUNTDOWN TIMER & STOPWATCH
// ============================================================================
export class TimerController {
  private widgetEl: HTMLElement | null = null;
  private timerInterval: number | null = null;
  private mode: 'timer' | 'stopwatch' = 'timer';
  private isRunning = false;
  private seconds = 120; // Default 2 minutes
  private initialSeconds = 120;
  private isMinimized = false;

  init(): void {
    if (document.getElementById('timerWidget')) return;
    this.render();
    this.bindEvents();
  }

  private render(): void {
    const stage = document.getElementById('stage') || document.body;
    const widget = document.createElement('div');
    widget.id = 'timerWidget';
    widget.className = 'timer-widget';
    widget.style.display = 'none';

    widget.innerHTML = `
      <div class="timer-header">
        <div class="timer-drag-handle" id="timerDragHandle">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span id="timerTitle">टाइमर (Timer)</span>
        </div>
        <div class="timer-actions">
          <button class="timer-icon-btn" id="btnTimerMinimize" title="छोटा / बड़ा करें (Minimize)">─</button>
          <button class="timer-icon-btn" id="btnTimerClose" title="बंद करें (Close)">✕</button>
        </div>
      </div>

      <div class="timer-full-controls">
        <div class="timer-mode-pills">
          <button class="timer-mode-btn active" id="btnModeTimer" type="button">उल्टी गिनती (Timer)</button>
          <button class="timer-mode-btn" id="btnModeStopwatch" type="button">स्टॉपवॉच (Stopwatch)</button>
        </div>

        <div class="timer-display" id="timerDisplay">02:00</div>

        <div class="timer-presets" id="timerPresets">
          <button class="timer-preset-pill" data-sec="30" type="button">30s</button>
          <button class="timer-preset-pill" data-sec="60" type="button">1m</button>
          <button class="timer-preset-pill" data-sec="120" type="button">2m</button>
          <button class="timer-preset-pill" data-sec="300" type="button">5m</button>
        </div>

        <div class="timer-controls">
          <button class="timer-btn-primary" id="btnTimerStartPause" type="button">शुरू करें (Start)</button>
          <button class="timer-btn-secondary" id="btnTimerReset" type="button">रीसेट (Reset)</button>
        </div>
      </div>
    `;

    stage.appendChild(widget);
    this.widgetEl = widget;
  }

  private bindEvents(): void {
    if (!this.widgetEl) return;

    // Dragging
    const handle = this.widgetEl.querySelector('#timerDragHandle') as HTMLElement;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.widgetEl!.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      handle.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (!isDragging || !this.widgetEl) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.widgetEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 180, initialLeft + dx))}px`;
      this.widgetEl.style.top = `${Math.max(10, Math.min(window.innerHeight - 100, initialTop + dy))}px`;
      this.widgetEl.style.right = 'auto';
    });

    const stopDrag = () => {
      isDragging = false;
    };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    // Minimize & Close
    document.getElementById('btnTimerMinimize')?.addEventListener('click', () => {
      this.isMinimized = !this.isMinimized;
      this.widgetEl?.classList.toggle('minimized', this.isMinimized);
    });

    document.getElementById('btnTimerClose')?.addEventListener('click', () => {
      this.hide();
    });

    // Modes
    document.getElementById('btnModeTimer')?.addEventListener('click', () => {
      this.setMode('timer');
    });
    document.getElementById('btnModeStopwatch')?.addEventListener('click', () => {
      this.setMode('stopwatch');
    });

    // Presets
    this.widgetEl.querySelectorAll('.timer-preset-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sec = parseInt(btn.getAttribute('data-sec') || '60', 10);
        this.setTimerSeconds(sec);
      });
    });

    // Start / Pause
    document.getElementById('btnTimerStartPause')?.addEventListener('click', () => {
      this.toggleRun();
    });

    // Reset
    document.getElementById('btnTimerReset')?.addEventListener('click', () => {
      this.reset();
    });
  }

  show(): void {
    if (!this.widgetEl) this.init();
    if (this.widgetEl) {
      this.widgetEl.style.display = 'flex';
    }
  }

  hide(): void {
    if (this.widgetEl) {
      this.widgetEl.style.display = 'none';
      this.pause();
    }
  }

  toggle(): void {
    if (!this.widgetEl || this.widgetEl.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  private setMode(mode: 'timer' | 'stopwatch'): void {
    this.pause();
    this.mode = mode;
    const titleEl = document.getElementById('timerTitle');
    const btnT = document.getElementById('btnModeTimer');
    const btnS = document.getElementById('btnModeStopwatch');
    const presetsEl = document.getElementById('timerPresets');

    if (mode === 'timer') {
      if (titleEl) titleEl.textContent = 'टाइमर (Timer)';
      btnT?.classList.add('active');
      btnS?.classList.remove('active');
      if (presetsEl) presetsEl.style.display = 'flex';
      this.seconds = this.initialSeconds;
    } else {
      if (titleEl) titleEl.textContent = 'स्टॉपवॉच (Stopwatch)';
      btnT?.classList.remove('active');
      btnS?.classList.add('active');
      if (presetsEl) presetsEl.style.display = 'none';
      this.seconds = 0;
    }
    this.updateDisplay();
  }

  private setTimerSeconds(sec: number): void {
    this.pause();
    this.mode = 'timer';
    this.initialSeconds = sec;
    this.seconds = sec;
    this.updateDisplay();
  }

  private toggleRun(): void {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  private start(): void {
    this.isRunning = true;
    const btn = document.getElementById('btnTimerStartPause');
    if (btn) btn.textContent = 'रोकें (Pause)';

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = window.setInterval(() => {
      if (this.mode === 'timer') {
        if (this.seconds > 0) {
          this.seconds--;
          this.updateDisplay();
          if (this.seconds === 0) {
            this.pause();
            this.playChime();
          }
        }
      } else {
        this.seconds++;
        this.updateDisplay();
      }
    }, 1000);
  }

  private pause(): void {
    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const btn = document.getElementById('btnTimerStartPause');
    if (btn) btn.textContent = 'शुरू करें (Start)';
  }

  private reset(): void {
    this.pause();
    this.seconds = this.mode === 'timer' ? this.initialSeconds : 0;
    this.updateDisplay();
  }

  private updateDisplay(): void {
    const disp = document.getElementById('timerDisplay');
    if (!disp) return;

    const mins = Math.floor(this.seconds / 60);
    const secs = this.seconds % 60;
    const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    disp.textContent = str;

    if (this.mode === 'timer' && this.seconds <= 10 && this.seconds > 0) {
      disp.classList.add('warning');
    } else {
      disp.classList.remove('warning');
    }
  }

  // Synthesized Web Audio chime on completion (0 external MP3 files needed)
  private playChime(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } catch {}
  }
}

// ============================================================================
// 2. INTERACTIVE SCREEN CURTAIN / SHADE (पर्दा टूल)
// ============================================================================
export class CurtainController {
  private curtainEl: HTMLElement | null = null;
  private shadeEl: HTMLElement | null = null;
  private isOpen = false;
  private shadeHeightPercent = 45;

  init(): void {
    if (document.getElementById('curtainLayer')) return;
    this.render();
  }

  private render(): void {
    const stage = document.getElementById('stage') || document.body;
    const layer = document.createElement('div');
    layer.id = 'curtainLayer';
    layer.className = 'curtain-layer';
    layer.style.display = 'none';

    layer.innerHTML = `
      <div class="curtain-shade" id="curtainShade" style="top:0; height:${this.shadeHeightPercent}%;">
        <div class="curtain-handle" id="curtainHandle">
          <div class="curtain-grip-lines"><span></span><span></span></div>
          <span class="curtain-title">पर्दा / CURTAIN</span>
          <button class="curtain-close-btn" id="btnCurtainClose" type="button" title="पर्दा हटाएं (Close Curtain)">✕</button>
        </div>
      </div>
    `;

    stage.appendChild(layer);
    this.curtainEl = layer;
    this.shadeEl = layer.querySelector('#curtainShade');

    this.bindEvents();
  }

  private bindEvents(): void {
    const handle = this.curtainEl?.querySelector('#curtainHandle') as HTMLElement;
    if (!handle) return;

    let isDragging = false;
    let startY = 0;
    let initialH = 0;

    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      isDragging = true;
      startY = e.clientY;
      initialH = this.shadeEl?.getBoundingClientRect().height || 200;
      handle.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (!isDragging || !this.shadeEl) return;
      const dy = e.clientY - startY;
      const newHeight = Math.max(80, Math.min(window.innerHeight - 60, initialH + dy));
      const pct = Math.round((newHeight / window.innerHeight) * 100);
      this.shadeHeightPercent = pct;
      this.shadeEl.style.height = `${pct}%`;
    });

    const stopDrag = () => {
      isDragging = false;
    };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    this.curtainEl?.querySelector('#btnCurtainClose')?.addEventListener('click', () => {
      this.hide();
    });
  }

  show(): void {
    if (!this.curtainEl) this.init();
    if (this.curtainEl) {
      this.curtainEl.style.display = 'block';
      this.curtainEl.classList.add('active');
      this.isOpen = true;
    }
  }

  hide(): void {
    if (this.curtainEl) {
      this.curtainEl.style.display = 'none';
      this.curtainEl.classList.remove('active');
      this.isOpen = false;
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }
}

// ============================================================================
// 3. SPOTLIGHT FOCUS TOOL (स्पॉटलाइट)
// ============================================================================
export class SpotlightController {
  private canvasEl: HTMLCanvasElement | null = null;
  private controlsEl: HTMLElement | null = null;
  private isActive = false;
  private spotX = window.innerWidth / 2;
  private spotY = window.innerHeight / 2;
  private radius = 140;

  init(): void {
    let canvas = document.getElementById('spotlightLayer') as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'spotlightLayer';
      canvas.className = 'spotlight-layer z-spotlight hidden';
      document.getElementById('stage')?.appendChild(canvas);
    }
    this.canvasEl = canvas;
    this.renderControls();
    this.bindEvents();
  }

  private renderControls(): void {
    if (document.getElementById('spotlightControls')) return;
    const stage = document.getElementById('stage') || document.body;
    const ctrl = document.createElement('div');
    ctrl.id = 'spotlightControls';
    ctrl.className = 'spotlight-controls-badge';
    ctrl.style.display = 'none';

    ctrl.innerHTML = `
      <span>💡 फोकस (Focus)</span>
      <input type="range" class="spotlight-slider" id="spotlightRadiusSlider" min="70" max="320" value="${this.radius}" title="स्पॉटलाइट का आकार" />
      <button class="spotlight-close-btn" id="btnSpotlightClose" type="button">✕ बंद</button>
    `;

    stage.appendChild(ctrl);
    this.controlsEl = ctrl;
  }

  private bindEvents(): void {
    if (!this.canvasEl) return;

    const slider = document.getElementById('spotlightRadiusSlider') as HTMLInputElement;
    slider?.addEventListener('input', () => {
      this.radius = Number(slider.value);
      this.redraw();
    });

    document.getElementById('btnSpotlightClose')?.addEventListener('click', () => {
      this.hide();
    });

    // Pointer move moves spotlight
    const handlePointer = (e: PointerEvent) => {
      if (!this.isActive) return;
      this.spotX = e.clientX;
      this.spotY = e.clientY;
      this.redraw();
    };

    this.canvasEl.addEventListener('pointermove', handlePointer);
    this.canvasEl.addEventListener('pointerdown', handlePointer);

    window.addEventListener('resize', () => {
      if (this.isActive) {
        this.updateCanvasDimensions();
        this.redraw();
      }
    });
  }

  private updateCanvasDimensions(): void {
    if (!this.canvasEl) return;
    this.canvasEl.width = window.innerWidth;
    this.canvasEl.height = window.innerHeight;
  }

  show(): void {
    if (!this.canvasEl) this.init();
    if (this.canvasEl && this.controlsEl) {
      this.updateCanvasDimensions();
      this.canvasEl.classList.remove('hidden');
      this.canvasEl.style.display = 'block';
      this.controlsEl.style.display = 'flex';
      this.isActive = true;
      this.redraw();
    }
  }

  hide(): void {
    if (this.canvasEl && this.controlsEl) {
      this.canvasEl.classList.add('hidden');
      this.canvasEl.style.display = 'none';
      this.controlsEl.style.display = 'none';
      this.isActive = false;
    }
  }

  toggle(): void {
    if (this.isActive) {
      this.hide();
    } else {
      this.show();
    }
  }

  private redraw(): void {
    if (!this.canvasEl || !this.isActive) return;
    const ctx = this.canvasEl.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

    // Dark backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, 0, this.canvasEl.width, this.canvasEl.height);

    // Punch out illuminated circle
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(this.spotX, this.spotY, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Glowing golden ring around spotlight
    ctx.save();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(this.spotX, this.spotY, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ============================================================================
// 4. 50:50 DUAL SPLIT-SCREEN BOARD (स्प्लिट स्क्रीन मोड)
// ============================================================================
export class SplitScreenController {
  private isSplit = false;

  toggle(): void {
    this.isSplit = !this.isSplit;
    const stage = document.getElementById('stage');
    stage?.classList.toggle('split-mode', this.isSplit);

    if (this.isSplit) {
      // Create split blackboard if not present
      let splitBoard = document.getElementById('splitBoardSurface');
      if (!splitBoard) {
        splitBoard = document.createElement('div');
        splitBoard.id = 'splitBoardSurface';
        splitBoard.className = 'split-board-surface';
        splitBoard.innerHTML = `
          <div class="split-board-header">
            <span class="split-board-title">📝 रफ ब्लैकबोर्ड (Rough Board)</span>
            <button id="btnSplitClose" style="background:transparent; border:none; color:#cbd5e1; cursor:pointer;">✕</button>
          </div>
        `;
        stage?.appendChild(splitBoard);
        document.getElementById('btnSplitClose')?.addEventListener('click', () => {
          this.toggle();
        });
      }
    }
  }

  getIsSplit(): boolean {
    return this.isSplit;
  }
}

// ============================================================================
// 5. 1-CLICK CLASS NOTES PDF EXPORTER (क्लास नोट्स डाउनलोड)
// ============================================================================
export class PdfNotesExporter {
  async exportCurrentSession(): Promise<void> {
    this.showToast('⏳ क्लास नोट्स PDF तैयार हो रही है...');

    try {
      const slideCanvas = layerManager.slideCanvas;
      const annotationCanvas = layerManager.annotationCanvas;
      const dims = layerManager.getDimensions();

      // Create a master composite offscreen canvas
      const compCanvas = document.createElement('canvas');
      compCanvas.width = dims.width || 1920;
      compCanvas.height = dims.height || 1080;
      const compCtx = compCanvas.getContext('2d')!;

      // 1. Draw slide background
      compCtx.drawImage(slideCanvas, 0, 0);
      // 2. Draw annotations
      compCtx.drawImage(annotationCanvas, 0, 0);

      // Convert to high-quality JPEG
      const jpegDataUrl = compCanvas.toDataURL('image/jpeg', 0.92);
      const binaryStr = atob(jpegDataUrl.split(',')[1]);
      const binaryLen = binaryStr.length;
      const jpegBytes = new Uint8Array(binaryLen);
      for (let i = 0; i < binaryLen; i++) {
        jpegBytes[i] = binaryStr.charCodeAt(i);
      }

      // Build pure standard PDF 1.4 binary document with zero dependencies
      const pdfBytes = this.buildSingleImagePdf(jpegBytes, compCanvas.width, compCanvas.height);
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Download
      const a = document.createElement('a');
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const state = store.getState();
      const fileName = state.currentDeck?.name ? state.currentDeck.name.replace(/\.[^/.]+$/, '') : 'Lecture_Notes';
      a.href = url;
      a.download = `SSIRO_${fileName}_${timestamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast('✅ क्लास नोट्स PDF डाउनलोड हो गई!');
    } catch (err) {
      console.error('PDF Export Error:', err);
      this.showToast('❌ PDF एक्सपोर्ट में त्रुटि हुई');
    }
  }

  // Pure specification-compliant PDF 1.4 generator
  private buildSingleImagePdf(jpegBytes: Uint8Array, width: number, height: number): Uint8Array {
    const ptWidth = 842; // Standard A4 Landscape ratio
    const ptHeight = 595;

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];

    // Obj 1: Catalog
    offsets.push(pdf.length);
    pdf += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';

    // Obj 2: Pages
    offsets.push(pdf.length);
    pdf += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';

    // Obj 3: Page
    offsets.push(pdf.length);
    pdf += `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;

    // Obj 4: Image XObject
    offsets.push(pdf.length);
    pdf += `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;

    // Convert string to bytes
    const encoder = new TextEncoder();
    const headBytes = encoder.encode(pdf);

    const streamClose = encoder.encode('\nendstream\nendobj\n');

    // Obj 5: Contents
    let contentStream = `q\n${ptWidth} 0 0 ${ptHeight} 0 0 cm\n/Im1 Do\nQ\n`;
    let tailStr = `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`;

    const startXref = headBytes.length + jpegBytes.length + streamClose.length + encoder.encode(tailStr).length;

    // XRef table
    tailStr += `xref\n0 6\n0000000000 65535 f \n`;
    for (let i = 0; i < offsets.length; i++) {
      tailStr += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    const obj5Offset = headBytes.length + jpegBytes.length + streamClose.length;
    tailStr += `${String(obj5Offset).padStart(10, '0')} 00000 n \n`;

    tailStr += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;
    const tailBytes = encoder.encode(tailStr);

    const totalLen = headBytes.length + jpegBytes.length + streamClose.length + tailBytes.length;
    const finalBuffer = new Uint8Array(totalLen);

    finalBuffer.set(headBytes, 0);
    finalBuffer.set(jpegBytes, headBytes.length);
    finalBuffer.set(streamClose, headBytes.length + jpegBytes.length);
    finalBuffer.set(tailBytes, headBytes.length + jpegBytes.length + streamClose.length);

    return finalBuffer;
  }

  private showToast(msg: string): void {
    let toast = document.getElementById('pdfToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pdfToast';
      toast.className = 'pdf-export-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'flex';
    setTimeout(() => {
      if (toast) toast.style.display = 'none';
    }, 3500);
  }
}

export const timerController = new TimerController();
export const curtainController = new CurtainController();
export const spotlightController = new SpotlightController();
export const splitScreenController = new SplitScreenController();
export const pdfNotesExporter = new PdfNotesExporter();
