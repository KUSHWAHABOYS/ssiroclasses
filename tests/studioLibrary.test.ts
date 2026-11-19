import { describe, it, expect } from 'vitest';
import { libraryStore } from '../src/library/libraryStore';
import { matchCommandFromDict } from '../src/voice/commandsDict';

describe('Studio Library (Local IndexedDB Storage)', () => {
  it('correctly detects file types for presentation, video, and image', () => {
    expect(libraryStore.detectType({ name: 'test.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' } as File)).toBe('presentation');
    expect(libraryStore.detectType({ name: 'chapter1.pdf', type: 'application/pdf' } as File)).toBe('presentation');
    expect(libraryStore.detectType({ name: 'lecture.mp4', type: 'video/mp4' } as File)).toBe('video');
    expect(libraryStore.detectType({ name: 'demo.webm', type: 'video/webm' } as File)).toBe('video');
    expect(libraryStore.detectType({ name: 'diagram.png', type: 'image/png' } as File)).toBe('image');
    expect(libraryStore.detectType({ name: 'photo.jpg', type: 'image/jpeg' } as File)).toBe('image');
  });

  it('formats bytes into readable MB and GB units', () => {
    expect(libraryStore.formatBytes(0)).toBe('0 B');
    expect(libraryStore.formatBytes(1024 * 1024 * 50)).toBe('50.0 MB');
    expect(libraryStore.formatBytes(1024 * 1024 * 1024 * 2.5)).toBe('2.50 GB');
  });

  it('matches Hindi and English voice commands for library', () => {
    const cmd1 = matchCommandFromDict('लाइब्रेरी');
    expect(cmd1).not.toBeNull();
    expect(cmd1?.action).toBe('library');

    const cmd2 = matchCommandFromDict('library');
    expect(cmd2).not.toBeNull();
    expect(cmd2?.action).toBe('library');

    const cmd3 = matchCommandFromDict('मेरी लाइब्रेरी खोलो');
    expect(cmd3).not.toBeNull();
    expect(cmd3?.action).toBe('library');
  });
});
