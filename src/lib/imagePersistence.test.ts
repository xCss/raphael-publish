import { describe, expect, test } from 'vitest';
import { collectDraftImageReferenceIds, createDraftImageReference, getDraftImageReferenceParts, isDraftImageReference, removeDraftImageReferencesFromMarkdown, resolveDraftImageReferencesInHtml } from './imagePersistence';

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

        const result = await resolveDraftImageReferencesInHtml(html, async (reference) => {
            expect(reference).toBe('raphael-image://draft/default/pasted-image-1');
            return 'blob:http://localhost/resolved-image';
        });

        expect(result.html).toContain('src="blob:http://localhost/resolved-image"');
        expect(result.html).toContain('data-original-src="raphael-image://draft/default/pasted-image-1"');
        expect(result.objectUrls).toEqual(['blob:http://localhost/resolved-image']);
    });

    test('tracks only generated blob object URLs', async () => {
        const html = [
            '<p><img src="raphael-image://draft/default/pasted-image-1" alt="截图 1"></p>',
            '<p><img src="raphael-image://draft/default/pasted-image-2" alt="截图 2"></p>'
        ].join('');

        const result = await resolveDraftImageReferencesInHtml(html, async (reference) => {
            if (reference.endsWith('pasted-image-1')) return 'blob:http://localhost/resolved-image';
            return 'https://example.com/remote-image.png';
        });

        expect(result.html).toContain('src="blob:http://localhost/resolved-image"');
        expect(result.html).toContain('src="https://example.com/remote-image.png"');
        expect(result.objectUrls).toEqual(['blob:http://localhost/resolved-image']);
    });

    test('collects only current draft image ids from markdown', () => {
        const markdown = [
            '![保留](raphael-image://draft/default/pasted-keep)',
            '![其它草稿](raphael-image://draft/other/pasted-other)',
            '![远程](https://example.com/image.png)',
            '![重复](raphael-image://draft/default/pasted-keep)'
        ].join('\n\n');

        expect(collectDraftImageReferenceIds(markdown, 'default')).toEqual(new Set(['pasted-keep']));
    });

    test('removes current draft image markdown references while preserving other content', () => {
        const markdown = [
            '# 标题',
            '',
            '正文之前',
            '',
            '![本地截图](raphael-image://draft/default/pasted-remove)',
            '',
            '正文之后',
            '',
            '![远程图片](https://example.com/image.png)',
            '',
            '![其它草稿](raphael-image://draft/other/pasted-keep)'
        ].join('\n');

        expect(removeDraftImageReferencesFromMarkdown(markdown, 'default')).toBe([
            '# 标题',
            '',
            '正文之前',
            '',
            '正文之后',
            '',
            '![远程图片](https://example.com/image.png)',
            '',
            '![其它草稿](raphael-image://draft/other/pasted-keep)'
        ].join('\n'));
    });
});
