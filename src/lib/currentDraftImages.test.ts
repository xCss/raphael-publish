import { describe, expect, test, vi } from 'vitest';
import { cleanupCurrentDraftImages, persistCurrentDraftImage, removeCurrentDraftImageReferences, CURRENT_DRAFT_ID } from './currentDraftImages';

vi.mock('./imagePersistence', () => ({
    cleanupOrphanDraftImages: vi.fn(async (markdown: string, draftId: string) => `${draftId}:${markdown}`),
    persistDraftImage: vi.fn(async (file: File, draftId: string) => `${draftId}:${file.name}`),
    removeDraftImageReferencesFromMarkdown: vi.fn((markdown: string, draftId: string) => `${draftId}:${markdown}`)
}));

describe('current draft image facade', () => {
    test('uses the current draft id consistently', async () => {
        expect(CURRENT_DRAFT_ID).toBe('default');
        await expect(persistCurrentDraftImage(new File(['x'], 'sample.png'))).resolves.toBe(`${CURRENT_DRAFT_ID}:sample.png`);
        expect(removeCurrentDraftImageReferences('markdown')).toBe(`${CURRENT_DRAFT_ID}:markdown`);
        await expect(cleanupCurrentDraftImages('markdown')).resolves.toBe(`${CURRENT_DRAFT_ID}:markdown`);
    });
});
