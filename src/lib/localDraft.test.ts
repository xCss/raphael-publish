import { describe, expect, test } from 'vitest';
import {
    DEFAULT_PREFERENCES,
    loadMarkdownDraft,
    loadPreferences,
    MARKDOWN_DRAFT_STORAGE_KEY,
    normalizePreferences,
    PREFERENCES_STORAGE_KEY,
    saveMarkdownDraft,
    savePreferences
} from './localDraft';

describe('local draft persistence', () => {
    test('loads fallback content when no draft exists', () => {
        localStorage.clear();

        expect(loadMarkdownDraft(localStorage, 'fallback')).toBe('fallback');
    });

    test('saves and restores markdown draft text', () => {
        localStorage.clear();

        expect(saveMarkdownDraft(localStorage, '# 草稿')).toBe(true);
        expect(localStorage.getItem(MARKDOWN_DRAFT_STORAGE_KEY)).toBe('# 草稿');
        expect(loadMarkdownDraft(localStorage, 'fallback')).toBe('# 草稿');
    });

    test('normalizes incomplete or invalid preferences', () => {
        expect(
            normalizePreferences({
                themeMode: 'dark',
                activeTheme: '',
                previewDevice: 'watch',
                scrollSyncEnabled: false
            })
        ).toEqual({
            ...DEFAULT_PREFERENCES,
            themeMode: 'dark',
            scrollSyncEnabled: false
        });
    });

    test('saves and restores preferences', () => {
        localStorage.clear();
        const preferences = {
            themeMode: 'dark' as const,
            activeTheme: 'github',
            previewDevice: 'mobile' as const,
            scrollSyncEnabled: false
        };

        expect(savePreferences(localStorage, preferences)).toBe(true);
        expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBe(JSON.stringify(preferences));
        expect(loadPreferences(localStorage)).toEqual(preferences);
    });

    test('falls back when stored preferences are malformed JSON', () => {
        localStorage.clear();
        localStorage.setItem(PREFERENCES_STORAGE_KEY, '{bad json');

        expect(loadPreferences(localStorage)).toEqual(DEFAULT_PREFERENCES);
    });
});
