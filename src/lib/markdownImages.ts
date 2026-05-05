const REMOVED_IMAGE_MARKER = '\u0000RAPHAEL_REMOVED_IMAGE\u0000';

function normalizeRemovedImageSpacing(markdown: string) {
    const lines = markdown.split(/\r?\n/);
    const cleanedLines = lines.map((line) => {
            if (!line.includes(REMOVED_IMAGE_MARKER)) return line;
            if (line.trim() === REMOVED_IMAGE_MARKER) return '';

            return line
                .replace(new RegExp(`[ \\t]*${REMOVED_IMAGE_MARKER}[ \\t]*`, 'g'), ' ')
                .replace(/[ \t]+$/g, '');
        });

    return cleanedLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function removeMarkdownImagesBySource(
    markdown: string,
    shouldRemoveSource: (source: string) => boolean
) {
    const imagePattern = /!\[([^\]\n]*)\]\(([^)\n]+)\)/g;
    const withoutImages = markdown.replace(imagePattern, (fullMatch, _alt: string, destination: string) => {
        const source = destination.trim().split(/\s+(?=["'])/, 1)[0] ?? '';
        return shouldRemoveSource(source) ? REMOVED_IMAGE_MARKER : fullMatch;
    });

    return normalizeRemovedImageSpacing(withoutImages);
}
