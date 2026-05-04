import { describe, expect, test } from 'vitest';
import { makeWeChatCompatible } from './wechatCompat';

describe('makeWeChatCompatible code blocks', () => {
    test('preserves code whitespace with explicit WeChat-safe line breaks', async () => {
        const html = [
            '<div>',
            '<pre style="white-space: pre;"><code class="hljs">',
            '<span style="color: #d73a49;">const</span> raphael = {\n',
            '  paste: (richText) =&gt; <span style="color: #6f42c1;">cleanToMarkdown</span>(richText),\n',
            '};',
            '</code></pre>',
            '</div>'
        ].join('');

        const result = await makeWeChatCompatible(html, 'apple');

        expect(result).toContain('<br>');
        expect(result).toContain('const</span>&nbsp;raphael&nbsp;=&nbsp;{');
        expect(result).toContain('&nbsp;&nbsp;paste:&nbsp;(richText)&nbsp;=&gt;&nbsp;');
        expect(result).toContain('cleanToMarkdown</span>(richText),');
    });

    test('keeps long code lines scrollable instead of wrapping', async () => {
        const html = [
            '<div>',
            '<pre style="white-space: pre;"><code class="hljs">',
            'const veryLongLine = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";',
            '</code></pre>',
            '</div>'
        ].join('');

        const result = await makeWeChatCompatible(html, 'apple');

        expect(result).toContain('overflow-x: auto');
        expect(result).toContain('overflow-y: hidden');
        expect(result).toContain('max-width: 100%');
        expect(result).toContain('display: inline-block');
        expect(result).toContain('min-width: max-content');
        expect(result).toContain('white-space: nowrap !important');
        expect(result).toContain('word-break: keep-all !important');
        expect(result).toContain('overflow-wrap: normal !important');
        expect(result).toContain('word-wrap: normal !important');
    });

    test('prevents WeChat global break-word styles from wrapping highlighted code spans', async () => {
        const html = [
            '<div>',
            '<pre style="white-space: pre;"><code class="hljs">',
            '<span style="color: #d73a49;">const</span> veryLongIdentifier = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";',
            '</code></pre>',
            '</div>'
        ].join('');

        const result = await makeWeChatCompatible(html, 'apple');

        expect(result).toContain('white-space: nowrap !important');
        expect(result).toContain('word-break: keep-all !important');
        expect(result).toContain('word-wrap: normal !important');
        expect(result).toContain('data-code-line="wechat"');
        expect(result).toContain('const</span>&nbsp;veryLongIdentifier');
        expect(result).toContain('overflow-wrap: normal !important');
    });

    test('keeps mac shell border fixed while code content scrolls in WeChat', async () => {
        const html = [
            '<div>',
            '<section data-code-shell="mac" style="display: block; width: 100%; margin: 0; box-sizing: border-box; overflow: hidden; border-radius: 12px; border: 1px solid #d1d5db; background-color: #ffffff !important; box-shadow: none;">',
            '<section data-code-dots="mac" style="height: 34px; border-bottom: 1px solid #d1d5db;"></section>',
            '<pre style="margin: 0 !important; padding: 0 !important; background-color: #f5f5f7 !important; border: 1px solid red; overflow-x: auto;"><code class="hljs" style="display: block; padding: 16px 18px 18px 18px !important; background: #fff; border: 1px solid blue;">',
            'const veryLongLine = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";',
            '</code></pre>',
            '</section>',
            '</div>'
        ].join('');

        const result = await makeWeChatCompatible(html, 'apple');
        const doc = new DOMParser().parseFromString(result, 'text/html');
        const shell = doc.querySelector('[data-code-shell="mac"]');
        const pre = shell?.querySelector('pre');
        const code = shell?.querySelector('code');
        const shellStyle = shell?.getAttribute('style') || '';
        const preStyle = pre?.getAttribute('style') || '';
        const codeStyle = code?.getAttribute('style') || '';
        const dotsText = shell?.querySelector('[data-code-dots="mac"]')?.textContent || '';
        const dotsStyle = shell?.querySelector('[data-code-dots="mac"]')?.getAttribute('style') || '';
        const firstDotStyle = shell?.querySelector('[data-code-dots="mac"] span')?.getAttribute('style') || '';

        expect(shellStyle).toContain('width: 100%');
        expect(shellStyle).toContain('max-width: 100%');
        expect(shellStyle).toContain('overflow: hidden');
        expect(shellStyle).toContain('border: 1px solid #d1d5db');
        expect(shellStyle).toContain('word-wrap: normal !important');
        expect(preStyle).toContain('width: 100%');
        expect(preStyle).toContain('box-sizing: border-box');
        expect(preStyle).toContain('overflow-x: auto');
        expect(preStyle).toContain('word-wrap: normal !important');
        expect(preStyle).toContain('border: none !important');
        expect(preStyle).toContain('background-color: transparent !important');
        expect(preStyle).not.toContain('border: 1px solid red');
        expect(preStyle).not.toContain('background-color: #f5f5f7');
        expect(codeStyle).toContain('display: inline-block');
        expect(codeStyle).toContain('min-width: max-content');
        expect(codeStyle).toContain('border: none !important');
        expect(codeStyle).toContain('background-color: transparent !important');
        expect(codeStyle).not.toContain('border: 1px solid blue');
        expect(codeStyle).not.toContain('background: #fff');
        expect(dotsText).toBe('●●●');
        expect(dotsStyle).toContain('gap: 0');
        expect(firstDotStyle).toContain('font-size: 22px');
        expect(firstDotStyle).not.toContain('margin-right');
    });
});

describe('makeWeChatCompatible lists', () => {
    test('wraps simple list item inline content to prevent WeChat section insertion', async () => {
        const html = [
            '<div>',
            '<ul><li style="margin: 8px 0;"><strong style="font-weight: 700;">偏好记忆：</strong> 自动恢复主题、明暗模式、预览设备</li></ul>',
            '</div>'
        ].join('');

        const result = await makeWeChatCompatible(html, 'apple');
        const doc = new DOMParser().parseFromString(result, 'text/html');
        const li = doc.querySelector('li');
        const inlineWrapper = li?.querySelector(':scope > span[data-list-inline="wechat"]');

        expect(inlineWrapper).not.toBeNull();
        expect(inlineWrapper?.textContent).toContain('偏好记忆： 自动恢复主题、明暗模式、预览设备');
        expect(inlineWrapper?.getAttribute('style')).toContain('display: inline !important;');
        expect(Array.from(li?.childNodes || []).every(node => node.nodeType !== Node.TEXT_NODE || !(node.textContent || '').trim())).toBe(true);
    });
});
