import { Stroke, annotationStore } from './annotationStore';
// MIC-AI: Multi-Provider AI Router integration for Handwriting OCR
import { aiRouter } from '../ai/aiRouter';
import { keyVault } from '../ai/keyVault';
import { store } from '../state/store';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface WordGroup {
  strokes: Stroke[];
  box: BoundingBox;
  lastStrokeTime: number;
  color: string;
}

export interface HandwritingRecognizer {
  recognize(group: WordGroup): Promise<string>;
}

export class GeminiHandwritingRecognizer implements HandwritingRecognizer {
  async recognize(group: WordGroup): Promise<string> {
    if (!keyVault.hasAnyKey()) {
      throw new Error('कोई AI कुंजी सेट नहीं है (No AI API Key found in settings)');
    }

    // Render group strokes to cropped offscreen canvas (black ink on white, padded 16px per B7.2)
    const padding = 16;
    const w = Math.max(32, Math.round(group.box.width + padding * 2));
    const h = Math.max(32, Math.round(group.box.height + padding * 2));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Draw strokes in black ink
    ctx.save();
    ctx.translate(padding - group.box.minX, padding - group.box.minY);
    for (const stroke of group.strokes) {
      const blackStroke: Stroke = {
        ...stroke,
        color: '#000000',
        alpha: 1.0
      };
      annotationStore.renderStroke(ctx, blackStroke);
    }
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/png');
    const base64Png = dataUrl.replace(/^data:image\/png;base64,/, '');

    const prompt =
      'Transcribe the single handwritten word or short phrase in this image exactly. Return only the text. Preserve Devanagari matras and shirorekha. If it is Hindi return Devanagari only; if English return Latin letters only. No explanation.';

    const result = await aiRouter.run('handwriting-ocr', {
      image: base64Png,
      prompt,
      temperature: 0.0,
      maxTokens: 60
    });
    return result.text.trim();
  }
}

// Optional ML Kit interface wrapper for Android APK Phase 2 per B7.2
export class MLKitHandwritingRecognizer implements HandwritingRecognizer {
  async recognize(group: WordGroup): Promise<string> {
    throw new Error('ML Kit offline model will be available in APK release');
  }
}

export class HandwritingCoordinator {
  private pendingGroup: WordGroup | null = null;
  private idleTimer: number = 0;
  private recognizer: HandwritingRecognizer = new GeminiHandwritingRecognizer();
  private undoConversionTimer: number = 0;

  init(): void {
    window.addEventListener('cancel-in-progress-drawing', () => {
      this.cancelPending();
    });
  }

  onNewStroke(stroke: Stroke): void {
    if (stroke.tool !== 'pen' || !store.getState().isHandwritingEnabled) return;

    window.clearTimeout(this.idleTimer);
    const strokeBox = this.computeStrokeBox(stroke);
    const now = Date.now();

    if (!this.pendingGroup) {
      this.pendingGroup = {
        strokes: [stroke],
        box: strokeBox,
        lastStrokeTime: now,
        color: stroke.color
      };
    } else {
      // Check proximity threshold per B7.1: horizontal gap < 1.2 * average stroke height
      const avgHeight = Math.max(20, this.pendingGroup.box.height);
      const gapThreshold = 1.2 * avgHeight;
      const isClose =
        strokeBox.minX <= this.pendingGroup.box.maxX + gapThreshold &&
        strokeBox.maxX >= this.pendingGroup.box.minX - gapThreshold &&
        Math.abs(strokeBox.minY - this.pendingGroup.box.minY) < avgHeight * 1.5;

      if (isClose) {
        this.pendingGroup.strokes.push(stroke);
        this.pendingGroup.box = this.mergeBoxes(this.pendingGroup.box, strokeBox);
        this.pendingGroup.lastStrokeTime = now;
      } else {
        // Commit previous group immediately, start new group
        this.triggerRecognition(this.pendingGroup);
        this.pendingGroup = {
          strokes: [stroke],
          box: strokeBox,
          lastStrokeTime: now,
          color: stroke.color
        };
      }
    }

    const delay = store.getState().settings.handwritingDelayMs || 1800;
    this.idleTimer = window.setTimeout(() => {
      if (this.pendingGroup) {
        this.triggerRecognition(this.pendingGroup);
        this.pendingGroup = null;
      }
    }, delay);
  }

  private async triggerRecognition(group: WordGroup): Promise<void> {
    try {
      const recognized = await this.recognizer.recognize(group);
      if (!recognized) return;

      // Script detection per B7.4
      const hasDevanagari = /[\u0900-\u097F]/.test(recognized);

      // Remove the original pen strokes from annotation store
      const originalStrokes = [...group.strokes];
      for (const s of group.strokes) {
        annotationStore.eraseStrokeAt(s.points[0], 2000); // clears whole group
      }

      // Add typeset text stroke
      const textStroke: Stroke = {
        id: `typeset-${Date.now()}`,
        tool: 'text',
        color: group.color,
        size: Math.round(group.box.height * 0.8),
        alpha: 1.0,
        points: [{ x: group.box.minX, y: group.box.minY }],
        text: recognized,
        box: {
          x: group.box.minX,
          y: group.box.minY,
          width: group.box.width,
          height: group.box.height
        },
        timestamp: Date.now()
      };

      annotationStore.addStroke(textStroke);

      // Show 3-second "Undo conversion" floating chip per B7.3
      this.showUndoChip(originalStrokes, textStroke);
    } catch (err: any) {
      console.warn('Handwriting recognition fallback (ink preserved):', err.message);
      // Fallback: Never delete ink unless recognition succeeded!
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            message: `हस्तलेखन रूपांतरण: ${err.message || 'ऑफलाइन या कुंजी अनुपलब्ध'} (स्याही सुरक्षित है)`
          }
        })
      );
    }
  }

  private showUndoChip(originalStrokes: Stroke[], textStroke: Stroke): void {
    const container = document.getElementById('undoChipContainer')!;
    container.innerHTML = `
      <div class="undo-chip">
        <span>रूपांतरित: "${textStroke.text}"</span>
        <button class="undo-chip-btn" id="btnUndoConversion">स्याही वापस लाएं (Undo)</button>
      </div>
    `;

    document.getElementById('btnUndoConversion')?.addEventListener('click', () => {
      // Remove text stroke, restore original ink
      annotationStore.eraseStrokeAt(textStroke.points[0], 2000);
      for (const s of originalStrokes) {
        annotationStore.addStroke(s);
      }
      container.innerHTML = '';
      window.clearTimeout(this.undoConversionTimer);
    });

    window.clearTimeout(this.undoConversionTimer);
    this.undoConversionTimer = window.setTimeout(() => {
      container.innerHTML = '';
    }, 3000); // 3 seconds per B7.3
  }

  private computeStrokeBox(stroke: Stroke): BoundingBox {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  }

  private mergeBoxes(b1: BoundingBox, b2: BoundingBox): BoundingBox {
    const minX = Math.min(b1.minX, b2.minX);
    const minY = Math.min(b1.minY, b2.minY);
    const maxX = Math.max(b1.maxX, b2.maxX);
    const maxY = Math.max(b1.maxY, b2.maxY);
    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  private cancelPending(): void {
    window.clearTimeout(this.idleTimer);
    this.pendingGroup = null;
  }
}

export const handwritingCoordinator = new HandwritingCoordinator();
