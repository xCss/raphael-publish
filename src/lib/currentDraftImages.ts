import {
    cleanupOrphanDraftImages,
    persistDraftImage,
    removeDraftImageReferencesFromMarkdown
} from './imagePersistence';

export const CURRENT_DRAFT_ID = 'default';

export function persistCurrentDraftImage(file: File) {
    return persistDraftImage(file, CURRENT_DRAFT_ID);
}

export function removeCurrentDraftImageReferences(markdown: string) {
    return removeDraftImageReferencesFromMarkdown(markdown, CURRENT_DRAFT_ID);
}

export function cleanupCurrentDraftImages(markdown: string) {
    return cleanupOrphanDraftImages(markdown, CURRENT_DRAFT_ID);
}
