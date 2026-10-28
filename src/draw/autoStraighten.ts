// AUTO-STRAIGHTEN: Stroke Normalization & Line Snapping Engine
import { Point } from './annotationStore';
import { textLineDetector } from '../smartink/textLines';

export interface StraightenResult {
  start: Point;
  end: Point;
  isUnderline: boolean;
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Detects if a freehand stroke was intended as a straight line / underline / highlight band.
 * Returns normalized start & end points if detected, or null if it's natural handwriting / curved stroke.
 */
export function detectAndStraightenLine(
  points: Point[],
  tool: 'pen' | 'highlighter',
  isBoardMode: boolean
): StraightenResult | null {
  if (!points || points.length < 3) return null;

  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const directLen = Math.hypot(dx, dy);

  // Minimum length check: at least 24px so small handwriting marks/dots/letters aren't snapped
  if (directLen < 24) return null;

  // Compute total arc path length and bounding box
  let pathLen = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (i > 0) {
      pathLen += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    }
  }

  // Chord-to-path ratio: letters and curves have low directLen / pathLen (e.g. circles ~0, 's' ~0.4)
  // An intended line has directLen / pathLen typically >= 0.78
  const chordRatio = directLen / Math.max(1, pathLen);
  if (chordRatio < 0.78) return null;

  // Calculate perpendicular deviation of each point from chord
  let sumSqDev = 0;
  let maxDev = 0;
  for (const p of points) {
    const dev = perpendicularDistance(p, start, end);
    sumSqDev += dev * dev;
    if (dev > maxDev) maxDev = dev;
  }

  const rmsDev = Math.sqrt(sumSqDev / points.length);
  const rmsRatio = rmsDev / directLen;
  const maxDevRatio = maxDev / directLen;

  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);
  const isHorizontalDom = boxW / boxH >= 2.4;
  const isVerticalDom = boxH / boxW >= 2.4;

  // Tolerance:
  // Predominantly horizontal or vertical strokes (e.g. underline or text highlight) allow natural hand wobble up to 14% RMS or 24% max dev
  // Diagonal lines require tighter linearity (up to 9% RMS or 16% max dev)
  const isAccepted = (isHorizontalDom || isVerticalDom)
    ? (rmsRatio <= 0.14 || maxDevRatio <= 0.24)
    : (rmsRatio <= 0.09 || maxDevRatio <= 0.16);

  if (!isAccepted) return null;

  // Directional angle
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;
  const absDeg = Math.abs(angleDeg);

  let snappedStart = { x: start.x, y: start.y };
  let snappedEnd = { x: end.x, y: end.y };
  let isUnderline = false;

  // Horizontal snap: within 15° of horizontal (0° or 180°)
  if (absDeg <= 15 || Math.abs(absDeg - 180) <= 15) {
    const midY = (minY + maxY) / 2;
    snappedStart.y = midY;
    snappedEnd.y = midY;
    isUnderline = true;

    // In deck mode, snap to text if text layer exists
    if (!isBoardMode) {
      if (tool === 'highlighter') {
        const covered = textLineDetector.findLinesCovered({ x: minX, y: minY, width: boxW, height: boxH });
        if (covered.length > 0) {
          const line = covered[0];
          snappedStart.x = Math.max(minX, line.box.x);
          snappedEnd.x = Math.min(maxX, line.box.x + line.box.width);
          const lineMidY = line.box.y + line.box.height / 2;
          snappedStart.y = lineMidY;
          snappedEnd.y = lineMidY;
        }
      } else {
        const textAbove = textLineDetector.findCandidateAboveUnderline({ x: minX, y: minY, width: boxW, height: boxH });
        if (textAbove) {
          const snapped = textLineDetector.snapUnderlineToText(snappedStart, snappedEnd, textAbove);
          snappedStart = snapped.start;
          snappedEnd = snapped.end;
        }
      }
    }
  }
  // Vertical snap: within 15° of vertical (90° or 270°)
  else if (Math.abs(absDeg - 90) <= 15) {
    const midX = (minX + maxX) / 2;
    snappedStart.x = midX;
    snappedEnd.x = midX;
  }

  return { start: snappedStart, end: snappedEnd, isUnderline };
}
