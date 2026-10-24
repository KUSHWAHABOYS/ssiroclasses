// INKFIX: Shape and Line Fitting Thresholds & Sensitivity Profiles
export type SensitivityLevel = 'strict' | 'normal' | 'forgiving';

export interface ShapeThresholds {
  maxClosureGapRatio: number; // Fraction of perimeter for closed shapes
  maxCircleResidualRatio: number; // Max residual deviation vs bounding diagonal
  maxEllipseResidualRatio: number;
  rectAngleToleranceDeg: number; // 90° ± tolerance
  squareAspectMin: number; // Side ratio min for square
  squareAspectMax: number; // Side ratio max for square
  rdpEpsilonRatio: number; // RDP epsilon as fraction of diagonal
  cornerMergeRatio: number; // Merge corners closer than this fraction of diagonal
  lineMaxRmsDeviationRatio: number; // Max RMS lateral deviation vs length for flat aspect (>=8:1)
  lineMaxDeviationRatio: number; // Max absolute deviation vs length otherwise
  lineMinLength: number; // Min length in px
  lineMinStageWidthRatio: number; // Min length as ratio of stage width
  lineSnapAngleDeg: number; // Snap to 0°/90°/180°/270° within this angle
  minShapeDiagonal: number; // Min diagonal to consider closed shape
  maxCenterDriftRatio: number; // Result center must not move more than this fraction of diagonal
  arrowHeadAngleMinDeg: number;
  arrowHeadAngleMaxDeg: number;
  triangleAngleSumToleranceDeg: number;
}

const NORMAL_THRESHOLDS: ShapeThresholds = {
  maxClosureGapRatio: 0.25, // Up to 25% perimeter gap allowed
  maxCircleResidualRatio: 0.09, // <= 9% of bounding diagonal
  maxEllipseResidualRatio: 0.10,
  rectAngleToleranceDeg: 18, // 90° ± 18°
  squareAspectMin: 0.88,
  squareAspectMax: 1.12,
  rdpEpsilonRatio: 0.035, // 3.5% of diagonal
  cornerMergeRatio: 0.10, // Merge corners < 10% of diagonal
  lineMaxRmsDeviationRatio: 0.06, // RMS <= 6% of length
  lineMaxDeviationRatio: 0.08, // Max deviation <= 8% of length
  lineMinLength: 60,
  lineMinStageWidthRatio: 0.04,
  lineSnapAngleDeg: 12, // Snap to H/V within 12°
  minShapeDiagonal: 40,
  maxCenterDriftRatio: 0.20,
  arrowHeadAngleMinDeg: 15,
  arrowHeadAngleMaxDeg: 65,
  triangleAngleSumToleranceDeg: 25
};

export function getThresholds(level: SensitivityLevel = 'normal'): ShapeThresholds {
  if (level === 'strict') {
    return {
      ...NORMAL_THRESHOLDS,
      maxClosureGapRatio: NORMAL_THRESHOLDS.maxClosureGapRatio * 0.8,
      maxCircleResidualRatio: NORMAL_THRESHOLDS.maxCircleResidualRatio * 0.8,
      maxEllipseResidualRatio: NORMAL_THRESHOLDS.maxEllipseResidualRatio * 0.8,
      rectAngleToleranceDeg: NORMAL_THRESHOLDS.rectAngleToleranceDeg * 0.8,
      lineMaxRmsDeviationRatio: NORMAL_THRESHOLDS.lineMaxRmsDeviationRatio * 0.8,
      lineMaxDeviationRatio: NORMAL_THRESHOLDS.lineMaxDeviationRatio * 0.8,
      lineSnapAngleDeg: 10
    };
  }
  if (level === 'forgiving') {
    return {
      ...NORMAL_THRESHOLDS,
      maxClosureGapRatio: NORMAL_THRESHOLDS.maxClosureGapRatio * 1.25,
      maxCircleResidualRatio: NORMAL_THRESHOLDS.maxCircleResidualRatio * 1.25,
      maxEllipseResidualRatio: NORMAL_THRESHOLDS.maxEllipseResidualRatio * 1.25,
      rectAngleToleranceDeg: NORMAL_THRESHOLDS.rectAngleToleranceDeg * 1.25,
      lineMaxRmsDeviationRatio: NORMAL_THRESHOLDS.lineMaxRmsDeviationRatio * 1.25,
      lineMaxDeviationRatio: NORMAL_THRESHOLDS.lineMaxDeviationRatio * 1.25,
      lineSnapAngleDeg: 15
    };
  }
  return NORMAL_THRESHOLDS;
}
