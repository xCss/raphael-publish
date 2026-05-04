import { THEMES } from './themes';
import { stripIndexMarkers } from './markdownIndexer';

/**
 * Remove internal editor attributes from HTML
 * Used when exporting to avoid including internal implementation details
 *
 * This is now a thin wrapper around stripIndexMarkers from the indexing layer.
 * Keeping this function for backward compatibility.
 */
export function cleanInternalAttributes(html: string): string {
    return stripIndexMarkers(html);
}

// Helper to convert images to Base64
async function getBase64Image(imgUrl: string): Promise<string> {
    try {
        if (imgUrl.startsWith('data:')) return imgUrl;

        const response = await fetch(imgUrl, { mode: 'cors', cache: 'default' });
        if (!response.ok) return imgUrl;

        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(imgUrl);
            reader.readAsDataURL(blob);
        });
    } catch {
        return imgUrl;
    }
}

function preserveCodeWhitespaceForWeChat(doc: Document, codeElement: Element) {
    const convertTextNode = (textNode: Text) => {
        const text = textNode.textContent || '';
        const fragment = doc.createDocumentFragment();
        const lines = text.split('\n');

        lines.forEach((line, index) => {
            if (index > 0) fragment.appendChild(doc.createElement('br'));
            if (line.length > 0) {
                fragment.appendChild(doc.createTextNode(line.replace(/ /g, '\u00a0')));
            }
        });

        textNode.parentNode?.replaceChild(fragment, textNode);
    };

    const walk = (node: Node) => {
        Array.from(node.childNodes).forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                convertTextNode(child as Text);
                return;
            }
            walk(child);
        });
    };

    walk(codeElement);
}

function wrapCodeLinesForWeChat(doc: Document, codeElement: Element) {
    const nodes = Array.from(codeElement.childNodes);
    if (nodes.some(node => node.nodeType === Node.ELEMENT_NODE && (node as Element).getAttribute('data-code-line') === 'wechat')) return;

    codeElement.textContent = '';
    let currentLine = doc.createElement('span');
    currentLine.setAttribute('data-code-line', 'wechat');
    currentLine.setAttribute('style', `display: inline-block; min-width: max-content; ${noWrapOverride}`);
    codeElement.appendChild(currentLine);

    const appendNewLine = () => {
        codeElement.appendChild(doc.createElement('br'));
        currentLine = doc.createElement('span');
        currentLine.setAttribute('data-code-line', 'wechat');
        currentLine.setAttribute('style', `display: inline-block; min-width: max-content; ${noWrapOverride}`);
        codeElement.appendChild(currentLine);
    };

    nodes.forEach(node => {
        if (node.nodeName === 'BR') {
            appendNewLine();
            return;
        }
        currentLine.appendChild(node);
    });
}

function removeInlineStyleProperty(style: string, property: string) {
    const pattern = new RegExp(`${property}\\s*:\\s*[^;]+;?`, 'gi');
    return style.replace(pattern, '').trim();
}

function cleanCodeScrollLayerStyle(style: string) {
    return ['border', 'background', 'background-color'].reduce(
        (currentStyle, property) => removeInlineStyleProperty(currentStyle, property),
        style
    );
}

const noWrapOverride = 'white-space: nowrap !important; word-break: keep-all !important; overflow-wrap: normal !important; word-wrap: normal !important;';

function appendNoWrapStyle(element: Element) {
    const currentStyle = element.getAttribute('style') || '';
    element.setAttribute('style', `${currentStyle}; ${noWrapOverride}`.trim());
}

export async function makeWeChatCompatible(html: string, themeId: string): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    const containerStyle = theme.styles.container || '';

    // 0. Remove internal editor attributes (for click-to-locate feature)
    // These are only used in the editor and should not appear in the final HTML
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
        el.removeAttribute('data-md-type');
        el.removeAttribute('data-md-index');
    });

    // Note: We manually remove attributes here before DOM manipulation
    // The stripIndexMarkers() function is also available for HTML string operations

    // 1. WeChat prefers <section> as the root wrapper for overall styling
    // If the root is a div, let's wrap or convert it to a section.
    const rootNodes = Array.from(doc.body.children);

    // Create new wrap section
    const section = doc.createElement('section');
    section.setAttribute('style', containerStyle);

    rootNodes.forEach(node => {
        // If the original html came from applyTheme it already has a root div
        // We strip it regardless of exact style string match to avoid double layers
        if (node.tagName === 'DIV' && rootNodes.length === 1) {
            Array.from(node.childNodes).forEach(child => section.appendChild(child));
        } else {
            section.appendChild(node);
        }
    });

    // 2. WeChat ignores flex in many scenarios. Convert image flex wrappers to table layout.
    const flexLikeNodes = section.querySelectorAll('div, p.image-grid');
    flexLikeNodes.forEach(node => {
        // Keep code block internals untouched.
        if (node.closest('pre, code')) return;

        const style = node.getAttribute('style') || '';
        const isFlexNode = style.includes('display: flex') || style.includes('display:flex');
        const isImageGrid = node.classList.contains('image-grid');
        if (!isFlexNode && !isImageGrid) return;

        const flexChildren = Array.from(node.children);
        if (flexChildren.every(child => child.tagName === 'IMG' || child.querySelector('img'))) {
            const table = doc.createElement('table');
            table.setAttribute('style', 'width: 100%; border-collapse: collapse; margin: 16px 0; border: none !important;');
            const tbody = doc.createElement('tbody');
            const tr = doc.createElement('tr');
            tr.setAttribute('style', 'border: none !important; background: transparent !important;');

            flexChildren.forEach(child => {
                const td = doc.createElement('td');
                td.setAttribute('style', 'padding: 0 4px; vertical-align: top; border: none !important; background: transparent !important;');
                td.appendChild(child);
                // Update child width to 100% since it's now bound by TD
                if (child.tagName === 'IMG') {
                    const currentStyle = child.getAttribute('style') || '';
                    child.setAttribute('style', currentStyle.replace(/width:\s*[^;]+;?/g, '') + ' width: 100% !important; display: block; margin: 0 auto;');
                }
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
            table.appendChild(tbody);
            node.parentNode?.replaceChild(table, node);
        } else if (isFlexNode) {
            // Non-image flex items just get stripped of flex.
            node.setAttribute('style', style.replace(/display:\s*flex;?/g, 'display: block;'));
        }
    });

    // 3. List Item Flattening
    // WeChat notoriously misrenders heavily nested <li> formatting, flattening the inner structure helps
    const listItems = section.querySelectorAll('li');
    listItems.forEach(li => {
        const hasBlockChildren = Array.from(li.children).some(child =>
            ['P', 'DIV', 'UL', 'OL', 'BLOCKQUOTE'].includes(child.tagName)
        );
        if (hasBlockChildren) {
            // We only want to clean inner tags if it's overly complex, 
            // but flattening everything might kill <strong> or <em>.
            // Let's just strip 'p' inside 'li' by replacing <p> with <span>
            const ps = li.querySelectorAll('p');
            ps.forEach(p => {
                const span = doc.createElement('span');
                span.innerHTML = p.innerHTML;
                const pStyle = p.getAttribute('style');
                if (pStyle) span.setAttribute('style', pStyle);
                p.parentNode?.replaceChild(span, p);
            });
        }

        const stillHasBlockChildren = Array.from(li.children).some(child =>
            ['P', 'DIV', 'UL', 'OL', 'BLOCKQUOTE', 'SECTION'].includes(child.tagName)
        );
        if (!stillHasBlockChildren && !li.querySelector(':scope > span[data-list-inline="wechat"]')) {
            const inlineWrapper = doc.createElement('span');
            inlineWrapper.setAttribute('data-list-inline', 'wechat');
            inlineWrapper.setAttribute('style', 'display: inline !important; white-space: normal !important; word-break: normal !important; overflow-wrap: normal !important; word-wrap: normal !important;');
            Array.from(li.childNodes).forEach(child => inlineWrapper.appendChild(child));
            li.appendChild(inlineWrapper);
        }
    });

    // 4. Force Inheritance
    // WeChat's editor aggressively overrides inherited fonts on <p>, <li>, etc.
    // So we manually distribute the container's font properties to all individual blocks.
    const fontMatch = containerStyle.match(/font-family:\s*([^;]+);/);
    const sizeMatch = containerStyle.match(/font-size:\s*([^;]+);/);
    const colorMatch = containerStyle.match(/color:\s*([^;]+);/);
    const lineHeightMatch = containerStyle.match(/line-height:\s*([^;]+);/);

    // We only enforce on specific text tags that WeChat likes to hijack
    const textNodes = section.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, span');
    textNodes.forEach(node => {
        // Preserve code highlighting tokens inside code blocks.
        if (node.tagName === 'SPAN' && node.closest('pre, code')) return;

        let currentStyle = node.getAttribute('style') || '';

        if (fontMatch && !currentStyle.includes('font-family:')) {
            currentStyle += ` font-family: ${fontMatch[1]};`;
        }
        if (lineHeightMatch && !currentStyle.includes('line-height:')) {
            currentStyle += ` line-height: ${lineHeightMatch[1]};`;
        }
        // Add font-size if not present (only for standard text nodes so we don't shrink headings)
        if (sizeMatch && !currentStyle.includes('font-size:') && ['P', 'LI', 'BLOCKQUOTE', 'SPAN'].includes(node.tagName)) {
            currentStyle += ` font-size: ${sizeMatch[1]};`;
        }
        if (colorMatch && !currentStyle.includes('color:')) {
            currentStyle += ` color: ${colorMatch[1]};`;
        }

        node.setAttribute('style', currentStyle.trim());
    });

    // Keep CJK punctuation attached to preceding inline emphasis in WeChat.
    // Example: <strong>标题</strong>：说明 -> <strong>标题：</strong>说明
    const inlineNodes = section.querySelectorAll('strong, b, em, span, a, code');
    inlineNodes.forEach(node => {
        const next = node.nextSibling;
        if (!next || next.nodeType !== Node.TEXT_NODE) return;
        const text = next.textContent || '';
        const match = text.match(/^\s*([：；，。！？、:])(.*)$/s);
        if (!match) return;

        const punct = match[1];
        const rest = match[2] || '';
        node.appendChild(doc.createTextNode(punct));
        if (rest) {
            next.textContent = rest;
        } else {
            next.parentNode?.removeChild(next);
        }
    });

    section.querySelectorAll('pre code').forEach(codeElement => {
        preserveCodeWhitespaceForWeChat(doc, codeElement);

        const shellElement = codeElement.closest('[data-code-shell="mac"]');
        if (shellElement) {
            const shellStyle = shellElement.getAttribute('style') || '';
            shellElement.setAttribute(
                'style',
                `${shellStyle}; width: 100% !important; max-width: 100% !important; box-sizing: border-box; overflow: hidden; ${noWrapOverride}`.trim()
            );

            const dotsElement = shellElement.querySelector('[data-code-dots="mac"]');
            if (dotsElement) {
                const dotColors = ['#ff5f57', '#febc2e', '#28c840'];
                dotsElement.innerHTML = '';
                dotColors.forEach(color => {
                    const dot = doc.createElement('span');
                    dot.textContent = '●';
                    dot.setAttribute('style', `color: ${color} !important; font-size: 22px; line-height: 1; display: inline-block; margin: 0 !important; padding: 0 !important; ${noWrapOverride}`);
                    dotsElement.appendChild(dot);
                });
                const dotsStyle = dotsElement.getAttribute('style') || '';
                dotsElement.setAttribute('style', `${dotsStyle}; gap: 0 !important; column-gap: 0 !important;`.trim());
                appendNoWrapStyle(dotsElement);
            }
        }

        const preElement = codeElement.closest('pre');
        if (preElement) {
            const preStyle = cleanCodeScrollLayerStyle(preElement.getAttribute('style') || '');
            preElement.setAttribute(
                'style',
                `${preStyle}; width: 100% !important; max-width: 100% !important; box-sizing: border-box; white-space: pre !important; word-break: keep-all !important; overflow-wrap: normal !important; word-wrap: normal !important; overflow-x: auto; overflow-y: hidden; border: none !important; background: transparent !important; background-color: transparent !important;`.trim()
            );
        }

        const currentStyle = cleanCodeScrollLayerStyle(codeElement.getAttribute('style') || '');
        codeElement.setAttribute(
            'style',
            `${currentStyle}; display: inline-block; min-width: max-content; white-space: nowrap !important; word-break: keep-all !important; overflow-wrap: normal !important; word-wrap: normal !important; border: none !important; background: transparent !important; background-color: transparent !important;`.trim()
        );

        codeElement.querySelectorAll('span').forEach(span => {
            const spanStyle = span.getAttribute('style') || '';
            span.setAttribute(
                'style',
                `${spanStyle}; white-space: nowrap !important; word-break: keep-all !important; overflow-wrap: normal !important; word-wrap: normal !important;`.trim()
            );
        });

        wrapCodeLinesForWeChat(doc, codeElement);
    });

    // 5. Convert all images to Base64 for safe WeChat pasting
    const imgs = Array.from(section.querySelectorAll('img'));
    await Promise.all(imgs.map(async img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('data:')) {
            const base64 = await getBase64Image(src);
            img.setAttribute('src', base64);
        }
    }));

    doc.body.innerHTML = '';
    doc.body.appendChild(section);

    // Prevent WeChat from breaking lines between inline emphasis and leading CJK punctuation.
    // Example: </strong>： should stay on the same line.
    let outputHtml = doc.body.innerHTML;
    outputHtml = outputHtml.replace(/(<\/(?:strong|b|em|span|a|code)>)\s*([：；，。！？、])/g, '$1\u2060$2');

    return outputHtml;
}
