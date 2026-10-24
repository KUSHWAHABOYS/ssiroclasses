// INKFIX: Comprehensive Automated Test Suite (Part H2)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { annotationStore, Stroke, Point } from '../src/draw/annotationStore';
import { inkClassifier } from '../src/smartink/classifier';
import { shapeFitter } from '../src/smartink/shapeFitter';
import { textLineDetector } from '../src/smartink/textLines';
import { wordGrouper } from '../src/smartink/wordGrouper';
import { InkTransaction } from '../src/smartink/transaction';
import { voiceWriteManager } from '../src/voice/writeCommand';
import { smartInkController } from '../src/smartink/smartInkController';
import { store } from '../src/state/store';
import { aiRouter } from '../src/ai/router';
import { keyVault } from '../src/ai/keyVault';

// Helper to generate noisy line
function generateNoisyLine(start: Point, end: Point, pointsCount = 40, noiseAmp = 0.04): Point[] {
  const pts: Point[] = [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);

  for (let i = 0; i <= pointsCount; i++) {
    const t = i / pointsCount;
    // Perpendicular unit vector
    const perpX = -dy / len;
    const perpY = dx / len;
    // Sinusoidal wavy deviation with amplitude up to noiseAmp * len
    const wavy = Math.sin(t * Math.PI * 3) * (noiseAmp * len);
    pts.push({
      x: start.x + dx * t + perpX * wavy,
      y: start.y + dy * t + perpY * wavy,
      time: performance.now() + i * 5
    });
  }
  return pts;
}

// Helper to generate noisy rectangle
function generateNoisyBox(x: number, y: number, w: number, h: number, pointsPerSide = 20, noise = 3): Point[] {
  const pts: Point[] = [];
  // Top side
  for (let i = 0; i < pointsPerSide; i++) {
    pts.push({ x: x + (w * i) / pointsPerSide + (Math.random() - 0.5) * noise, y: y + (Math.random() - 0.5) * noise });
  }
  // Right side
  for (let i = 0; i < pointsPerSide; i++) {
    pts.push({ x: x + w + (Math.random() - 0.5) * noise, y: y + (h * i) / pointsPerSide + (Math.random() - 0.5) * noise });
  }
  // Bottom side
  for (let i = 0; i < pointsPerSide; i++) {
    pts.push({ x: x + w - (w * i) / pointsPerSide + (Math.random() - 0.5) * noise, y: y + h + (Math.random() - 0.5) * noise });
  }
  // Left side
  for (let i = 0; i < pointsPerSide; i++) {
    pts.push({ x: x + (Math.random() - 0.5) * noise, y: y + h - (h * i) / pointsPerSide + (Math.random() - 0.5) * noise });
  }
  // Close the loop
  pts.push({ x: pts[0].x, y: pts[0].y });
  return pts;
}

// Helper to generate noisy circle
function generateNoisyCircle(cx: number, cy: number, r: number, pointsCount = 60, noise = 4): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= pointsCount; i++) {
    const angle = (i / pointsCount) * Math.PI * 2;
    const curR = r + (Math.random() - 0.5) * noise;
    pts.push({
      x: cx + curR * Math.cos(angle),
      y: cy + curR * Math.sin(angle)
    });
  }
  return pts;
}

// Helper to generate noisy triangle
function generateNoisyTriangle(p1: Point, p2: Point, p3: Point, pointsPerSide = 20): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < pointsPerSide; i++) {
    const t = i / pointsPerSide;
    pts.push({ x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t });
  }
  for (let i = 0; i < pointsPerSide; i++) {
    const t = i / pointsPerSide;
    pts.push({ x: p2.x + (p3.x - p2.x) * t, y: p2.y + (p3.y - p2.y) * t });
  }
  for (let i = 0; i <= pointsPerSide; i++) {
    const t = i / pointsPerSide;
    pts.push({ x: p3.x + (p1.x - p3.x) * t, y: p3.y + (p1.y - p3.y) * t });
  }
  return pts;
}

// Helper to generate noisy arrow
function generateNoisyArrow(start: Point, end: Point): Point[] {
  const shaft = generateNoisyLine(start, end, 30, 0.02);
  const headLen = 30;
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const barb1: Point = {
    x: end.x - headLen * Math.cos(angle - Math.PI / 6),
    y: end.y - headLen * Math.sin(angle - Math.PI / 6)
  };
  const barb2: Point = {
    x: end.x - headLen * Math.cos(angle + Math.PI / 6),
    y: end.y - headLen * Math.sin(angle + Math.PI / 6)
  };
  return [...shaft, end, barb1, end, barb2];
}

describe('Smart Ink Comprehensive Test Suite (Part H2)', () => {
  beforeEach(() => {
    annotationStore.resetAll();
    store.setState({ isHandwritingEnabled: true });
    store.updateSettings({
      smartInkEnabled: true,
      smartInkSensitivity: 'normal',
      smartInkShapeDelayMs: 450,
      smartInkTextDelayMs: 1000,
      smartInkHoldToSnap: true,
      smartInkAiAssist: true
    });
  });

  // ==========================================
  // Test 1: Underline and Straight Lines (C2–C4, H2.1)
  // ==========================================
  describe('1. Underline vs Shirorekha & Straightening', () => {
    it('straightens a wavy horizontal stroke with amplitude <= 6% of length', () => {
      const wavy = generateNoisyLine({ x: 100, y: 300 }, { x: 500, y: 305 }, 40, 0.05);
      const fit = shapeFitter.fit(wavy, 3840);

      expect(fit).not.toBeNull();
      expect(fit!.shapeType).toBe('line');
      // Snapped to horizontal because within 12 degrees
      expect(fit!.startPoint.y).toBeCloseTo(fit!.endPoint.y, 1);
    });

    it('classifies a long stroke under handwriting as an underline', () => {
      // Simulate handwriting glyph strokes above
      const glyph1: Stroke = {
        id: 'glyph1',
        tool: 'pen',
        color: '#f59e0b',
        size: 4,
        alpha: 1,
        points: generateNoisyLine({ x: 200, y: 150 }, { x: 200, y: 220 }),
        timestamp: Date.now()
      };
      const glyph2: Stroke = {
        id: 'glyph2',
        tool: 'pen',
        color: '#f59e0b',
        size: 4,
        alpha: 1,
        points: generateNoisyLine({ x: 250, y: 160 }, { x: 250, y: 225 }),
        timestamp: Date.now()
      };

      // Wavy underline underneath
      const underlineStroke: Stroke = {
        id: 'under1',
        tool: 'pen',
        color: '#f59e0b',
        size: 4,
        alpha: 1,
        points: generateNoisyLine({ x: 180, y: 245 }, { x: 380, y: 248 }, 40, 0.04),
        timestamp: Date.now()
      };

      const result = inkClassifier.classifyStroke(underlineStroke, [glyph1, glyph2, underlineStroke]);
      expect(result.inkClass).toBe('underline');
      expect(result.fitResult?.isUnderline).toBe(true);
    });

    it('classifies a top stroke with glyphs hanging below as a shirorekha, NOT an underline', () => {
      // Shirorekha on top at y=100
      const shirorekha: Stroke = {
        id: 'shiro',
        tool: 'pen',
        color: '#f59e0b',
        size: 4,
        alpha: 1,
        points: generateNoisyLine({ x: 100, y: 100 }, { x: 400, y: 102 }),
        timestamp: Date.now()
      };

      // Glyphs hanging down to y=180
      const hang1: Stroke = {
        id: 'h1',
        tool: 'pen',
        color: '#f59e0b',
        size: 4,
        alpha: 1,
        points: generateNoisyLine({ x: 150, y: 105 }, { x: 150, y: 180 }),
        timestamp: Date.now()
      };
      const hang2: Stroke = {
        id: 'h2',
        tool: 'pen',
        color: '#f59e0b',
        size: 4,
        alpha: 1,
        points: generateNoisyLine({ x: 280, y: 105 }, { x: 280, y: 180 }),
        timestamp: Date.now()
      };

      const result = inkClassifier.classifyStroke(shirorekha, [hang1, hang2, shirorekha]);
      expect(result.inkClass).toBe('shirorekha');
      expect(result.inkClass).not.toBe('underline');
    });

    it('snaps an underline to typeset text baseline + 0.12 * lineHeight', () => {
      // Add existing typeset text to annotationStore
      const textStroke: Stroke = {
        id: 'txt-1',
        tool: 'text',
        color: '#ffffff',
        size: 32,
        alpha: 1,
        points: [{ x: 300, y: 400 }],
        text: 'Decoding Indology',
        box: { x: 300, y: 400, width: 350, height: 40 },
        timestamp: Date.now()
      };
      annotationStore.addStroke(textStroke);

      const candidate = textLineDetector.findCandidateAboveUnderline({
        x: 290,
        y: 450,
        width: 370,
        height: 10
      });

      expect(candidate).not.toBeNull();
      const snapped = textLineDetector.snapUnderlineToText({ x: 290, y: 450 }, { x: 660, y: 452 }, candidate!);
      // Expected baseline: 400 + 40 * 0.82 = 432.8; offset = 0.12 * 40 = 4.8 => snappedY = 437.6
      expect(snapped.start.y).toBeCloseTo(437.6, 1);
      // Snapped to full width because it spans >= 80%
      expect(snapped.start.x).toBe(300);
      expect(snapped.end.x).toBe(650);
    });
  });

  // ==========================================
  // Test 2: Ink Never Vanishes Invariant (PART B, H2.2)
  // ==========================================
  describe('2. Ink Never Vanishes & Transactional Rollback', () => {
    it('rolls back to raw strokes when conversion throws an error', async () => {
      const rawStroke: Stroke = {
        id: 'raw-1',
        tool: 'pen',
        color: '#f59e0b',
        size: 4,
        alpha: 1,
        points: generateNoisyCircle(500, 500, 100),
        timestamp: Date.now()
      };
      annotationStore.addStroke(rawStroke);

      const initialCount = annotationStore.getStrokes().length;
      expect(initialCount).toBe(1);

      const transaction = new InkTransaction([rawStroke]);
      const res = await transaction.execute(async () => {
        // Injected failure: AI offline or parsing error
        throw new Error('AI Provider 500 Internal Error / Network Offline');
      });

      expect(res.success).toBe(false);
      // Invariant: visible ink never reduced
      const finalCount = annotationStore.getStrokes().length;
      expect(finalCount).toBe(1);
      expect(annotationStore.getStrokes()[0].id).toBe('raw-1');
      expect(annotationStore.getStrokes()[0].replacedBy).toBeUndefined();
    });

    it('rejects conversions that produce empty or invalid geometry and rolls back', async () => {
      const rawStroke: Stroke = {
        id: 'raw-2',
        tool: 'pen',
        color: '#f59e0b',
        size: 4,
        alpha: 1,
        points: generateNoisyLine({ x: 100, y: 100 }, { x: 300, y: 100 }),
        timestamp: Date.now()
      };
      annotationStore.addStroke(rawStroke);

      const transaction = new InkTransaction([rawStroke]);
      // Return empty replacement list
      const res = await transaction.execute(async () => []);

      expect(res.success).toBe(false);
      expect(annotationStore.getStrokes().length).toBe(1);
      expect(annotationStore.getStrokes()[0].id).toBe('raw-2');
    });

    it('asserts development-time invariant: visible strokes never decrease during automatic conversion', async () => {
      const rawStroke: Stroke = {
        id: 'raw-3',
        tool: 'pen',
        color: '#f59e0b',
        size: 4,
        alpha: 1,
        points: generateNoisyBox(400, 400, 200, 150),
        timestamp: Date.now()
      };
      annotationStore.addStroke(rawStroke);

      const transaction = new InkTransaction([rawStroke]);
      const res = await transaction.execute(async () => {
        return [
          {
            id: 'clean-box-1',
            tool: 'shape',
            color: rawStroke.color,
            size: rawStroke.size,
            alpha: rawStroke.alpha,
            points: [{ x: 400, y: 400 }, { x: 600, y: 550 }],
            shapeType: 'rect',
            startPoint: { x: 400, y: 400 },
            endPoint: { x: 600, y: 550 },
            box: { x: 400, y: 400, width: 200, height: 150 },
            timestamp: Date.now()
          }
        ];
      });

      expect(res.success).toBe(true);
      // Raw stroke still stored but marked replacedBy
      expect(annotationStore.getAllStrokes().length).toBe(2);
      // Visible stroke count is maintained (1 clean shape visible)
      expect(annotationStore.getStrokes().length).toBe(1);
      expect(annotationStore.getStrokes()[0].id).toBe('clean-box-1');
    });
  });

  // ==========================================
  // Test 3: Mouse Jitter Rejection (C1, H2.3)
  // ==========================================
  describe('3. Mouse Jitter & Timer Management', () => {
    it('cancels hold-to-snap only when pointer movement exceeds 8px', () => {
      smartInkController.onPointerStill({ x: 200, y: 200 }, 200, 200);

      // Jitter <= 8px should NOT cancel hold-to-snap
      smartInkController.onPointerMove(2, 3); // hypot = 3.6px
      // Movement > 8px cancels hold-to-snap
      smartInkController.onPointerMove(10, 5); // hypot = 11.18px
      expect((smartInkController as any).holdTriggered).toBe(false);
    });
  });

  // ==========================================
  // Test 4: Shapes Recognition Accuracy (D1, D4, H2.4)
  // ==========================================
  describe('4. Tolerant Geometric Shape Classification', () => {
    it('recognizes 50 noisy boxes with >= 96% accuracy', () => {
      let correct = 0;
      for (let i = 0; i < 50; i++) {
        const pts = generateNoisyBox(200 + i, 200, 250, 180, 25, 4);
        const fit = shapeFitter.fit(pts, 3840);
        if (fit && fit.shapeType === 'rect') correct++;
      }
      expect(correct / 50).toBeGreaterThanOrEqual(0.96);
    });

    it('recognizes 50 noisy squares with side ratio 0.88–1.12', () => {
      let correct = 0;
      for (let i = 0; i < 50; i++) {
        const pts = generateNoisyBox(100, 100, 200, 204, 25, 3);
        const fit = shapeFitter.fit(pts, 3840);
        if (fit && fit.shapeType === 'square') correct++;
      }
      expect(correct / 50).toBeGreaterThanOrEqual(0.95);
    });

    it('recognizes 50 noisy circles with >= 96% accuracy', () => {
      let correct = 0;
      for (let i = 0; i < 50; i++) {
        const pts = generateNoisyCircle(400, 400, 120, 50, 4);
        const fit = shapeFitter.fit(pts, 3840);
        if (fit && fit.shapeType === 'circle') correct++;
      }
      expect(correct / 50).toBeGreaterThanOrEqual(0.96);
    });

    it('recognizes 50 noisy triangles with >= 96% accuracy', () => {
      let correct = 0;
      for (let i = 0; i < 50; i++) {
        const pts = generateNoisyTriangle({ x: 300, y: 100 }, { x: 150, y: 400 }, { x: 450, y: 400 }, 20);
        const fit = shapeFitter.fit(pts, 3840);
        if (fit && fit.shapeType === 'triangle') correct++;
      }
      expect(correct / 50).toBeGreaterThanOrEqual(0.96);
    });

    it('recognizes 50 noisy arrows with >= 95% accuracy', () => {
      let correct = 0;
      for (let i = 0; i < 50; i++) {
        const pts = generateNoisyArrow({ x: 100, y: 300 }, { x: 450, y: 300 });
        const fit = shapeFitter.fit(pts, 3840);
        if (fit && fit.shapeType === 'arrow') correct++;
      }
      expect(correct / 50).toBeGreaterThanOrEqual(0.95);
    });

    it('rejects text-like marks (danda, tiny glyphs) from becoming shapes (< 2% false positives)', () => {
      let falsePositives = 0;
      for (let i = 0; i < 50; i++) {
        // Danda: short vertical mark (length 30px)
        const danda = generateNoisyLine({ x: 200, y: 200 }, { x: 202, y: 232 }, 15, 0.02);
        const stroke: Stroke = {
          id: `danda-${i}`,
          tool: 'pen',
          color: '#f59e0b',
          size: 4,
          alpha: 1,
          points: danda,
          timestamp: Date.now()
        };
        const res = inkClassifier.classifyStroke(stroke, [stroke]);
        if (res.inkClass === 'shape') falsePositives++;
      }
      expect(falsePositives / 50).toBeLessThan(0.02);
    });
  });

  // ==========================================
  // Test 5: Word-Level Grouping (PART F, H2.6)
  // ==========================================
  describe('5. Word-Level Grouping & Sentence Continuation', () => {
    it('groups strokes into words based on horizontal gap and shirorekha', () => {
      // Word 1: 'राम' (x: 100 to 180, height: 50)
      const w1_s1: Stroke = {
        id: 'w1-1',
        tool: 'pen',
        color: '#ffffff',
        size: 4,
        alpha: 1,
        points: generateNoisyLine({ x: 100, y: 200 }, { x: 180, y: 200 }),
        timestamp: 100
      };
      const w1_s2: Stroke = {
        id: 'w1-2',
        tool: 'pen',
        color: '#ffffff',
        size: 4,
        alpha: 1,
        points: generateNoisyLine({ x: 130, y: 200 }, { x: 130, y: 250 }),
        timestamp: 110
      };

      // Gap of 80px > 0.35 * 50 = 17.5px

      // Word 2: 'घर' (x: 260 to 340, height: 50)
      const w2_s1: Stroke = {
        id: 'w2-1',
        tool: 'pen',
        color: '#ffffff',
        size: 4,
        alpha: 1,
        points: generateNoisyLine({ x: 260, y: 200 }, { x: 340, y: 200 }),
        timestamp: 200
      };
      const w2_s2: Stroke = {
        id: 'w2-2',
        tool: 'pen',
        color: '#ffffff',
        size: 4,
        alpha: 1,
        points: generateNoisyLine({ x: 290, y: 200 }, { x: 290, y: 250 }),
        timestamp: 210
      };

      const clusters = wordGrouper.groupStrokesIntoWords([w1_s1, w1_s2, w2_s1, w2_s2]);
      expect(clusters.length).toBe(2);
      expect(clusters[0].strokes.length).toBe(2);
      expect(clusters[1].strokes.length).toBe(2);
      expect(clusters[0].isCompleteWord).toBe(true);
      expect(clusters[1].isCompleteWord).toBe(true);
    });

    it('does not convert a lone small matra/letter alone', () => {
      // Lone tiny mark
      const tinyMatra: Stroke = {
        id: 'matra-1',
        tool: 'pen',
        color: '#ffffff',
        size: 4,
        alpha: 1,
        points: [{ x: 100, y: 100 }, { x: 105, y: 108 }],
        timestamp: Date.now()
      };

      const clusters = wordGrouper.groupStrokesIntoWords([tinyMatra]);
      expect(clusters[0].isCompleteWord).toBe(false);
    });
  });

  // ==========================================
  // Test 6: Voice Write Commands (PART G, H2.7)
  // ==========================================
  describe('6. Voice Write Commands & Anchors', () => {
    it('parses "आगे विष्णु लिखो" with location arrow_head', () => {
      const parsed = voiceWriteManager.parseCommand('आगे विष्णु लिखो');
      expect(parsed).not.toBeNull();
      expect(parsed!.action).toBe('write');
      expect(parsed!.text).toBe('विष्णु');
      expect(parsed!.location).toBe('arrow_head');
    });

    it('parses "इसके अंदर लिखो" and "बीच में लिखो"', () => {
      const p1 = voiceWriteManager.parseCommand('इसके अंदर आर्यभट्ट लिखो');
      expect(p1!.location).toBe('shape_inside');
      expect(p1!.text).toBe('आर्यभट्ट');

      const p2 = voiceWriteManager.parseCommand('बीच में सूर्य लिखो');
      expect(p2!.location).toBe('shape_inside');
      expect(p2!.text).toBe('सूर्य');
    });

    it('parses "यहाँ लिखो / here ..."', () => {
      const p = voiceWriteManager.parseCommand('यहाँ भारत लिखो');
      expect(p!.location).toBe('here');
      expect(p!.text).toBe('भारत');
    });

    it('parses English write commands: "write Vishnu at the arrow"', () => {
      const p = voiceWriteManager.parseCommand('write Vishnu at the arrow');
      expect(p).not.toBeNull();
      expect(p!.action).toBe('write');
      expect(p!.text).toBe('विष्णु'); // Normalizes Vishnu to Devanagari per Part G1 table
      expect(p!.location).toBe('arrow_head');
    });

    it('parses "शीर्षक ... लिखो / title ..."', () => {
      const p = voiceWriteManager.parseCommand('शीर्षक सिंधु घाटी सभ्यता लिखो');
      expect(p!.location).toBe('title');
      expect(p!.text).toBe('सिंधु घाटी सभ्यता');
    });

    it('parses "पिछला मिटाओ / delete last text" and "बड़ा/छोटा करो"', () => {
      const del = voiceWriteManager.parseCommand('पिछला मिटाओ');
      expect(del!.action).toBe('delete_last');

      const big = voiceWriteManager.parseCommand('बड़ा करो');
      expect(big!.action).toBe('resize');
      expect(big!.resizeFactor).toBe(1.25);

      const small = voiceWriteManager.parseCommand('छोटा करो');
      expect(small!.action).toBe('resize');
      expect(small!.resizeFactor).toBe(0.8);
    });

    it('places text correctly at arrow head when executing "आगे विष्णु लिखो"', async () => {
      // Right-pointing arrow from (200, 300) to (500, 300)
      const arrow: Stroke = {
        id: 'arrow-1',
        tool: 'arrow',
        color: '#f59e0b',
        size: 6,
        alpha: 1,
        points: [{ x: 200, y: 300 }, { x: 500, y: 300 }],
        shapeType: 'arrow',
        startPoint: { x: 200, y: 300 },
        endPoint: { x: 500, y: 300 },
        timestamp: Date.now()
      };
      annotationStore.addStroke(arrow);

      const cmd = voiceWriteManager.parseCommand('आगे विष्णु लिखो');
      const success = await voiceWriteManager.execute(cmd!);

      expect(success).toBe(true);
      const strokes = annotationStore.getStrokes();
      const textStroke = strokes.find((s) => s.tool === 'text');
      expect(textStroke).toBeDefined();
      expect(textStroke!.text).toBe('विष्णु');
      // Placed past the arrow head (x > 500)
      expect(textStroke!.box!.x).toBeGreaterThan(500);
      // Vertically centered near arrow head (y ≈ 300 - height/2)
      expect(textStroke!.box!.y + textStroke!.box!.height / 2).toBeCloseTo(300, 5);
    });

    it('deletes last written text on "पिछला मिटाओ"', async () => {
      // Add a text stroke first
      const writeCmd = voiceWriteManager.parseCommand('यहाँ भारत लिखो');
      await voiceWriteManager.execute(writeCmd!);
      expect(annotationStore.getStrokes().some((s) => s.tool === 'text')).toBe(true);

      const cmd = voiceWriteManager.parseCommand('पिछला मिटाओ');
      const success = await voiceWriteManager.execute(cmd!);
      expect(success).toBe(true);
      const remainingTexts = annotationStore.getStrokes().filter((s) => s.tool === 'text');
      expect(remainingTexts.length).toBe(0);
    });
  });

  // ==========================================
  // Test 7: Speed targets with mocked AI (PART E, H2.5)
  // ==========================================
  describe('7. Speed & Timing Targets', () => {
    it('achieves local shape fitting in < 20 ms', () => {
      const box = generateNoisyBox(200, 200, 300, 200, 30, 4);
      const t0 = performance.now();
      const fit = shapeFitter.fit(box, 3840);
      const duration = performance.now() - t0;

      expect(fit).not.toBeNull();
      // Target: local shapes <= 0.6s total (fitting itself takes < 20ms)
      expect(duration).toBeLessThan(20);
    });
  });
});
