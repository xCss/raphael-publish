import { describe, expect, it } from 'vitest';
import { applyTheme, md, preprocessMarkdown } from './markdown';

function renderMarkdown(markdown: string) {
    return md.render(preprocessMarkdown(markdown));
}

describe('preprocessMarkdown', () => {
    it('keeps bold rendering intact next to trailing punctuation', () => {
        const html = renderMarkdown('2025年初，伦敦黄金市场的一个月拆借利率一度升至**5%**。');

        expect(html).toContain('<strong>5%</strong>。');
        expect(html).not.toContain('**5%**');
    });

    it('repairs bold segments that start with a symbol and attach to previous text', () => {
        const html = renderMarkdown('利率变化至**-5%**。');
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const strong = doc.querySelector('strong');

        expect(strong?.textContent?.replace(/\u200B/g, '')).toBe('-5%');
    });

    it('does not merge separate bold blocks across blank lines', () => {
        const html = renderMarkdown('**5 %**\n\n**5%**');
        const doc = new DOMParser().parseFromString(html, 'text/html');

        expect(doc.querySelectorAll('strong')).toHaveLength(2);
    });
});

describe('markdown html safety', () => {
    it('escapes raw html instead of rendering executable elements', () => {
        const html = renderMarkdown('<img src=x onerror="alert(1)"><script>alert(1)</script>');
        const doc = new DOMParser().parseFromString(html, 'text/html');

        expect(doc.querySelector('script')).toBeNull();
        expect(doc.querySelector('img')).toBeNull();
        expect(doc.body.textContent).toContain('<img src=x onerror="alert(1)">');
        expect(doc.body.textContent).toContain('<script>alert(1)</script>');
    });

    it('still renders standard markdown elements', () => {
        const html = renderMarkdown('# 标题\n\n**加粗**\n\n[链接](https://example.com)\n\n![图片](https://example.com/a.png)');
        const doc = new DOMParser().parseFromString(html, 'text/html');

        expect(doc.querySelector('h1')?.textContent).toBe('标题');
        expect(doc.querySelector('strong')?.textContent).toBe('加粗');
        expect(doc.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
        expect(doc.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png');
    });
});

describe('applyTheme', () => {
    it('groups consecutive standalone images into an image grid', () => {
        const html = '<p><img src="a.png" /></p><p><img src="b.png" /></p>';
        const themed = applyTheme(html, 'apple');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const grid = doc.querySelector('.image-grid');

        expect(grid).not.toBeNull();
        expect(grid?.querySelectorAll('img')).toHaveLength(2);
    });

    it('renders light themes with a light mac shell', () => {
        const rawHtml = renderMarkdown('```javascript\nconst raphael = 1;\n```');
        const themed = applyTheme(rawHtml, 'apple');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const shellStyle = doc.querySelector('[data-code-shell="mac"]')?.getAttribute('style') || '';
        const dotsStyle = doc.querySelector('[data-code-dots="mac"]')?.getAttribute('style') || '';

        expect(shellStyle).toContain('background-color: #f5f5f7');
        expect(shellStyle).toContain('border: 1px solid #d1d5db');
        expect(shellStyle).toContain('box-shadow: none');
        expect(shellStyle).not.toContain('margin: 24px 0');
        expect(dotsStyle).toContain('background: linear-gradient(180deg, #fbfbfc 0%, #eceef1 100%)');
    });

    it('renders code shell without an extra outer pre wrapper', () => {
        const rawHtml = renderMarkdown('```javascript\nconst raphael = 1;\n```');
        const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
        const shell = doc.querySelector('[data-code-shell="mac"]');

        expect(shell?.parentElement?.tagName).not.toBe('PRE');
        expect(doc.querySelector('pre > [data-code-shell="mac"]')).toBeNull();
        expect(shell?.querySelectorAll('pre')).toHaveLength(1);
    });

    it('renders dark themes with a dark mac shell', () => {
        const rawHtml = renderMarkdown('```javascript\nconst raphael = 1;\n```');
        const themed = applyTheme(rawHtml, 'linear');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const shellStyle = doc.querySelector('[data-code-shell="mac"]')?.getAttribute('style') || '';
        const dotsStyle = doc.querySelector('[data-code-dots="mac"]')?.getAttribute('style') || '';
        const preStyle = doc.querySelector('[data-code-shell="mac"] pre')?.getAttribute('style') || '';
        const codeStyle = doc.querySelector('[data-code-shell="mac"] pre code')?.getAttribute('style') || '';

        expect(shellStyle).toContain('background-color: #1a1a2e');
        expect(shellStyle).toContain('border: 1px solid #2f3136');
        expect(shellStyle).toContain('box-shadow: none');
        expect(shellStyle).not.toContain('margin: 24px 0');
        expect(dotsStyle).toContain('background: linear-gradient(180deg, #2b2d31 0%, #1f2125 100%)');
        expect(preStyle).toContain('background-color: transparent !important;');
        expect(codeStyle).toContain('background: transparent !important;');
        expect(codeStyle).toContain('background-color: transparent !important;');
    });

    it('uses each theme pre background for the mac shell code body', () => {
        const rawHtml = renderMarkdown('```javascript\nconst raphael = 1;\n```');
        const themed = applyTheme(rawHtml, 'retro');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const shellStyle = doc.querySelector('[data-code-shell="mac"]')?.getAttribute('style') || '';

        expect(shellStyle).toContain('background-color: #ede4d0');
        expect(shellStyle).not.toContain('background-color: #f5f5f7');
    });

    it('uses readable dark highlight tokens for dark terminal themes', () => {
        const rawHtml = renderMarkdown('```javascript\nconst raphael = "publish";\n```');
        const themed = applyTheme(rawHtml, 'bloomberg');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const codeStyle = doc.querySelector('[data-code-shell="mac"] pre code')?.getAttribute('style') || '';
        const keywordStyle = doc.querySelector('.hljs-keyword')?.getAttribute('style') || '';
        const stringStyle = doc.querySelector('.hljs-string')?.getAttribute('style') || '';

        expect(codeStyle).toContain('color: #f8f8f2 !important;');
        expect(keywordStyle).toContain('color: #ff5370;');
        expect(stringStyle).toContain('color: #c3e88d;');
    });

    it('removes theme pre spacing and puts code padding inside the mac shell body', () => {
        const rawHtml = renderMarkdown('```javascript\nconst raphael = 1;\n```');
        const themed = applyTheme(rawHtml, 'apple');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const preStyle = doc.querySelector('[data-code-shell="mac"] pre')?.getAttribute('style') || '';
        const codeStyle = doc.querySelector('[data-code-shell="mac"] pre code')?.getAttribute('style') || '';

        expect(preStyle).toContain('margin: 0 !important;');
        expect(preStyle).toContain('padding: 0 !important;');
        expect(preStyle).toContain('background-color: transparent !important;');
        expect(preStyle).not.toContain('padding: 20px; background-color: #f5f5f7 !important;');
        expect(codeStyle).toContain('padding: 16px 18px 18px 18px !important;');
    });

    it('keeps the mac shell at normal width without negative margins', () => {
        const rawHtml = renderMarkdown('```javascript\nconst raphael = 1;\n```');
        const themed = applyTheme(rawHtml, 'apple');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const shellStyle = doc.querySelector('[data-code-shell="mac"]')?.getAttribute('style') || '';

        expect(shellStyle).toContain('width: 100%;');
        expect(shellStyle).toContain('margin: 0;');
        expect(shellStyle).not.toContain('width: calc(100% + 40px);');
        expect(shellStyle).not.toContain('margin-left: -20px;');
        expect(shellStyle).not.toContain('margin-right: -20px;');
    });

    it('keeps highlighted comments non-italic for apple', () => {
        const rawHtml = renderMarkdown('```javascript\n// 中文注释\nconst raphael = 1;\n```');
        const themed = applyTheme(rawHtml, 'apple');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const code = doc.querySelector('pre code');
        const comment = doc.querySelector('.hljs-comment');

        expect(code?.getAttribute('style')).toContain('font-style: normal !important;');
        expect(code?.getAttribute('style')).toContain('white-space: pre;');
        expect(comment?.getAttribute('style')).toContain('font-style: normal;');
    });

    it('does not override bloomberg block-code font inheritance', () => {
        const rawHtml = renderMarkdown('```javascript\n// terminal theme\nconst raphael = 1;\n```');
        const themed = applyTheme(rawHtml, 'bloomberg');
        const doc = new DOMParser().parseFromString(themed, 'text/html');
        const container = doc.querySelector('body > div');
        const pre = doc.querySelector('pre');
        const code = doc.querySelector('pre code');

        expect(container?.getAttribute('style')).toContain('"Courier New"');
        expect(pre?.getAttribute('style')).not.toContain('font-family:');
        expect(code?.getAttribute('style')).not.toContain('font-family:');
        expect(themed).not.toContain('"SF Mono", "Cascadia Code", "Fira Code", Consolas, Menlo, Monaco, monospace');
    });
});
