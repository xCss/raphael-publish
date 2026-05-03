import { describe, expect, test } from 'vitest';
import { createDraftImageReference, getDraftImageReferenceParts, isDraftImageReference, resolveDraftImageReferencesInHtml } from './imagePersistence';

describe('image persistence references', () => {
    test('creates stable draft-scoped image references', () => {
        expect(createDraftImageReference('default', 'pasted-image-1')).toBe('raphael-image://draft/default/pasted-image-1');
    });

    test('recognizes only durable draft image references', () => {
        expect(isDraftImageReference('raphael-image://draft/default/pasted-image-1')).toBe(true);
        expect(isDraftImageReference('blob:http://localhost/pasted-image')).toBe(false);
        expect(isDraftImageReference('https://example.com/image.png')).toBe(false);
    });

    test('parses draft image references back into identifiers', () => {
        expect(getDraftImageReferenceParts('raphael-image://draft/default/pasted-image-1')).toEqual({
            draftId: 'default',
            imageId: 'pasted-image-1'
        });
        expect(getDraftImageReferenceParts('blob:http://localhost/pasted-image')).toBeNull();
    });

    test('replaces durable image references in html with preview object URLs while preserving originals', async () => {
        const html = '<p><img src="raphael-image://draft/default/pasted-image-1" alt="截图"></p>';

        const resolvedHtml = await resolveDraftImageReferencesInHtml(html, async (reference) => {
            expect(reference).toBe('raphael-image://draft/default/pasted-image-1');
            return 'blob:http://localhost/resolved-image';
        });

        expect(resolvedHtml).toContain('src="blob:http://localhost/resolved-image"');
        expect(resolvedHtml).toContain('data-original-src="raphael-image://draft/default/pasted-image-1"');
    });
});
