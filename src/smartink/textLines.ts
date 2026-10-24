// INKFIX: Text Line Detection & Underline Snapping (Part C4)
import { Point, Stroke, annotationStore } from '../draw/annotationStore';

export interface TextLineCandidate {
  id: string;
  text: string;
  box: { x: number; y: number; width: number; height: number };
  baselineY: number;
  lineHeight: number;
  words: { text: string; x: number; width: number }[];
  isPendingHandwriting?: boolean;
}

export class TextLineDetector {
  /**
   * Discovers text candidates near a stroke:
   * 1. Typeset text strokes in annotationStore
   * 2. Pending handwriting group (if active)
   * 3. PDF text layer spans from DOM (if available)
   */
  getCandidates(pendingGroup?: { box: { x: number; y: number; width: number; height: number }; strokes: Stroke[] } | null): TextLineCandidate[] {
    const candidates: TextLineCandidate[] = [];

    // 1. Typeset text strokes in annotation store
    const strokes = annotationStore.getStrokes();
    for (const s of strokes) {
      if (s.tool === 'text' && s.text && s.box) {
        const text = s.text.trim();
        if (!text) continue;

        const lineHeight = Math.max(16, s.box.height);
        const baselineY = s.box.y + lineHeight * 0.82; // standard font baseline
        const words = this.estimateWords(text, s.box.x, s.box.width);

        candidates.push({
          id: s.id,
          text,
          box: { ...s.box },
          baselineY,
          lineHeight,
          words,
          isPendingHandwriting: false
        });
      }
    }

    // 2. Pending handwriting group
    if (pendingGroup && pendingGroup.box.width > 20 && pendingGroup.box.height > 10) {
      const b = pendingGroup.box;
      const lineHeight = Math.max(20, b.height);
      const baselineY = b.y + lineHeight * 0.85;

      candidates.push({
        id: 'pending-handwriting',
        text: 'pending',
        box: { ...b },
        baselineY,
        lineHeight,
        words: [{ text: 'pending', x: b.x, width: b.width }],
        isPendingHandwriting: true
      });
    }

    // 3. Slide text layer (PDF.js textLayer spans in DOM)
    const textLayer = document.querySelector('.textLayer');
    if (textLayer) {
      const spans = textLayer.querySelectorAll('span');
      const stageRect = textLayer.getBoundingClientRect();
      const scaleX = 3840 / Math.max(1, stageRect.width);
      const scaleY = 2160 / Math.max(1, stageRect.height);

      for (let i = 0; i < spans.length; i++) {
        const span = spans[i];
        const text = (span.textContent || '').trim();
        if (!text) continue;

        const r = span.getBoundingClientRect();
        const x = (r.left - stageRect.left) * scaleX;
        const y = (r.top - stageRect.top) * scaleY;
        const width = r.width * scaleX;
        const height = r.height * scaleY;

        if (width < 10 || height < 8) continue;

        const lineHeight = height;
        const baselineY = y + height * 0.85;
        const words = this.estimateWords(text, x, width);

        candidates.push({
          id: `pdf-text-${i}`,
          text,
          box: { x, y, width, height },
          baselineY,
          lineHeight,
          words,
          isPendingHandwriting: false
        });
      }
    }

    return candidates;
  }

  /**
   * Checks if an underline lies below a candidate text line within 0.9 line-heights,
   * overlapping horizontally.
   */
  findCandidateAboveUnderline(
    underlineBox: { x: number; y: number; width: number; height: number },
    pendingGroup?: { box: { x: number; y: number; width: number; height: number }; strokes: Stroke[] } | null
  ): TextLineCandidate | null {
    const candidates = this.getCandidates(pendingGroup);
    let bestCandidate: TextLineCandidate | null = null;
    let minVerticalDist = Infinity;

    const uLeft = underlineBox.x;
    const uRight = underlineBox.x + underlineBox.width;
    const uY = underlineBox.y;

    for (const c of candidates) {
      const cBottom = c.box.y + c.box.height;
      const cLeft = c.box.x;
      const cRight = c.box.x + c.box.width;

      // Vertical proximity check: underline must sit at or below text bottom, within 0.9 line-heights
      const vertDist = uY - cBottom;
      if (vertDist >= -c.lineHeight * 0.3 && vertDist <= c.lineHeight * 0.9) {
        // Horizontal overlap check
        const overlap = Math.max(0, Math.min(uRight, cRight) - Math.max(uLeft, cLeft));
        const minOverlap = Math.min(underlineBox.width * 0.4, c.box.width * 0.4);

        if (overlap >= minOverlap && vertDist < minVerticalDist) {
          minVerticalDist = vertDist;
          bestCandidate = c;
        }
      }
    }

    return bestCandidate;
  }

  /**
   * Snaps underline start and end to text baseline + 0.12 * lineHeight,
   * spanning word boundaries or full text width (if >= 80%).
   */
  snapUnderlineToText(
    start: Point,
    end: Point,
    candidate: TextLineCandidate
  ): { start: Point; end: Point; matchedCandidate: TextLineCandidate } {
    const snappedY = candidate.baselineY + 0.12 * candidate.lineHeight;

    const strokeMinX = Math.min(start.x, end.x);
    const strokeMaxX = Math.max(start.x, end.x);
    const strokeWidth = strokeMaxX - strokeMinX;

    let newMinX = strokeMinX;
    let newMaxX = strokeMaxX;

    // Rule: If stroke covered >= 80% of text width, snap to entire text width
    if (strokeWidth >= candidate.box.width * 0.8) {
      newMinX = candidate.box.x;
      newMaxX = candidate.box.x + candidate.box.width;
    } else {
      // Snap outward to word boundaries
      let leftBound = strokeMinX;
      let rightBound = strokeMaxX;

      for (const w of candidate.words) {
        const wStart = w.x;
        const wEnd = w.x + w.width;

        // If stroke touches this word, expand to encompass it
        if (strokeMinX <= wEnd && strokeMaxX >= wStart) {
          leftBound = Math.min(leftBound, wStart);
          rightBound = Math.max(rightBound, wEnd);
        }
      }

      newMinX = leftBound;
      newMaxX = rightBound;
    }

    const isLeftToRight = start.x <= end.x;
    return {
      start: { x: isLeftToRight ? newMinX : newMaxX, y: snappedY },
      end: { x: isLeftToRight ? newMaxX : newMinX, y: snappedY },
      matchedCandidate: candidate
    };
  }

  private estimateWords(text: string, startX: number, totalWidth: number): { text: string; x: number; width: number }[] {
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) {
      return [{ text, x: startX, width: totalWidth }];
    }

    const totalChars = tokens.reduce((acc, t) => acc + t.length, 0) + (tokens.length - 1);
    const charWidth = totalWidth / Math.max(1, totalChars);

    const words: { text: string; x: number; width: number }[] = [];
    let currX = startX;

    for (const tok of tokens) {
      const wWidth = tok.length * charWidth;
      words.push({ text: tok, x: currX, width: wWidth });
      currX += wWidth + charWidth; // Space
    }

    return words;
  }
}

export const textLineDetector = new TextLineDetector();
