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

    test('does not persist non-restorable blob image references', () => {
        localStorage.clear();

        const draft = [
            '# 草稿',
            '',
            '![本地截图](blob:http://localhost/pasted-image)',
            '',
            '![远程图片](https://example.com/image.png)'
        ].join('\n');

        expect(saveMarkdownDraft(localStorage, draft)).toBe(true);
        expect(loadMarkdownDraft(localStorage, 'fallback')).toBe('# 草稿\n\n![远程图片](https://example.com/image.png)');
    });

    test('keeps durable local image references when saving drafts', () => {
        localStorage.clear();

        const draft = [
            '# 草稿',
            '',
            '![本地截图](raphael-image://draft/default/pasted-image-1)',
            '',
            '![临时截图](blob:http://localhost/pasted-image)'
        ].join('\n');

        expect(saveMarkdownDraft(localStorage, draft)).toBe(true);
        expect(loadMarkdownDraft(localStorage, 'fallback')).toBe('# 草稿\n\n![本地截图](raphael-image://draft/default/pasted-image-1)');
    });

    test('normalizes incomplete or invalid preferences', () => {
        expect(
            normalizePreferences({
                themeMode: 'dark',
                activeTheme: '',
                previewDevice: 'watch',
                scrollSyncEnabled: false,
                persistPastedImages: true,
                keepImageReferencesOnDisable: false,
                relayAiRequests: false,
                aiWriting: {
                    baseUrl: 'https://api.example.com/v1',
                    apiKey: 42,
                    model: 'gpt-4o-mini'
                }
            })
        ).toEqual({
            ...DEFAULT_PREFERENCES,
            themeMode: 'dark',
            scrollSyncEnabled: false,
            persistPastedImages: true,
            keepImageReferencesOnDisable: false,
            relayAiRequests: false,
            aiWriting: {
                baseUrl: 'https://api.example.com/v1',
                apiKey: '',
                model: 'gpt-4o-mini'
            }
        });
    });

    test('saves and restores preferences', () => {
        localStorage.clear();
        const preferences = {
            themeMode: 'dark' as const,
            activeTheme: 'github',
            previewDevice: 'mobile' as const,
            scrollSyncEnabled: false,
            persistPastedImages: true,
            keepImageReferencesOnDisable: false,
            relayAiRequests: false,
            aiWriting: {
                baseUrl: 'https://api.example.com/v1',
                apiKey: 'local-key',
                model: 'gpt-4o-mini'
            }
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
