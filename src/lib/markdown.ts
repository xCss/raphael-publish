import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';
import typescript from 'highlight.js/lib/languages/typescript';
import 'highlight.js/styles/github.css';
import { THEMES } from './themes';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('text', plaintext);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);

function parseHexColor(input: string): { r: number; g: number; b: number } | null {
    const match = input.match(/#([0-9a-fA-F]{6})/);
    if (!match) return null;

    const value = match[1];
    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16),
    };
}

function isDarkThemeStyle(containerStyle: string): boolean {
    const bgMatch = containerStyle.match(/background-color:\s*([^;]+);/i);
    if (!bgMatch) return false;

    const color = parseHexColor(bgMatch[1]);
    if (!color) return false;

    const luminance = (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
    return luminance < 0.45;
}

function extractBackgroundColor(style: string): string | null {
    const bgMatch = style.match(/background-color:\s*(#[0-9a-fA-F]{6})/i);
    return bgMatch ? bgMatch[1] : null;
}

function highlightCode(str: string, lang?: string) {
    if (lang && hljs.getLanguage(lang)) {
        try {
            return hljs.highlight(str, { language: lang }).value;
        } catch {
            return md.utils.escapeHtml(str);
        }
    }

    return md.utils.escapeHtml(str);
}

export const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
    highlight: highlightCode
});

md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = token.info ? token.info.trim() : '';
    const langName = info ? info.split(/\s+/g)[0] : '';
    const codeContent = highlightCode(token.content, langName);
    const languageClass = langName ? ` language-${md.utils.escapeHtml(langName)}` : '';
    const dots = '<section data-code-dots="mac"><span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #ff5f57; border: 1px solid rgba(0,0,0,0.10); box-sizing: border-box;"></span><span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #febc2e; border: 1px solid rgba(0,0,0,0.10); box-sizing: border-box;"></span><span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #28c840; border: 1px solid rgba(0,0,0,0.10); box-sizing: border-box;"></span></section>';

    return `<section data-code-shell="mac">${dots}<pre><code class="hljs${languageClass}">${codeContent}</code></pre></section>`;
};

// Avoid bold fragmentation when pasting from certain apps
export function preprocessMarkdown(content: string) {
    content = content.replace(/^[ ]{0,3}(\*[ ]*\*[ ]*\*[* ]*)[ \t]*$/gm, '***');
    content = content.replace(/^[ ]{0,3}(-[ ]*-[ ]*-[- ]*)[ \t]*$/gm, '---');
    content = content.replace(/^[ ]{0,3}(_[ ]*_[ ]*_[_ ]*)[ \t]*$/gm, '___');
    content = content.replace(/\*\*[ \t]+\*\*/g, ' ');
    content = content.replace(/\*{4,}/g, '');
    // markdown-it may fail to open bold when content starts with punctuation/symbol
    // and `**` is attached directly to preceding text (e.g. `至**-5%**。`).
    // Insert a zero-width separator only inside opening `**...` for these cases.
    content = content.replace(
        /([^\s])\*\*([-+＋－%％~～!！?？,，.。:：;；、/|@#￥$^&*_=（）()【】《》〈〉「」『』“”"'`…·][^\n*]*?)\*\*/g,
        '$1**\u200B$2**'
    );
    return content;
}

export function applyTheme(html: string, themeId: string) {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    const style = theme.styles;
    const darkShell = isDarkThemeStyle(style.container);
    const shellBg = extractBackgroundColor(style.pre) || (darkShell ? '#1a1a1a' : '#ffffff');
    const shellBorder = darkShell ? '#2f3136' : '#d1d5db';
    const shellHeaderStart = darkShell ? '#2b2d31' : '#fbfbfc';
    const shellHeaderEnd = darkShell ? '#1f2125' : '#eceef1';
    const codeTextColor = darkShell ? '#f8f8f2' : 'inherit';

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Note: Indexing is handled separately by markElementIndexes() function
    // to keep the core rendering logic decoupled from the click-to-locate feature

    // Specific inline overrides to prevent headings from uninheriting styles
    const headingInlineOverrides: Record<string, string> = {
        strong: 'font-weight: 700; color: inherit !important; background-color: transparent !important;',
        em: 'font-style: italic; color: inherit !important; background-color: transparent !important;',
        a: 'color: inherit !important; text-decoration: none !important; border-bottom: 1px solid currentColor !important; background-color: transparent !important;',
        code: 'color: inherit !important; background-color: transparent !important; border: none !important; padding: 0 !important;',
    };


    const getSingleImageNode = (p: HTMLParagraphElement): HTMLElement | null => {
        const children = Array.from(p.childNodes).filter(n =>
            !(n.nodeType === Node.TEXT_NODE && !(n.textContent || '').trim()) &&
            !(n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'BR')
        );
        if (children.length !== 1) return null;
        const onlyChild = children[0];
        if (onlyChild.nodeName === 'IMG') return onlyChild as HTMLElement;
        if (onlyChild.nodeName === 'A' && onlyChild.childNodes.length === 1 && onlyChild.childNodes[0].nodeName === 'IMG') {
            return onlyChild as HTMLElement;
        }
        return null;
    };

    // Check if a paragraph contains only images (for base64 images or multiple images in one paragraph)
    const isImageOnlyParagraph = (p: HTMLParagraphElement): boolean => {
        const children = Array.from(p.childNodes).filter(n =>
            !(n.nodeType === Node.TEXT_NODE && !(n.textContent || '').trim()) &&
            !(n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'BR')
        );
        if (children.length === 0) return false;
        return children.every(n =>
            n.nodeName === 'IMG' ||
            (n.nodeName === 'A' && n.childNodes.length === 1 && n.childNodes[0].nodeName === 'IMG')
        );
    };

    // Merge consecutive image-only paragraphs (same parent) into pair-wise side-by-side grids.
    const paragraphSnapshot = Array.from(doc.querySelectorAll('p'));
    const processed = new Set<HTMLParagraphElement>();

    for (const paragraph of paragraphSnapshot) {
        if (!paragraph.isConnected || processed.has(paragraph)) continue;
        if (!getSingleImageNode(paragraph) && !isImageOnlyParagraph(paragraph)) continue;

        const run: HTMLParagraphElement[] = [paragraph];
        processed.add(paragraph);

        let cursor = paragraph.nextElementSibling;
        while (cursor && cursor.tagName === 'P') {
            const p = cursor as HTMLParagraphElement;
            if (!getSingleImageNode(p) && !isImageOnlyParagraph(p)) break;
            run.push(p);
            processed.add(p);
            cursor = p.nextElementSibling;
        }

        if (run.length < 2) continue;

        // Collect all images from the run
        const allImages: HTMLElement[] = [];
        run.forEach(p => {
            if (getSingleImageNode(p)) {
                const img = getSingleImageNode(p);
                if (img) allImages.push(img);
            } else if (isImageOnlyParagraph(p)) {
                const images = p.querySelectorAll('img');
                images.forEach(img => allImages.push(img as HTMLElement));
            }
        });

        // Create grid paragraphs with 2 images each
        const firstParagraph = run[0];
        let lastInserted: HTMLElement | null = null;

        for (let i = 0; i < allImages.length; i += 2) {
            const gridParagraph = doc.createElement('p');
            gridParagraph.classList.add('image-grid');
            gridParagraph.setAttribute('style', 'display: flex; justify-content: center; gap: 8px; margin: 24px 0; align-items: flex-start;');

            gridParagraph.appendChild(allImages[i]);
            if (i + 1 < allImages.length) {
                gridParagraph.appendChild(allImages[i + 1]);
            }

            if (i === 0) {
                firstParagraph.before(gridParagraph);
                lastInserted = gridParagraph;
            } else if (lastInserted) {
                lastInserted.after(gridParagraph);
                lastInserted = gridParagraph;
            }
        }

        // Remove original paragraphs
        run.forEach(p => {
            if (p.isConnected) p.remove();
        });
    }

    // Process image grids
    const paragraphs = doc.querySelectorAll('p');
    paragraphs.forEach(p => {
        const children = Array.from(p.childNodes).filter(n => !(n.nodeType === Node.TEXT_NODE && !(n.textContent || '').trim()));
        const isAllImages = children.length > 1 && children.every(n => n.nodeName === 'IMG' || (n.nodeName === 'A' && n.childNodes.length === 1 && n.childNodes[0].nodeName === 'IMG'));

        if (isAllImages) {
            p.classList.add('image-grid');
            p.setAttribute('style', 'display: flex; justify-content: center; gap: 8px; margin: 24px 0; align-items: flex-start;');

            p.querySelectorAll('img').forEach(img => {
                img.classList.add('grid-img');
                const w = 100 / children.length;
                img.setAttribute('style', `width: calc(${w}% - ${8 * (children.length - 1) / children.length}px); margin: 0; border-radius: 8px; height: auto;`);
            });
        }
    });

    Object.keys(style).forEach((selector) => {

        if (selector === 'pre code') return;
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => {
            if (selector === 'code' && el.parentElement?.tagName === 'PRE') return;
            if (el.tagName === 'IMG' && el.closest('.image-grid')) return;
            const currentStyle = el.getAttribute('style') || '';
            el.setAttribute('style', currentStyle + '; ' + style[selector as keyof typeof style]);
        });
    });

    // Tailwind preflight removes native list markers. Restore explicit markers.
    doc.querySelectorAll('ul').forEach(ul => {
        const currentStyle = ul.getAttribute('style') || '';
        ul.setAttribute('style', `${currentStyle}; list-style-type: disc !important; list-style-position: outside;`);
    });
    doc.querySelectorAll('ul ul').forEach(ul => {
        const currentStyle = ul.getAttribute('style') || '';
        ul.setAttribute('style', `${currentStyle}; list-style-type: circle !important;`);
    });
    doc.querySelectorAll('ul ul ul').forEach(ul => {
        const currentStyle = ul.getAttribute('style') || '';
        ul.setAttribute('style', `${currentStyle}; list-style-type: square !important;`);
    });
    doc.querySelectorAll('ol').forEach(ol => {
        const currentStyle = ol.getAttribute('style') || '';
        ol.setAttribute('style', `${currentStyle}; list-style-type: decimal !important; list-style-position: outside;`);
    });

    const hljsLight: Record<string, string> = {
        'hljs-comment': 'color: #6a737d; font-style: normal;',
        'hljs-quote': 'color: #6a737d; font-style: normal;',
        'hljs-keyword': 'color: #d73a49; font-weight: 600;',
        'hljs-selector-tag': 'color: #d73a49; font-weight: 600;',
        'hljs-string': 'color: #032f62;',
        'hljs-title': 'color: #6f42c1; font-weight: 600;',
        'hljs-section': 'color: #6f42c1; font-weight: 600;',
        'hljs-type': 'color: #005cc5; font-weight: 600;',
        'hljs-number': 'color: #005cc5;',
        'hljs-literal': 'color: #005cc5;',
        'hljs-built_in': 'color: #005cc5;',
        'hljs-variable': 'color: #e36209;',
        'hljs-template-variable': 'color: #e36209;',
        'hljs-tag': 'color: #22863a;',
        'hljs-name': 'color: #22863a;',
        'hljs-attr': 'color: #6f42c1;',
    };

    const hljsDark: Record<string, string> = {
        'hljs-comment': 'color: #7f8c98; font-style: normal;',
        'hljs-quote': 'color: #7f8c98; font-style: normal;',
        'hljs-keyword': 'color: #ff5370; font-weight: 600;',
        'hljs-selector-tag': 'color: #ff5370; font-weight: 600;',
        'hljs-string': 'color: #c3e88d;',
        'hljs-title': 'color: #c792ea; font-weight: 600;',
        'hljs-section': 'color: #c792ea; font-weight: 600;',
        'hljs-type': 'color: #82aaff; font-weight: 600;',
        'hljs-number': 'color: #f78c6c;',
        'hljs-literal': 'color: #f78c6c;',
        'hljs-built_in': 'color: #82aaff;',
        'hljs-variable': 'color: #ffcb6b;',
        'hljs-template-variable': 'color: #ffcb6b;',
        'hljs-tag': 'color: #89ddff;',
        'hljs-name': 'color: #89ddff;',
        'hljs-attr': 'color: #c792ea;',
    };

    const hljsTheme = darkShell ? hljsDark : hljsLight;

    const codeTokens = doc.querySelectorAll('.hljs span');
    codeTokens.forEach(span => {
        let inlineStyle = span.getAttribute('style') || '';
        if (inlineStyle && !inlineStyle.endsWith(';')) inlineStyle += '; ';
        span.classList.forEach(cls => {
            if (hljsTheme[cls]) {
                inlineStyle += hljsTheme[cls] + '; ';
            }
        });
        if (inlineStyle) {
            span.setAttribute('style', inlineStyle);
        }
    });

    doc.querySelectorAll('pre').forEach(pre => {
        const currentStyle = pre.getAttribute('style') || '';
        const isInMacShell = Boolean(pre.closest('[data-code-shell="mac"]'));
        if (isInMacShell) {
            const fontSize = currentStyle.match(/font-size:\s*[^;]+;/i)?.[0] || '';
            const lineHeight = currentStyle.match(/line-height:\s*[^;]+;/i)?.[0] || '';
            pre.setAttribute(
                'style',
                `margin: 0 !important; padding: 0 !important; background-color: transparent !important; border: none !important; border-radius: 0 !important; overflow-x: auto; ${fontSize} ${lineHeight} font-variant-ligatures: none; tab-size: 2;`
            );
            return;
        }
        pre.setAttribute(
            'style',
            `${currentStyle}; font-variant-ligatures: none; tab-size: 2;`
        );
    });

    doc.querySelectorAll('pre code, pre .hljs, .hljs').forEach(codeNode => {
        const currentStyle = codeNode.getAttribute('style') || '';
        const isInMacShell = Boolean(codeNode.closest('[data-code-shell="mac"]'));
        const shellCodeStyle = isInMacShell
            ? 'padding: 16px 18px 18px 18px !important; box-sizing: border-box; background: transparent !important; background-color: transparent !important;'
            : '';
        codeNode.setAttribute(
            'style',
            `${currentStyle}; display: block; ${shellCodeStyle} color: ${codeTextColor} !important; font-size: inherit !important; line-height: inherit !important; font-style: normal !important; white-space: pre; word-break: normal; overflow-wrap: normal;`
        );
    });

    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
        Object.keys(headingInlineOverrides).forEach(tag => {
            heading.querySelectorAll(tag).forEach(node => {
                const override = headingInlineOverrides[tag];
                node.setAttribute('style', `${node.getAttribute('style') || ''}; ${override}`);
            });
        });
    });

    doc.querySelectorAll('[data-code-shell="mac"]').forEach(shell => {
        shell.setAttribute(
            'style',
            `display: block; width: 100%; margin: 0; box-sizing: border-box; overflow: hidden; border-radius: 12px; border: 1px solid ${shellBorder}; background-color: ${shellBg} !important; box-shadow: none;`
        );
    });

    doc.querySelectorAll('[data-code-dots="mac"]').forEach(dots => {
        dots.setAttribute(
            'style',
            `height: 34px; padding: 0 14px; display: flex; align-items: center; gap: 7px; background: linear-gradient(180deg, ${shellHeaderStart} 0%, ${shellHeaderEnd} 100%); border-bottom: 1px solid ${shellBorder}; box-sizing: border-box; white-space: nowrap;`
        );
    });

    // Unify image look-and-feel across themes.
    doc.querySelectorAll('img').forEach(img => {
        const inGrid = Boolean(img.closest('.image-grid'));
        const currentStyle = img.getAttribute('style') || '';
        const appendedStyle = inGrid
            ? 'display:block; max-width:100%; height:auto; margin:0 !important; padding:8px !important; border-radius:14px !important; box-sizing:border-box; box-shadow:0 12px 28px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.12); border:1px solid rgba(255,255,255,0.75);'
            : 'display:block; width:100%; max-width:100%; height:auto; margin:30px auto !important; padding:8px !important; border-radius:14px !important; box-sizing:border-box; box-shadow:0 16px 34px rgba(15,23,42,0.22), 0 4px 10px rgba(15,23,42,0.12); border:1px solid rgba(15,23,42,0.12);';
        img.setAttribute('style', `${currentStyle}; ${appendedStyle}`);
    });

    const container = doc.createElement('div');
    container.setAttribute('style', style.container);
    container.innerHTML = doc.body.innerHTML;

    return container.outerHTML;
}
