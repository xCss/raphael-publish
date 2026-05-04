import { afterEach, describe, expect, test, vi } from 'vitest';
import { prepareHtmlForExport } from './htmlExport';

const originalFetch = globalThis.fetch;

afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
});

describe('prepareHtmlForExport', () => {
    test('inlines blob and original draft image sources for portable HTML export', async () => {
        globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url === 'blob:http://localhost/pasted-image') {
                return {
                    ok: true,
                    blob: async () => new Blob(['image-bytes'], { type: 'image/png' })
                } as Response;
            }
            throw new Error(`Unexpected fetch: ${url}`);
        });

        const html = '<div><p><img data-md-type="image" data-md-index="0" data-original-src="raphael-image://draft/default/pasted-image" src="blob:http://localhost/pasted-image" alt="截图"></p></div>';

        const exported = await prepareHtmlForExport(html);
        const doc = new DOMParser().parseFromString(exported, 'text/html');
        const image = doc.querySelector('img');

        expect(image?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
        expect(image?.hasAttribute('data-original-src')).toBe(false);
        expect(image?.hasAttribute('data-md-type')).toBe(false);
        expect(image?.hasAttribute('data-md-index')).toBe(false);
        expect(exported).not.toContain('blob:http://localhost/pasted-image');
        expect(exported).not.toContain('raphael-image://draft/default/pasted-image');
    });
});
