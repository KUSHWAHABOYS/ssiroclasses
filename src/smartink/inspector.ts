// INKFIX: Smart Ink Diagnostic Inspector (Ring Buffer of Last 20 Decisions)
export interface InspectionEntry {
  id: string;
  timestamp: number;
  timeFormatted: string;
  tool: string;
  strokeCount: number;
  features: Record<string, any>;
  classScores: Record<string, number>;
  branchTaken: string;
  aiCalled: boolean;
  aiTask?: string;
  latencyMs: number;
  result: 'converted' | 'left_as_drawn' | 'rolled_back';
  reason: string;
  details?: string;
}

class SmartInkInspector {
  private history: InspectionEntry[] = [];
  private readonly MAX_ENTRIES = 20;

  recordDecision(entry: Omit<InspectionEntry, 'id' | 'timestamp' | 'timeFormatted'>): void {
    const now = new Date();
    const timeFormatted = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const fullEntry: InspectionEntry = {
      ...entry,
      id: `ink-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      timeFormatted
    };

    this.history.unshift(fullEntry);
    if (this.history.length > this.MAX_ENTRIES) {
      this.history.pop();
    }
  }

  getHistory(): InspectionEntry[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  formatReport(): string {
    if (this.history.length === 0) {
      return 'स्मार्ट इंक रिकॉर्ड रिक्त है (No Smart Ink decisions recorded yet).';
    }

    return this.history
      .map((e, idx) => {
        return `[#${idx + 1} ${e.timeFormatted}] Tool: ${e.tool} | Strokes: ${e.strokeCount}
Branch: ${e.branchTaken} | Result: ${e.result.toUpperCase()} | Reason: ${e.reason}
AI Called: ${e.aiCalled ? `Yes (${e.aiTask}, ${e.latencyMs}ms)` : `No (${e.latencyMs}ms)`}
Features: ${JSON.stringify(e.features)}
Scores: ${JSON.stringify(e.classScores)}
${e.details ? `Details: ${e.details}` : ''}`;
      })
      .join('\n----------------------------------------\n');
  }
}

export const smartInkInspector = new SmartInkInspector();
