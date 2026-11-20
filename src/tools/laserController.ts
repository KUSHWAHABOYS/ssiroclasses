// ============================================================================
// LASER CONTROLLER (Dot, Trail, Ring, and Resizable Spotlight Box)
// Complete laser presenter tool suite for Smart Studio Presenter Pro
// ============================================================================

import { store } from '../state/store';

export type LaserMode = 'dot' | 'trail' | 'ring' | 'box';

interface TrailPoint {
  x: number;
  y: number;
  time: number;
  size: number;
}

export class LaserController {
  private canvasEl: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private isActive = false;
  private animId: number | null = null;

  // Configuration
  private mode: LaserMode = 'dot';
  private color = '#ef4444'; // Default Ruby Red
  private size = 12; // 6: Fine, 12: Medium, 24: Large

  // Pointer tracking
  private curX = -1000;
  private curY = -1000;
  private isPointerDown = false;
  private lastMoveTime = 0;

  // Trail mode state
  private trailPoints: TrailPoint[] = [];
  private readonly trailLifetime = 900; // ms

  // Box (चौकोर खंड) state
  private boxX = 300;
  private boxY = 200;
  private boxW = 420;
  private boxH = 240;
  private isDraggingBox = false;
  private resizeHandle: string | null = null; // 'nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'
  private dragStartX = 0;
  private dragStartY = 0;
  private initialBoxX = 0;
  private initialBoxY = 0;
  private initialBoxW = 0;
  private initialBoxH = 0;

  init(): void {
    if (this.canvasEl) return;
    const stage = document.getElementById('stage') || document.body;

    let canvas = document.getElementById('laserLayer') as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'laserLayer';
      canvas.className = 'laser-layer z-laser';
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '35';
      stage.appendChild(canvas);
    }

    this.canvasEl = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.updateDimensions();

    this.bindPointerEvents();
    window.addEventListener('resize', () => this.updateDimensions());

    // Restore saved laser settings
    try {
      const savedMode = localStorage.getItem('ssiro_laser_mode') as LaserMode | null;
      if (savedMode && ['dot', 'trail', 'ring', 'box'].includes(savedMode)) {
        this.mode = savedMode;
      }
      const savedColor = localStorage.getItem('ssiro_laser_color');
      if (savedColor) this.color = savedColor;
      const savedSize = parseInt(localStorage.getItem('ssiro_laser_size') || '12', 10);
      if (savedSize) this.size = savedSize;
    } catch {}

    // Initialize default box in center of screen
    this.boxW = Math.max(260, Math.min(600, window.innerWidth * 0.45));
    this.boxH = Math.max(160, Math.min(420, window.innerHeight * 0.35));
    this.boxX = Math.max(20, (window.innerWidth - this.boxW) / 2);
    this.boxY = Math.max(20, (window.innerHeight - this.boxH) / 2);
  }

  private updateDimensions(): void {
    if (!this.canvasEl) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvasEl.width = w;
    this.canvasEl.height = h;
  }

  public activate(): void {
    this.init();
    this.isActive = true;
    if (this.canvasEl) {
      this.canvasEl.style.display = 'block';
      // In box mode, canvas accepts pointer events for handles & dragging
      this.canvasEl.style.pointerEvents = this.mode === 'box' ? 'auto' : 'none';
    }
    this.startLoop();
  }

  public deactivate(): void {
    this.isActive = false;
    this.trailPoints = [];
    this.curX = -1000;
    this.curY = -1000;
    if (this.canvasEl) {
      this.canvasEl.style.display = 'none';
      this.canvasEl.style.pointerEvents = 'none';
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
      }
    }
    this.stopLoop();
  }

  public setMode(mode: LaserMode): void {
    this.mode = mode;
    this.trailPoints = [];
    try {
      localStorage.setItem('ssiro_laser_mode', mode);
    } catch {}

    if (this.canvasEl) {
      this.canvasEl.style.pointerEvents = mode === 'box' ? 'auto' : 'none';
    }
  }

  public getMode(): LaserMode {
    return this.mode;
  }

  public setSize(size: number): void {
    this.size = size;
    try {
      localStorage.setItem('ssiro_laser_size', String(size));
    } catch {}
  }

  public getSize(): number {
    return this.size;
  }

  public setColor(color: string): void {
    this.color = color;
    try {
      localStorage.setItem('ssiro_laser_color', color);
    } catch {}
  }

  public getColor(): string {
    return this.color;
  }

  private bindPointerEvents(): void {
    const stage = document.getElementById('stage') || window;

    // Track pointer movement across stage when laser is active
    stage.addEventListener('pointermove', (e: Event) => {
      const pe = e as PointerEvent;
      if (!this.isActive || store.getState().activeTool !== 'magnifier') return;

      this.curX = pe.clientX;
      this.curY = pe.clientY;
      this.lastMoveTime = performance.now();

      if (this.mode === 'trail') {
        this.trailPoints.push({
          x: pe.clientX,
          y: pe.clientY,
          time: performance.now(),
          size: this.size
        });
      }
    }, { passive: true });

    stage.addEventListener('pointerdown', (e: Event) => {
      const pe = e as PointerEvent;
      if (!this.isActive || store.getState().activeTool !== 'magnifier') return;

      // Don't intercept toolbar clicks
      if ((pe.target as HTMLElement).closest('.toolbar-container, .dock-layout-popover')) return;

      this.isPointerDown = true;
      this.curX = pe.clientX;
      this.curY = pe.clientY;

      if (this.mode === 'trail') {
        this.trailPoints.push({
          x: pe.clientX,
          y: pe.clientY,
          time: performance.now(),
          size: this.size
        });
      }
    });

    const onPointerUp = () => {
      this.isPointerDown = false;
      this.isDraggingBox = false;
      this.resizeHandle = null;
    };

    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    // Box Mode Specific Pointer Handlers for drag & resize
    if (this.canvasEl) {
      this.canvasEl.addEventListener('pointerdown', (e: PointerEvent) => {
        if (!this.isActive || this.mode !== 'box') return;
        const x = e.clientX;
        const y = e.clientY;

        const handle = this.hitTestBoxHandles(x, y);
        if (handle) {
          e.stopPropagation();
          e.preventDefault();
          this.resizeHandle = handle;
          this.dragStartX = x;
          this.dragStartY = y;
          this.initialBoxX = this.boxX;
          this.initialBoxY = this.boxY;
          this.initialBoxW = this.boxW;
          this.initialBoxH = this.boxH;
          try { this.canvasEl!.setPointerCapture(e.pointerId); } catch {}
          return;
        }

        // Inside box drag
        if (x >= this.boxX && x <= this.boxX + this.boxW && y >= this.boxY && y <= this.boxY + this.boxH) {
          e.stopPropagation();
          e.preventDefault();
          this.isDraggingBox = true;
          this.dragStartX = x;
          this.dragStartY = y;
          this.initialBoxX = this.boxX;
          this.initialBoxY = this.boxY;
          try { this.canvasEl!.setPointerCapture(e.pointerId); } catch {}
          return;
        }

        // Click outside box repositions the box center to tapped point
        this.boxX = Math.max(10, Math.min(window.innerWidth - this.boxW - 10, x - this.boxW / 2));
        this.boxY = Math.max(10, Math.min(window.innerHeight - this.boxH - 10, y - this.boxH / 2));
      });

      this.canvasEl.addEventListener('pointermove', (e: PointerEvent) => {
        if (!this.isActive || this.mode !== 'box' || !this.canvasEl) return;
        const canvas = this.canvasEl;
        const x = e.clientX;
        const y = e.clientY;

        if (this.resizeHandle) {
          e.stopPropagation();
          const dx = x - this.dragStartX;
          const dy = y - this.dragStartY;
          const minW = 100;
          const minH = 70;

          if (this.resizeHandle.includes('e')) {
            this.boxW = Math.max(minW, this.initialBoxW + dx);
          }
          if (this.resizeHandle.includes('s')) {
            this.boxH = Math.max(minH, this.initialBoxH + dy);
          }
          if (this.resizeHandle.includes('w')) {
            const newW = Math.max(minW, this.initialBoxW - dx);
            this.boxX = this.initialBoxX + (this.initialBoxW - newW);
            this.boxW = newW;
          }
          if (this.resizeHandle.includes('n')) {
            const newH = Math.max(minH, this.initialBoxH - dy);
            this.boxY = this.initialBoxY + (this.initialBoxH - newH);
            this.boxH = newH;
          }
          return;
        }

        if (this.isDraggingBox) {
          e.stopPropagation();
          const dx = x - this.dragStartX;
          const dy = y - this.dragStartY;
          this.boxX = Math.max(8, Math.min(window.innerWidth - this.boxW - 8, this.initialBoxX + dx));
          this.boxY = Math.max(8, Math.min(window.innerHeight - this.boxH - 8, this.initialBoxY + dy));
          return;
        }

        // Update cursor icon for handles
        const handle = this.hitTestBoxHandles(x, y);
        if (handle === 'nw' || handle === 'se') {
          canvas.style.cursor = 'nwse-resize';
        } else if (handle === 'ne' || handle === 'sw') {
          canvas.style.cursor = 'nesw-resize';
        } else if (handle === 'n' || handle === 's') {
          canvas.style.cursor = 'ns-resize';
        } else if (handle === 'e' || handle === 'w') {
          canvas.style.cursor = 'ew-resize';
        } else if (x >= this.boxX && x <= this.boxX + this.boxW && y >= this.boxY && y <= this.boxY + this.boxH) {
          canvas.style.cursor = 'move';
        } else {
          canvas.style.cursor = 'crosshair';
        }
      });
    }
  }

  private hitTestBoxHandles(x: number, y: number): string | null {
    const handleSize = 22;
    const { boxX: bx, boxY: by, boxW: bw, boxH: bh } = this;

    const isNear = (hx: number, hy: number) => Math.hypot(x - hx, y - hy) <= handleSize;

    if (isNear(bx, by)) return 'nw';
    if (isNear(bx + bw, by)) return 'ne';
    if (isNear(bx, by + bh)) return 'sw';
    if (isNear(bx + bw, by + bh)) return 'se';
    if (isNear(bx + bw / 2, by)) return 'n';
    if (isNear(bx + bw / 2, by + bh)) return 's';
    if (isNear(bx, by + bh / 2)) return 'w';
    if (isNear(bx + bw, by + bh / 2)) return 'e';

    return null;
  }

  private startLoop(): void {
    if (this.animId !== null) return;
    const render = () => {
      if (this.isActive) {
        this.render();
        this.animId = requestAnimationFrame(render);
      }
    };
    this.animId = requestAnimationFrame(render);
  }

  private stopLoop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private render(): void {
    if (!this.ctx || !this.canvasEl) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

    if (this.mode === 'dot') {
      this.renderDot(ctx);
    } else if (this.mode === 'trail') {
      this.renderTrail(ctx);
    } else if (this.mode === 'ring') {
      this.renderRing(ctx);
    } else if (this.mode === 'box') {
      this.renderBox(ctx);
    }
  }

  // 1. LASER DOT MODE
  private renderDot(ctx: CanvasRenderingContext2D): void {
    if (this.curX < -100 || this.curY < -100) return;

    const r = this.size * 0.9;
    const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.15;

    ctx.save();
    // Outer atmospheric glow
    ctx.beginPath();
    ctx.arc(this.curX, this.curY, r * 2.8 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.22;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 24 * pulse;
    ctx.fill();

    // Secondary intense glow
    ctx.beginPath();
    ctx.arc(this.curX, this.curY, r * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.65;
    ctx.shadowBlur = 14;
    ctx.fill();

    // Solid core
    ctx.beginPath();
    ctx.arc(this.curX, this.curY, r, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
    ctx.fill();

    // Hot center spark
    ctx.beginPath();
    ctx.arc(this.curX, this.curY, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.95;
    ctx.fill();

    ctx.restore();
  }

  // 2. LASER TRAIL MODE
  private renderTrail(ctx: CanvasRenderingContext2D): void {
    const now = performance.now();
    // Filter out expired points
    this.trailPoints = this.trailPoints.filter((pt) => now - pt.time <= this.trailLifetime);

    if (this.trailPoints.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < this.trailPoints.length; i++) {
        const p1 = this.trailPoints[i - 1];
        const p2 = this.trailPoints[i];
        const age = now - p2.time;
        const alpha = Math.max(0, 1 - age / this.trailLifetime);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        // Glow pass
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = alpha * 0.4;
        ctx.lineWidth = this.size * 2.2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 18;
        ctx.stroke();

        // Bright core pass
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = alpha * 0.9;
        ctx.lineWidth = Math.max(2, this.size * 0.65);
        ctx.shadowBlur = 6;
        ctx.stroke();
      }

      ctx.restore();
    }

    // Always draw current tip dot
    this.renderDot(ctx);
  }

  // 3. LASER RING MODE
  private renderRing(ctx: CanvasRenderingContext2D): void {
    if (this.curX < -100 || this.curY < -100) return;

    const baseRadius = this.size === 6 ? 70 : this.size === 12 ? 120 : 180;
    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.04;
    const r = baseRadius * pulse;

    ctx.save();

    // Subtle dark vignette surround
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, this.canvasEl!.width, this.canvasEl!.height);

    // Punch out clear illuminated circle inside ring
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(this.curX, this.curY, r, 0, Math.PI * 2);
    ctx.fill();

    // Switch back to draw glowing neon ring
    ctx.globalCompositeOperation = 'source-over';

    // Glowing border ring
    ctx.beginPath();
    ctx.arc(this.curX, this.curY, r, 0, Math.PI * 2);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 18;
    ctx.stroke();

    // Center laser dot
    ctx.beginPath();
    ctx.arc(this.curX, this.curY, 4, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.restore();
  }

  // 4. LASER BOX / FRAME MODE (चौकोर खंड)
  private renderBox(ctx: CanvasRenderingContext2D): void {
    const { boxX: x, boxY: y, boxW: w, boxH: h } = this;
    const cw = this.canvasEl!.width;
    const ch = this.canvasEl!.height;

    ctx.save();

    // 1. Semi-transparent dark vignette over entire screen
    ctx.fillStyle = 'rgba(0, 0, 0, 0.50)';
    ctx.fillRect(0, 0, cw, ch);

    // 2. Punch out clear illuminated rectangle (चौकोर खंड)
    ctx.globalCompositeOperation = 'destination-out';
    const cornerR = 12;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, cornerR);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();

    // 3. Draw glowing neon border frame
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, cornerR);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 20;
    ctx.stroke();

    // Inner subtle glow border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 4;
    ctx.stroke();

    // 4. Draw tactile knurled resize handles on 4 corners and 4 edges
    const handleRadius = 6.5;
    const handles = [
      { x: x, y: y },                     // NW
      { x: x + w, y: y },                 // NE
      { x: x, y: y + h },                 // SW
      { x: x + w, y: y + h },             // SE
      { x: x + w / 2, y: y },             // N
      { x: x + w / 2, y: y + h },         // S
      { x: x, y: y + h / 2 },             // W
      { x: x + w, y: y + h / 2 }          // E
    ];

    handles.forEach((hd) => {
      ctx.beginPath();
      ctx.arc(hd.x, hd.y, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // 5. Small stylish size indicator badge above box
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    const sizeText = `Box: ${Math.round(w)} × ${Math.round(h)} px  (Drag edges to resize)`;
    const textW = ctx.measureText(sizeText).width;
    const badgeX = Math.max(10, x + (w - textW - 20) / 2);
    const badgeY = Math.max(24, y - 10);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY - 16, textW + 20, 20, 6);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(badgeX, badgeY - 16, textW + 20, 20);
      ctx.strokeRect(badgeX, badgeY - 16, textW + 20, 20);
    }

    ctx.fillStyle = '#f8fafc';
    ctx.fillText(sizeText, badgeX + 10, badgeY - 3);

    ctx.restore();
  }
}

export const laserController = new LaserController();
