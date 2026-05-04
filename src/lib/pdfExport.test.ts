import { describe, expect, test } from 'vitest';
import { createPdfExportContainer } from './pdfExport';

describe('createPdfExportContainer', () => {
    test('uses A4 printable width and cleans internal attributes', () => {
        const source = document.createElement('div');
        source.className = 'preview-content min-w-full';
        source.innerHTML = '<section data-md-type="heading" data-md-index="0"><h1>标题</h1></section>';
        source.getBoundingClientRect = () => ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 586,
            bottom: 800,
            width: 586,
            height: 800,
            toJSON: () => ({})
        } as DOMRect);

        const container = createPdfExportContainer(source, '#ffffff');
        const clone = container.firstElementChild as HTMLElement | null;

        expect(container.style.width).toBe('190mm');
        expect(container.style.maxWidth).toBe('190mm');
        expect(container.style.minWidth).toBe('0px');
        expect(clone?.style.width).toBe('190mm');
        expect(clone?.style.maxWidth).toBe('190mm');
        expect(clone?.style.minWidth).toBe('0px');
        expect(container.querySelector('[data-md-type]')).toBeNull();
        expect(container.querySelector('[data-md-index]')).toBeNull();
    });

    test('adds page-break protection for common article blocks', () => {
        const source = document.createElement('div');
        source.innerHTML = '<p>段落</p><li>列表项</li><pre><code>code</code></pre><table><tbody><tr><td>表格</td></tr></tbody></table><blockquote>引用</blockquote>';

        const container = createPdfExportContainer(source, '#ffffff');

        ['p', 'li', 'pre', 'table', 'blockquote'].forEach((selector) => {
            const element = container.querySelector(selector) as HTMLElement | null;
            expect(element?.style.breakInside).toBe('avoid');
            expect(element?.style.pageBreakInside).toBe('avoid');
        });
    });
});
