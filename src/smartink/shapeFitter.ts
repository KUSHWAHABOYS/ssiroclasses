// INKFIX: Geometric Shape Fitting Engine (Lines, Underlines, Boxes, Circles, Triangles, Arrows)
import { Point, Stroke, ExtendedShapeType } from '../draw/annotationStore';
import { ShapeThresholds, getThresholds } from './thresholds';

export interface FitResult {
  shapeType: ExtendedShapeType | 'arrow';
  confidence: number;
  startPoint: Point;
  endPoint: Point;
  extraPoints?: Point[];
  box?: { x: number; y: number; width: number; height: number };
  isUnderline?: boolean;
}

/**
 * Standard Ramer-Douglas-Peucker (RDP) polyline simplification
 */
export function rdpSimplify(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return [...points];

  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, index + 1), epsilon);
    const right = rdpSimplify(points.slice(index), epsilon);
    return left.slice(0, left.length - 1).concat(right);
  } else {
    return [start, end];
  }
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
 * Calculates total arc length of points
 */
export function calculatePathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

/**
 * Calculates bounding box of points
 */
export function computeBoundingBox(points: Point[]): { x: number; y: number; width: number; height: number; diag: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const diag = Math.hypot(width, height);
  return { x: minX, y: minY, width, height, diag };
}

/**
 * Merges corners closer than minDistance
 */
function mergeCorners(corners: Point[], minDistance: number): Point[] {
  if (corners.length <= 2) return corners;
  const merged: Point[] = [corners[0]];

  for (let i = 1; i < corners.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = corners[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= minDistance) {
      merged.push(curr);
    }
  }

  // Check wrap-around between last and first
  if (merged.length > 2) {
    const first = merged[0];
    const last = merged[merged.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < minDistance) {
      merged.pop();
    }
  }

  return merged;
}

export class ShapeFitter {
  private thresholds: ShapeThresholds;

  constructor(thresholds: ShapeThresholds = getThresholds('normal')) {
    this.thresholds = thresholds;
  }

  setThresholds(t: ShapeThresholds): void {
    this.thresholds = t;
  }

  /**
   * Evaluates all candidate geometric shapes and returns the best fit.
   */
  fit(points: Point[], stageWidth = 3840): FitResult | null {
    if (points.length < 3) return null;

    const pathLength = calculatePathLength(points);
    const box = computeBoundingBox(points);
    if (pathLength < 20 || box.diag < 15) return null;

    const startPt = points[0];
    const endPt = points[points.length - 1];
    const closureDist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);
    const closureGapRatio = closureDist / pathLength;

    const candidates: FitResult[] = [];

    // Candidate 1: Straight Line / Underline
    const lineFit = this.fitLine(points, pathLength, box, stageWidth);
    if (lineFit) candidates.push(lineFit);

    // Candidate 2: Arrow (must be open stroke, closureGapRatio > 0.3)
    if (closureGapRatio > 0.3) {
      const arrowFit = this.fitArrow(points, pathLength, box);
      if (arrowFit) candidates.push(arrowFit);
    }

    // Candidate 3: Circle or Ellipse (if sufficiently closed)
    if (closureGapRatio <= this.thresholds.maxClosureGapRatio && box.diag >= this.thresholds.minShapeDiagonal) {
      const circleFit = this.fitCircleOrEllipse(points, box);
      if (circleFit) candidates.push(circleFit);
    }

    // Candidate 4: Polygons (Rectangle, Square, Triangle, Diamond)
    if (box.diag >= this.thresholds.minShapeDiagonal) {
      const polygonFit = this.fitPolygon(points, box, closureGapRatio);
      if (polygonFit) candidates.push(polygonFit);
    }

    if (candidates.length === 0) return null;

    // Pick candidate with highest confidence
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates[0];
  }

  /**
   * Fits a straight line or underline per Part C3
   */
  fitLine(points: Point[], pathLength: number, box: { width: number; height: number; diag: number }, stageWidth: number): FitResult | null {
    const start = points[0];
    const end = points[points.length - 1];
    const directLen = Math.hypot(end.x - start.x, end.y - start.y);
    if (directLen === 0) return null;

    const minLen = Math.max(this.thresholds.lineMinLength, stageWidth * this.thresholds.lineMinStageWidthRatio);
    if (directLen < minLen) return null;

    // Calculate lateral deviations from chord
    let sumSqDev = 0;
    let maxDev = 0;
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    for (const p of points) {
      const dev = perpendicularDistance(p, start, end);
      sumSqDev += dev * dev;
      if (dev > maxDev) maxDev = dev;
    }

    const rmsDev = Math.sqrt(sumSqDev / points.length);
    const rmsRatio = rmsDev / directLen;
    const maxDevRatio = maxDev / directLen;

    const isFlat = (box.width / Math.max(1, box.height) >= 8) || (box.height / Math.max(1, box.width) >= 8);
    const accepted = isFlat
      ? rmsRatio <= this.thresholds.lineMaxRmsDeviationRatio
      : maxDevRatio <= this.thresholds.lineMaxDeviationRatio;

    if (!accepted) return null;

    // Angle snapping: check if within lineSnapAngleDeg of horizontal or vertical
    let angleRad = Math.atan2(dy, dx);
    let angleDeg = (angleRad * 180) / Math.PI;
    const absDeg = Math.abs(angleDeg);

    let snappedStart = { ...start };
    let snappedEnd = { ...end };
    const tol = this.thresholds.lineSnapAngleDeg;

    // Horizontal check: 0° or 180°
    if (absDeg <= tol || Math.abs(absDeg - 180) <= tol) {
      const avgY = (start.y + end.y) / 2;
      snappedStart.y = avgY;
      snappedEnd.y = avgY;
    }
    // Vertical check: 90°
    else if (Math.abs(absDeg - 90) <= tol) {
      const avgX = (start.x + end.x) / 2;
      snappedStart.x = avgX;
      snappedEnd.x = avgX;
    }

    const confidence = Math.max(0.65, 1.0 - rmsRatio * 5);

    return {
      shapeType: 'line',
      confidence,
      startPoint: snappedStart,
      endPoint: snappedEnd
    };
  }

  /**
   * Fits an arrow if stroke has a shaft and a barbed tip at the end
   */
  fitArrow(points: Point[], pathLength: number, box: { diag: number }): FitResult | null {
    if (points.length < 8 || box.diag < 40) return null;

    const start = points[0];
    // Find point furthest from start - that's the arrow head
    let maxDist = 0;
    let headIdx = 0;
    for (let i = 0; i < points.length; i++) {
      const d = Math.hypot(points[i].x - start.x, points[i].y - start.y);
      if (d > maxDist) {
        maxDist = d;
        headIdx = i;
      }
    }

    if (maxDist < 30) return null;
    const headPt = points[headIdx];
    const shaftAngle = Math.atan2(headPt.y - start.y, headPt.x - start.x);

    // Tip reversal check: look for sharp turn back towards the shaft
    let tipReverses = false;
    const searchStart = Math.min(headIdx, Math.floor(points.length * 0.6));
    for (let i = searchStart + 1; i < points.length; i++) {
      const segAngle = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
      let diff = Math.abs(segAngle - shaftAngle);
      while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);
      if (diff > (95 * Math.PI) / 180 && diff < (178 * Math.PI) / 180) {
        tipReverses = true;
        break;
      }
    }

    if (!tipReverses) return null;

    return {
      shapeType: 'arrow',
      confidence: 0.88,
      startPoint: start,
      endPoint: headPt
    };
  }

  /**
   * Fits a Circle or Ellipse
   */
  fitCircleOrEllipse(points: Point[], box: { x: number; y: number; width: number; height: number; diag: number }): FitResult | null {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const rx = box.width / 2;
    const ry = box.height / 2;
    const avgR = (rx + ry) / 2;

    let residualSum = 0;
    for (const p of points) {
      // Distance from center
      const d = Math.hypot(p.x - cx, p.y - cy);
      residualSum += Math.abs(d - avgR);
    }

    const avgResidual = residualSum / points.length;
    const residualRatio = avgResidual / box.diag;

    if (residualRatio > this.thresholds.maxCircleResidualRatio) {
      return null;
    }

    const aspect = box.width / Math.max(1, box.height);
    const isCircle = aspect >= 0.85 && aspect <= 1.15;
    const shapeType: ExtendedShapeType = isCircle ? 'circle' : 'ellipse';

    const confidence = Math.max(0.6, 1.0 - residualRatio * 7);

    return {
      shapeType,
      confidence,
      startPoint: { x: box.x, y: box.y },
      endPoint: { x: box.x + box.width, y: box.y + box.height },
      box: { x: box.x, y: box.y, width: box.width, height: box.height }
    };
  }

  /**
   * Fits Polygons (Rectangle, Square, Triangle, Diamond) via RDP Corner Detection
   */
  fitPolygon(
    points: Point[],
    box: { x: number; y: number; width: number; height: number; diag: number },
    closureGapRatio: number
  ): FitResult | null {
    const epsilon = box.diag * this.thresholds.rdpEpsilonRatio;
    const rawCorners = rdpSimplify(points, epsilon);
    const mergeDist = box.diag * this.thresholds.cornerMergeRatio;
    const corners = mergeCorners(rawCorners, mergeDist);

    const cornerCount = corners.length;

    // Check for Quadrilateral (Rectangle / Square / Diamond)
    if (cornerCount >= 4 && cornerCount <= 6 && closureGapRatio <= this.thresholds.maxClosureGapRatio) {
      const aspect = box.width / Math.max(1, box.height);
      const isSquare = aspect >= this.thresholds.squareAspectMin && aspect <= this.thresholds.squareAspectMax;

      // Check corner angles
      let isUprightRect = true;
      let isDiamond = false;

      // Check if corners sit near middle of edges (diamond test)
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      let cornersNearAxes = 0;
      for (const c of corners) {
        if (Math.abs(c.x - cx) < box.width * 0.15 || Math.abs(c.y - cy) < box.height * 0.15) {
          cornersNearAxes++;
        }
      }
      if (cornersNearAxes >= 3) {
        isDiamond = true;
      }

      if (isDiamond) {
        return {
          shapeType: 'diamond',
          confidence: 0.70,
          startPoint: { x: box.x, y: box.y },
          endPoint: { x: box.x + box.width, y: box.y + box.height },
          box
        };
      }

      return {
        shapeType: isSquare ? 'square' : 'rect',
        confidence: isSquare ? 0.88 : 0.85,
        startPoint: { x: box.x, y: box.y },
        endPoint: { x: box.x + box.width, y: box.y + box.height },
        box
      };
    }

    // Check for Triangle (3 corners ± 1 extra within merge distance)
    if ((cornerCount === 3 || cornerCount === 4) && closureGapRatio <= this.thresholds.maxClosureGapRatio) {
      // Pick top 3 most prominent corners
      const triCorners = corners.slice(0, 3);
      return {
        shapeType: 'triangle',
        confidence: 0.84,
        startPoint: { x: box.x, y: box.y },
        endPoint: { x: box.x + box.width, y: box.y + box.height },
        extraPoints: triCorners,
        box
      };
    }

    return null;
  }
}

export const shapeFitter = new ShapeFitter();
