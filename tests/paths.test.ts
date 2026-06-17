import { describe, expect, it } from 'vitest';
import { isHtmlPath, normalizeAssetPath } from '../src/paths.js';
import { setNested } from '../src/state-paths.js';

describe('normalizeAssetPath', () => {
  it('normalizes safe relative paths', () => {
    expect(normalizeAssetPath('/assets\\image.png')).toBe('assets/image.png');
    expect(normalizeAssetPath('nested/../styles.css')).toBe('styles.css');
  });

  it('rejects empty and traversal paths', () => {
    expect(() => normalizeAssetPath('')).toThrow();
    expect(() => normalizeAssetPath('../secret')).toThrow();
    expect(() => normalizeAssetPath('assets/../../secret')).toThrow();
  });
});

describe('isHtmlPath', () => {
  it('detects html files', () => {
    expect(isHtmlPath('index.html')).toBe(true);
    expect(isHtmlPath('page.HTM')).toBe(true);
    expect(isHtmlPath('styles.css')).toBe(false);
  });
});

describe('setNested', () => {
  it('sets object and array paths', () => {
    const state: Record<string, unknown> = {};
    setNested(state, 'pages.0.action', 'remove');
    setNested(state, 'pages[0].notes', 'Outdated');

    expect(state).toEqual({
      pages: [
        {
          action: 'remove',
          notes: 'Outdated'
        }
      ]
    });
  });
});
