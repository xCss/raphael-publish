import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSmartPaste, insertAtSelection } from './htmlToMarkdown';

describe('insertAtSelection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    function createTextarea(value: string) {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        document.body.appendChild(textarea);
        return textarea;
    }

    it('inserts text using the live textarea value so concurrent typing is preserved', () => {
        const textarea = createTextarea('START\nTYPED_AFTER_UPLOAD');
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;

        let nextValue = '';
        insertAtSelection(textarea, '\n![图片](data:image/png;base64,AAA)', (value) => {
            nextValue = value;
            textarea.value = value;
        });

        expect(nextValue).toBe('START\nTYPED_AFTER_UPLOAD\n![图片](data:image/png;base64,AAA)');
    });

    it('replaces the active selection and moves the caret after the inserted text', () => {
        const textarea = createTextarea('hello world');
        textarea.selectionStart = 6;
        textarea.selectionEnd = 11;

        let nextValue = '';
        insertAtSelection(textarea, 'Raphael', (value) => {
            nextValue = value;
            textarea.value = value;
        });

        expect(nextValue).toBe('hello Raphael');

        vi.runAllTimers();

        expect(textarea.selectionStart).toBe('hello Raphael'.length);
        expect(textarea.selectionEnd).toBe('hello Raphael'.length);
    });
});

describe('handleSmartPaste image files', () => {
    beforeEach(() => {
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => 'blob:http://localhost/pasted-image'),
            revokeObjectURL: vi.fn()
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('inserts blob object URLs instead of base64 data URLs for clipboard image files', () => {
        const textarea = document.createElement('textarea');
        textarea.value = '';
        document.body.appendChild(textarea);

        let nextValue = '';
        const imageFile = new File(['image-bytes'], 'paste.png', { type: 'image/png' });
        const event = {
            preventDefault: vi.fn(),
            currentTarget: textarea,
            clipboardData: {
                getData: vi.fn(() => ''),
                items: [
                    {
                        kind: 'file',
                        type: 'image/png',
                        getAsFile: () => imageFile
                    }
                ],
                files: []
            }
        } as unknown as React.ClipboardEvent<HTMLTextAreaElement>;

        handleSmartPaste(event, (value) => {
            nextValue = value;
        });

        expect(event.preventDefault).toHaveBeenCalled();
        expect(URL.createObjectURL).toHaveBeenCalledWith(imageFile);
        expect(nextValue).toBe('![图片](blob:http://localhost/pasted-image)');
        expect(nextValue).not.toContain('data:image');
    });

    it('revokes the previous pasted image URL after a replacement paste', () => {
        const textarea = document.createElement('textarea');
        textarea.value = '![旧截图](blob:http://localhost/old-image)';
        textarea.selectionStart = 0;
        textarea.selectionEnd = textarea.value.length;
        document.body.appendChild(textarea);

        const imageFile = new File(['image-bytes'], 'paste.png', { type: 'image/png' });
        const event = {
            preventDefault: vi.fn(),
            currentTarget: textarea,
            clipboardData: {
                getData: vi.fn(() => ''),
                items: [
                    {
                        kind: 'file',
                        type: 'image/png',
                        getAsFile: () => imageFile
                    }
                ],
                files: []
            }
        } as unknown as React.ClipboardEvent<HTMLTextAreaElement>;

        handleSmartPaste(event, (value) => {
            textarea.value = value;
        });

        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/old-image');
    });
});
