import { BoardThemeId } from '../state/store';

export interface BoardThemeDef {
  id: BoardThemeId;
  name: string;
  nameHi: string;
  bgColor: string;
  isChroma: boolean;
  grid?: { size: number; alpha: number; color: string };
  texture?: 'chalk' | 'none';
  safePalette: string[];
}

export const BOARD_THEMES: Record<BoardThemeId, BoardThemeDef> = {
  slate: {
    id: 'slate',
    name: 'Classic Slate',
    nameHi: 'क्लासिक स्लेट',
    bgColor: '#111111',
    isChroma: false,
    texture: 'none',
    safePalette: ['#f59e0b', '#ffffff', '#38bdf8', '#10b981', '#ef4444', '#a855f7']
  },
  chalkboard: {
    id: 'chalkboard',
    name: 'Green Chalkboard',
    nameHi: 'हरा चाकबोर्ड',
    bgColor: '#2F4F3F',
    isChroma: false,
    texture: 'chalk',
    safePalette: ['#ffffff', '#fde047', '#fed7aa', '#f43f5e', '#38bdf8', '#d8b4fe']
  },
  chroma: {
    id: 'chroma',
    name: 'Pure Chroma Green',
    nameHi: 'स्टूडियो क्रोमा ग्रीन (#00FF00)',
    bgColor: '#00FF00', // Exact flat color per B8
    isChroma: true,
    texture: 'none',
    // Chroma-safe colours: white, yellow, red, magenta, cyan, black (green removed!)
    safePalette: ['#ffffff', '#fde047', '#ef4444', '#f43f5e', '#06b6d4', '#000000']
  },
  navy: {
    id: 'navy',
    name: 'Navy Blue',
    nameHi: 'नेवी ब्लू',
    bgColor: '#0B1F3A',
    isChroma: false,
    texture: 'none',
    safePalette: ['#ffffff', '#f59e0b', '#38bdf8', '#34d399', '#f87171', '#e879f9']
  },
  maths: {
    id: 'maths',
    name: 'Maths Grid',
    nameHi: 'गणित ग्रिड (40px)',
    bgColor: '#131823',
    isChroma: false,
    grid: { size: 40, alpha: 0.12, color: '#ffffff' },
    texture: 'none',
    safePalette: ['#f59e0b', '#ffffff', '#38bdf8', '#10b981', '#ef4444', '#a855f7']
  }
};
