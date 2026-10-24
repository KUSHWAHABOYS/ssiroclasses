// INKFIX: Word-Level Grouping & Sentence Continuation (Part F)
import { Stroke } from '../draw/annotationStore';

export interface WordCluster {
  id: string;
  strokes: Stroke[];
  box: { x: number; y: number; width: number; height: number };
  baselineY: number;
  glyphHeight: number;
  isCompleteWord: boolean;
}

export class WordGrouper {
  /**
   * Groups pending handwriting strokes into WordClusters per Part F:
   * Gap threshold = 0.35 * average glyph height on the same baseline.
   */
  groupStrokesIntoWords(strokes: Stroke[]): WordCluster[] {
    if (strokes.length === 0) return [];

    // Step 1: Baseline / Line clustering
    const lineBuckets = this.clusterByLines(strokes);
    const clusters: WordCluster[] = [];

    for (const lineStrokes of lineBuckets) {
      if (lineStrokes.length === 0) continue;

      // Sort strokes from left to right
      lineStrokes.sort((a, b) => this.getMinX(a) - this.getMinX(b));

      // Calculate average stroke height on this line
      const heights = lineStrokes.map((s) => this.getHeight(s));
      const avgHeight = Math.max(24, heights.reduce((a, b) => a + b, 0) / heights.length);
      const gapThreshold = 0.35 * avgHeight;

      let currentGroup: Stroke[] = [lineStrokes[0]];
      let groupMinX = this.getBox(lineStrokes[0]).x;
      let groupMaxX = groupMinX + this.getBox(lineStrokes[0]).width;

      for (let i = 1; i < lineStrokes.length; i++) {
        const currStroke = lineStrokes[i];
        const currBox = this.getBox(currStroke);

        const overlapsHorizontally = currBox.x <= groupMaxX;
        const gap = currBox.x - groupMaxX;

        // Check if merged into same word
        if (overlapsHorizontally || gap <= gapThreshold) {
          currentGroup.push(currStroke);
          groupMinX = Math.min(groupMinX, currBox.x);
          groupMaxX = Math.max(groupMaxX, currBox.x + currBox.width);
        } else {
          // Completed a word cluster
          clusters.push(this.buildCluster(currentGroup, avgHeight));
          currentGroup = [currStroke];
          groupMinX = currBox.x;
          groupMaxX = currBox.x + currBox.width;
        }
      }

      if (currentGroup.length > 0) {
        clusters.push(this.buildCluster(currentGroup, avgHeight));
      }
    }

    return clusters;
  }

  /**
   * Clusters strokes into horizontal lines based on Y overlap
   */
  private clusterByLines(strokes: Stroke[]): Stroke[][] {
    const lines: { minY: number; maxY: number; strokes: Stroke[] }[] = [];

    for (const s of strokes) {
      const box = this.getBox(s);
      let matched = false;

      for (const line of lines) {
        // Two strokes belong to the same line if they overlap vertically or within line tolerance
        const vOverlap = Math.min(box.y + box.height, line.maxY) - Math.max(box.y, line.minY);
        const lineH = Math.max(36, line.maxY - line.minY, box.height);

        if (vOverlap > -lineH * 0.5) {
          line.strokes.push(s);
          line.minY = Math.min(line.minY, box.y);
          line.maxY = Math.max(line.maxY, box.y + box.height);
          matched = true;
          break;
        }
      }

      if (!matched) {
        lines.push({
          minY: box.y,
          maxY: box.y + box.height,
          strokes: [s]
        });
      }
    }

    // Sort lines from top to bottom
    lines.sort((a, b) => a.minY - b.minY);
    return lines.map((l) => l.strokes);
  }

  private buildCluster(strokes: Stroke[], avgHeight: number): WordCluster {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of strokes) {
      for (const p of s.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const baselineY = minY + height * 0.85;

    // Check if lone stroke or isolated single matra
    const isSingleStroke = strokes.length === 1;
    const isTiny = width < avgHeight * 0.4 && height < avgHeight * 0.6;
    const isCompleteWord = !(isSingleStroke && isTiny);

    return {
      id: `word-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      strokes,
      box: { x: minX, y: minY, width, height },
      baselineY,
      glyphHeight: avgHeight,
      isCompleteWord
    };
  }

  private getMinX(s: Stroke): number {
    let min = Infinity;
    for (const p of s.points) if (p.x < min) min = p.x;
    return min;
  }

  private getHeight(s: Stroke): number {
    let min = Infinity, max = -Infinity;
    for (const p of s.points) {
      if (p.y < min) min = p.y;
      if (p.y > max) max = p.y;
    }
    return Math.max(1, max - min);
  }

  private getBox(s: Stroke): { x: number; y: number; width: number; height: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }
}

export const wordGrouper = new WordGrouper();
