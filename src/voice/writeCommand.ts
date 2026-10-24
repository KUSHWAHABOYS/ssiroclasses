// INKFIX: Voice "Write This Here" Command Processor (Part G)
import { Point, Stroke, annotationStore } from '../draw/annotationStore';
import { store } from '../state/store';
import { layerManager } from '../core/layers';

export type WriteLocation =
  | 'arrow_head'
  | 'arrow_tail'
  | 'arrow_above'
  | 'arrow_below'
  | 'shape_inside'
  | 'here'
  | 'title'
  | 'line_below'
  | 'default';

export interface ParsedWriteCommand {
  action: 'write' | 'delete_last' | 'resize';
  text?: string;
  location: WriteLocation;
  resizeFactor?: number;
}

export class VoiceWriteManager {
  private lastPointerPos: Point | null = null;
  private lastPointerTime = 0;
  private lastWrittenStrokeId: string | null = null;

  init(): void {
    // Track pointer moves/taps on stage to capture "here / यहाँ" positions
    window.addEventListener('pointerdown', (e: PointerEvent) => {
      if (layerManager.slideCanvas) {
        const rect = layerManager.slideCanvas.getBoundingClientRect();
        const scaleX = 3840 / Math.max(1, rect.width);
        const scaleY = 2160 / Math.max(1, rect.height);
        this.lastPointerPos = {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
        };
        this.lastPointerTime = Date.now();
      }
    });
  }

  recordPointerPosition(pos: Point): void {
    this.lastPointerPos = pos;
    this.lastPointerTime = Date.now();
  }

  /**
   * Parses spoken transcript for write commands per Part G1
   */
  parseCommand(transcript: string): ParsedWriteCommand | null {
    const raw = transcript.trim().toLowerCase();
    if (!raw) return null;

    // Extra commands: Delete last text
    if (
      raw.includes('पिछला मिटाओ') ||
      raw.includes('पिछली मिटाओ') ||
      raw.includes('delete last text') ||
      raw.includes('remove last text')
    ) {
      return { action: 'delete_last', location: 'default' };
    }

    // Extra commands: Resize
    if (raw.includes('बड़ा करो') || raw.includes('make bigger') || raw.includes('increase text size')) {
      return { action: 'resize', resizeFactor: 1.25, location: 'default' };
    }
    if (raw.includes('छोटा करो') || raw.includes('make smaller') || raw.includes('decrease text size')) {
      return { action: 'resize', resizeFactor: 0.8, location: 'default' };
    }

    // Check for write verbs
    const hindiVerbs = ['लिखो', 'लिख दो', 'लिखिए', 'लिखें', 'टाइप करो', 'डालो', 'रखो'];
    const engVerbs = ['write', 'type', 'add', 'put'];

    let hasVerb = false;
    let matchedVerb = '';

    for (const v of [...hindiVerbs, ...engVerbs]) {
      if (raw.includes(v)) {
        hasVerb = true;
        matchedVerb = v;
        break;
      }
    }

    if (!hasVerb) return null;

    // Detect location phrase
    let location: WriteLocation = 'default';
    if (raw.includes('तीर के आगे') || raw.includes('आगे') || raw.includes('at the arrow') || raw.includes('arrow head')) {
      location = 'arrow_head';
    } else if (raw.includes('तीर के पीछे') || raw.includes('पीछे') || raw.includes('tail') || raw.includes('behind')) {
      location = 'arrow_tail';
    } else if (raw.includes('तीर के ऊपर') || raw.includes('above the arrow') || raw.includes('above arrow')) {
      location = 'arrow_above';
    } else if (raw.includes('तीर के नीचे') || raw.includes('below the arrow') || raw.includes('below arrow')) {
      location = 'arrow_below';
    } else if (raw.includes('इसके अंदर') || raw.includes('अंदर') || raw.includes('बीच में') || raw.includes('inside') || raw.includes('center')) {
      location = 'shape_inside';
    } else if (raw.includes('शीर्षक') || raw.includes('title') || raw.includes('heading')) {
      location = 'title';
    } else if (raw.includes('लाइन के नीचे') || raw.includes('रेखा के नीचे') || raw.includes('under line') || raw.includes('below line')) {
      location = 'line_below';
    } else if (raw.includes('यहाँ') || raw.includes('यहां') || raw.includes('here')) {
      location = 'here';
    }

    // Extract dictation text by stripping location and verb
    let text = raw;
    // Strip verb
    text = text.replace(matchedVerb, '');

    // Strip location phrases
    const locationPhrases = [
      'तीर के आगे', 'आगे', 'तीर के पीछे', 'पीछे', 'तीर के ऊपर', 'तीर के नीचे',
      'इसके अंदर', 'अंदर', 'बीच में', 'शीर्षक', 'लाइन के नीचे', 'रेखा के नीचे',
      'यहाँ पर', 'यहाँ', 'यहां पर', 'यहां',
      'at the arrow', 'arrow head', 'behind arrow', 'above arrow', 'below arrow',
      'inside', 'center', 'title', 'heading', 'under line', 'below line', 'here'
    ];

    for (const phrase of locationPhrases) {
      text = text.replace(phrase, '');
    }

    // Clean up connecting particles like "पर", "को", "में"
    text = text.replace(/\b(पर|को|में|at|in|on|the)\b/g, '').trim();

    if (!text) return null;

    return {
      action: 'write',
      text: this.normalizeText(text),
      location
    };
  }

  /**
   * Normalizes dictated words with common educational glossaries
   */
  private normalizeText(raw: string): string {
    const glossary: Record<string, string> = {
      'विष्णु': 'विष्णु',
      'vishnu': 'विष्णु',
      'आर्यभट्ट': 'आर्यभट्ट',
      'aryabhata': 'आर्यभट्ट',
      'aryabhatta': 'आर्यभट्ट',
      'वेद': 'वेद',
      'veda': 'वेद',
      'सिंधु': 'सिंधु',
      'indus': 'सिंधु',
      'हड़प्पा': 'हड़प्पा',
      'harappa': 'हड़प्पा'
    };

    const lower = raw.toLowerCase();
    for (const [k, v] of Object.entries(glossary)) {
      if (lower === k) return v;
    }

    // Capitalize first letter if English
    if (/^[a-z]/.test(raw)) {
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    return raw;
  }

  /**
   * Executes the parsed write command on canvas per Part G2
   */
  async execute(command: ParsedWriteCommand): Promise<boolean> {
    if (command.action === 'delete_last') {
      const strokes = annotationStore.getStrokes();
      let target: Stroke | undefined;
      if (this.lastWrittenStrokeId) {
        target = strokes.find((s) => s.id === this.lastWrittenStrokeId);
      }
      if (!target) {
        // Fall back to most recent text stroke
        for (let i = strokes.length - 1; i >= 0; i--) {
          if (strokes[i].tool === 'text') {
            target = strokes[i];
            break;
          }
        }
      }

      if (target) {
        const erasePt = target.points[0] || (target.box ? { x: target.box.x + 5, y: target.box.y + 5 } : { x: 0, y: 0 });
        annotationStore.eraseStrokeAt(erasePt, 50);
        this.lastWrittenStrokeId = null;
        return true;
      }
      return false;
    }

    if (command.action === 'resize') {
      if (this.lastWrittenStrokeId && command.resizeFactor) {
        const strokes = annotationStore.getAllStrokes();
        const target = strokes.find((s) => s.id === this.lastWrittenStrokeId);
        if (target && target.box) {
          target.box.height = Math.round(target.box.height * command.resizeFactor);
          target.box.width = Math.round(target.box.width * command.resizeFactor);
          annotationStore.redrawAll();
          return true;
        }
      }
      return false;
    }

    if (!command.text) return false;

    // Anchor resolution per Part G2
    const anchor = this.findRecentAnchor(command.location);
    const placement = this.calculatePlacement(command.text, command.location, anchor);

    const isHindi = /[\u0900-\u097F]/.test(command.text);
    const textStroke: Stroke = {
      id: `voice-text-${Date.now()}`,
      tool: 'text',
      color: store.getState().activeColor || '#ffffff',
      size: placement.fontSize,
      alpha: 1.0,
      points: [{ x: placement.x, y: placement.y }],
      text: command.text,
      box: {
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height
      },
      timestamp: Date.now()
    };

    annotationStore.addStroke(textStroke);
    this.lastWrittenStrokeId = textStroke.id;

    // Show 600ms highlight ring animation per Part G2
    this.showHighlightRing(placement.x, placement.y, placement.width, placement.height);

    return true;
  }

  /**
   * Finds the most relevant recent anchor stroke (Arrow, Shape, Line)
   */
  private findRecentAnchor(location: WriteLocation): Stroke | null {
    const strokes = annotationStore.getStrokes();
    const now = Date.now();

    for (let i = strokes.length - 1; i >= 0; i--) {
      const s = strokes[i];
      // Only anchor to objects created in the last 30s
      if (now - s.timestamp > 30000 && location !== 'default') continue;

      if (location.startsWith('arrow') && (s.tool === 'arrow' || s.shapeType === 'arrow')) {
        return s;
      }
      if (location === 'shape_inside' && s.shapeType && s.shapeType !== 'line') {
        return s;
      }
      if (location === 'line_below' && (s.shapeType === 'line' || s.isUnderline)) {
        return s;
      }
      if (location === 'default') {
        if (s.tool === 'arrow' || s.shapeType) return s;
      }
    }

    return null;
  }

  /**
   * Calculates exact (x, y, width, height, fontSize) for dictated text
   */
  private calculatePlacement(
    text: string,
    location: WriteLocation,
    anchor: Stroke | null
  ): { x: number; y: number; width: number; height: number; fontSize: number } {
    const isHindi = /[\u0900-\u097F]/.test(text);

    // Default title placement
    if (location === 'title') {
      const fontSize = Math.round(2160 * 0.07); // ~150px
      const charWidth = fontSize * 0.65;
      const width = text.length * charWidth;
      const height = fontSize * 1.2;
      const x = Math.max(50, (3840 - width) / 2);
      const y = 80;
      return { x, y, width, height, fontSize };
    }

    // Default here / pointer placement
    if (location === 'here' || (!anchor && location === 'default')) {
      const now = Date.now();
      const pos = (this.lastPointerPos && now - this.lastPointerTime < 10000)
        ? this.lastPointerPos
        : { x: 1920, y: 1080 };

      const fontSize = 48;
      const width = text.length * fontSize * 0.65;
      const height = fontSize * 1.2;
      return {
        x: Math.min(3840 - width - 50, Math.max(50, pos.x)),
        y: Math.min(2160 - height - 50, Math.max(50, pos.y)),
        width,
        height,
        fontSize
      };
    }

    // Placement relative to Arrow (Head / Tail / Above / Below)
    if (anchor && (anchor.tool === 'arrow' || anchor.shapeType === 'arrow') && anchor.startPoint && anchor.endPoint) {
      const T = anchor.startPoint;
      const H = anchor.endPoint;
      const dx = H.x - T.x;
      const dy = H.y - T.y;
      const arrowLen = Math.hypot(dx, dy);

      const fontSize = Math.min(Math.max(28, arrowLen * 0.35), 2160 * 0.09);
      const width = text.length * fontSize * 0.65;
      const height = fontSize * 1.2;
      const gap = 0.6 * fontSize;

      let x = H.x;
      let y = H.y;

      if (location === 'arrow_tail') {
        const uX = -dx / Math.max(1, arrowLen);
        const uY = -dy / Math.max(1, arrowLen);
        x = T.x + uX * (gap + width);
        y = T.y + uY * gap - height / 2;
      } else if (location === 'arrow_above') {
        x = (T.x + H.x) / 2 - width / 2;
        y = Math.min(T.y, H.y) - gap - height;
      } else if (location === 'arrow_below') {
        x = (T.x + H.x) / 2 - width / 2;
        y = Math.max(T.y, H.y) + gap;
      } else {
        // arrow_head (Default for arrows)
        const isHorizontalDominant = Math.abs(dx) >= Math.abs(dy);
        if (isHorizontalDominant) {
          if (dx >= 0) {
            // Pointing Right: left-aligned just past head
            x = H.x + gap;
            y = H.y - height / 2;
          } else {
            // Pointing Left: right-aligned ending at H - gap
            x = H.x - gap - width;
            y = H.y - height / 2;
          }
        } else {
          if (dy >= 0) {
            // Pointing Down
            x = H.x - width / 2;
            y = H.y + gap;
          } else {
            // Pointing Up
            x = H.x - width / 2;
            y = H.y - gap - height;
          }
        }
      }

      // Clamp within slide
      x = Math.min(3840 - width - 50, Math.max(50, x));
      y = Math.min(2160 - height - 50, Math.max(50, y));

      return { x, y, width, height, fontSize };
    }

    // Placement Inside Shape (Circle / Box / etc.)
    if (anchor && (location === 'shape_inside' || location === 'default') && anchor.box) {
      const b = anchor.box;
      const fontSize = Math.min(Math.max(24, b.height * 0.45), 2160 * 0.08);
      const width = text.length * fontSize * 0.65;
      const height = fontSize * 1.2;
      const x = Math.max(50, b.x + (b.width - width) / 2);
      const y = Math.max(50, b.y + (b.height - height) / 2);
      return { x, y, width, height, fontSize };
    }

    // Placement Below Line
    if (anchor && (anchor.shapeType === 'line' || anchor.isUnderline) && anchor.startPoint && anchor.endPoint) {
      const minX = Math.min(anchor.startPoint.x, anchor.endPoint.x);
      const maxX = Math.max(anchor.startPoint.x, anchor.endPoint.x);
      const maxY = Math.max(anchor.startPoint.y, anchor.endPoint.y);

      const fontSize = 36;
      const width = text.length * fontSize * 0.65;
      const height = fontSize * 1.2;
      const x = Math.max(50, minX + (maxX - minX - width) / 2);
      const y = Math.min(2160 - height - 50, maxY + 15);
      return { x, y, width, height, fontSize };
    }

    // General Fallback
    const fontSize = 42;
    const width = text.length * fontSize * 0.65;
    const height = fontSize * 1.2;
    return { x: 1920 - width / 2, y: 1080 - height / 2, width, height, fontSize };
  }

  /**
   * Displays 600ms transient highlight ring around new text per Part G2
   */
  private showHighlightRing(x: number, y: number, width: number, height: number): void {
    const ring = document.createElement('div');
    ring.style.position = 'fixed';
    ring.style.pointerEvents = 'none';
    ring.style.zIndex = '9999';
    ring.style.border = '3px solid var(--primary-accent, #38bdf8)';
    ring.style.borderRadius = '12px';
    ring.style.boxShadow = '0 0 20px rgba(56, 189, 248, 0.6)';
    ring.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
    ring.style.transform = 'scale(0.85)';
    ring.style.opacity = '1';

    // Convert slide space to viewport space
    const canvas = layerManager.slideCanvas;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / 3840;
      const scaleY = rect.height / 2160;

      ring.style.left = `${rect.left + x * scaleX - 10}px`;
      ring.style.top = `${rect.top + y * scaleY - 6}px`;
      ring.style.width = `${width * scaleX + 20}px`;
      ring.style.height = `${height * scaleY + 12}px`;

      document.body.appendChild(ring);

      requestAnimationFrame(() => {
        ring.style.transform = 'scale(1.05)';
        ring.style.opacity = '0';
      });

      setTimeout(() => {
        ring.remove();
      }, 650);
    }
  }
}

export const voiceWriteManager = new VoiceWriteManager();
