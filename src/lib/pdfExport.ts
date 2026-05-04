const PDF_CONTENT_WIDTH = '190mm';
const PAGE_BREAK_PROTECTED_SELECTORS = 'p, li, pre, blockquote, table, tr, img, h1, h2, h3, h4, h5, h6';

export function createPdfExportContainer(sourceElement: HTMLElement, backgroundColor: string): HTMLElement {
    const clonedElement = sourceElement.cloneNode(true) as HTMLElement;

    const elements = [clonedElement, ...Array.from(clonedElement.querySelectorAll('*'))];
    elements.forEach((element) => {
        element.removeAttribute('data-md-type');
        element.removeAttribute('data-md-index');

        if (element instanceof HTMLElement) {
            element.style.maxWidth = '100%';
            element.style.minWidth = '0';
            element.style.overflowWrap = 'anywhere';
            element.style.wordBreak = 'break-word';
        }
    });

    clonedElement.style.width = PDF_CONTENT_WIDTH;
    clonedElement.style.maxWidth = PDF_CONTENT_WIDTH;
    clonedElement.style.minWidth = '0';

    clonedElement.querySelectorAll(PAGE_BREAK_PROTECTED_SELECTORS).forEach((element) => {
        if (!(element instanceof HTMLElement)) return;
        element.style.breakInside = 'avoid';
        element.style.pageBreakInside = 'avoid';
    });

    const cloneContainer = document.createElement('div');
    cloneContainer.style.background = backgroundColor;
    cloneContainer.style.width = PDF_CONTENT_WIDTH;
    cloneContainer.style.maxWidth = PDF_CONTENT_WIDTH;
    cloneContainer.style.minWidth = '0';
    cloneContainer.appendChild(clonedElement);

    return cloneContainer;
}
