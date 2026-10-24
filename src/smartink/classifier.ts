// INKFIX: Ink Classification Engine (Underline vs Shirorekha vs Shape vs Text)
import { Stroke, Point } from '../draw/annotationStore';
import { shapeFitter, FitResult } from './shapeFitter';
import { textLineDetector } from './textLines';

export type InkClass = 'underline' | 'shape' | 'text' | 'line' | 'shirorekha' | 'scribble';

export interface ClassificationResult {
  inkClass: InkClass;
  confidence: number;
  fitResult?: FitResult;
  reason: string;
}

export class InkClassifier {
  /**
   * Classifies a single stroke or stroke group per Part C2 and D
   */
  classifyStroke(
    stroke: Stroke,
    allPendingStrokes: Stroke[] = [],
    stageWidth = 3840
  ): ClassificationResult {
    const pts = stroke.points;
    if (!pts || pts.length < 3) {
      return { inkClass: 'text', confidence: 0.5, reason: 'Too few points, treat as ink' };
    }

    // Run geometric shape fitter first
    const fit = shapeFitter.fit(pts, stageWidth);

    // If stroke is nearly horizontal line, apply Underline vs Shirorekha classifier (Part C2)
    if (fit && fit.shapeType === 'line') {
      const isUnderlineOrShirorekha = this.classifyUnderlineVsShirorekha(stroke, allPendingStrokes);
      if (isUnderlineOrShirorekha.inkClass === 'shirorekha') {
        return {
          inkClass: 'shirorekha',
          confidence: isUnderlineOrShirorekha.confidence,
          reason: 'Classified as shirorekha: glyph strokes hang below'
        };
      }
      if (isUnderlineOrShirorekha.inkClass === 'underline') {
        fit.isUnderline = true;
        return {
          inkClass: 'underline',
          confidence: isUnderlineOrShirorekha.confidence,
          fitResult: fit,
          reason: isUnderlineOrShirorekha.reason
        };
      }

      // Neither shirorekha nor underline: free straight line
      return {
        inkClass: 'line',
        confidence: fit.confidence,
        fitResult: fit,
        reason: 'Free straight line'
      };
    }

    // If fit produced a closed shape (circle, ellipse, rect, square, triangle, diamond) or arrow
    if (fit && fit.shapeType !== 'line') {
      return {
        inkClass: 'shape',
        confidence: fit.confidence,
        fitResult: fit,
        reason: `Geometric shape recognized: ${fit.shapeType}`
      };
    }

    // Default: text handwriting stroke
    return {
      inkClass: 'text',
      confidence: 0.7,
      reason: 'Open freeform curve matching handwriting'
    };
  }

  /**
   * Implements strict Part C2 rules for distinguishing Shirorekha from Underline:
   * • Shirorekha: at least two other pending strokes hang below S within ±0.25 line-heights of S,
   *   with their x-range mostly inside S's x-range.
   * • Underline: neighbouring glyph strokes are above S (at or below group's bottom edge,
   *   or in lowest 20% of group box), or there is typeset/slide text above S spanning >= 60% or >= 3 line-heights.
   */
  private classifyUnderlineVsShirorekha(
    stroke: Stroke,
    allPendingStrokes: Stroke[]
  ): { inkClass: 'shirorekha' | 'underline' | 'line'; confidence: number; reason: string } {
    const sBox = this.getStrokeBounds(stroke);
    const strokeLen = sBox.maxX - sBox.minX;
    const sMidY = (sBox.minY + sBox.maxY) / 2;

    const otherStrokes = allPendingStrokes.filter((s) => s.id !== stroke.id);

    // Rule 1: Shirorekha check
    // At least two other pending strokes hang below S within ±0.25 line-heights of S,
    // with their x-range mostly inside S's x-range.
    let hangingBelowCount = 0;
    const estLineHeight = Math.max(30, strokeLen * 0.4);

    for (const other of otherStrokes) {
      const oBox = this.getStrokeBounds(other);
      const isInsideX = oBox.minX >= sBox.minX - 15 && oBox.maxX <= sBox.maxX + 15;
      const hangsBelow = oBox.minY >= sBox.minY - estLineHeight * 0.25 && oBox.maxY > sBox.maxY + 10;
      if (isInsideX && hangsBelow) {
        hangingBelowCount++;
      }
    }

    if (hangingBelowCount >= 2) {
      return {
        inkClass: 'shirorekha',
        confidence: 0.88,
        reason: `${hangingBelowCount} glyph strokes hang below S inside its horizontal span`
      };
    }

    // Rule 2: Underline check against neighbouring pending strokes
    // All or most neighbouring glyph strokes sit above S
    if (otherStrokes.length > 0) {
      let strokesAboveCount = 0;
      for (const other of otherStrokes) {
        const oBox = this.getStrokeBounds(other);
        if (oBox.maxY <= sBox.minY + 15) {
          strokesAboveCount++;
        }
      }

      if (strokesAboveCount >= 1 && strokesAboveCount >= otherStrokes.length * 0.6) {
        return {
          inkClass: 'underline',
          confidence: 0.85,
          reason: `Stroke sits at bottom of handwriting group (${strokesAboveCount} strokes above)`
        };
      }
    }

    // Rule 3: Underline check against slide text or typeset text above S
    const candidateAbove = textLineDetector.findCandidateAboveUnderline({
      x: sBox.minX,
      y: sBox.minY,
      width: strokeLen,
      height: Math.max(1, sBox.maxY - sBox.minY)
    });

    if (candidateAbove) {
      const textWidth = candidateAbove.box.width;
      const spanRatio = strokeLen / Math.max(1, textWidth);
      if (spanRatio >= 0.6 || strokeLen >= candidateAbove.lineHeight * 3) {
        return {
          inkClass: 'underline',
          confidence: 0.90,
          reason: `Stroke underlines text "${candidateAbove.text.slice(0, 20)}" (span: ${Math.round(spanRatio * 100)}%)`
        };
      }
    }

    return {
      inkClass: 'line',
      confidence: 0.70,
      reason: 'Free straight line'
    };
  }

  private getStrokeBounds(stroke: Stroke): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }
}

export const inkClassifier = new InkClassifier();
