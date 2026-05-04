import React, { useEffect, useState } from 'react';
import { Bot, FileText, PenLine, Sparkles, Wand2 } from 'lucide-react';
import { handleSmartPaste } from '../lib/htmlToMarkdown';
import { persistDraftImage } from '../lib/imagePersistence';
import type { AiRewriteAction } from '../lib/aiRewrite';

interface EditorPanelProps {
    markdownInput: string;
    onInputChange: (value: string) => void;
    editorScrollRef: React.RefObject<HTMLTextAreaElement>;
    onEditorScroll: () => void;
    scrollSyncEnabled: boolean;
    persistPastedImages: boolean;
    aiRewritePending: boolean;
    aiAvailable: boolean;
    onAiSelectionAction: (action: AiRewriteAction, range: { start: number; end: number; text: string } | null) => void;
}

export default function EditorPanel({ markdownInput, onInputChange, editorScrollRef, onEditorScroll, scrollSyncEnabled, persistPastedImages, aiRewritePending, aiAvailable, onAiSelectionAction }: EditorPanelProps) {
    const [selectionRange, setSelectionRange] = useState<{ start: number; end: number; text: string } | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ right: 24, top: 24 });

    const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        handleSmartPaste(e, onInputChange, {
            persistImages: persistPastedImages,
            persistImage: persistPastedImages ? (file) => persistDraftImage(file) : undefined
        });
    };

    const updateSelection = (textarea: HTMLTextAreaElement) => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value.slice(start, end);

        if (start === end || !text.trim()) {
            setSelectionRange(null);
            if (!aiAvailable) setMenuOpen(false);
            return;
        }

        setSelectionRange({ start, end, text });
        setMenuStyle({ right: 24, top: 24 });
    };

    const runAction = (action: AiRewriteAction) => {
        setMenuOpen(false);
        onAiSelectionAction(action, selectionRange);
    };

    const aiActions: Array<{
        action: AiRewriteAction;
        testId: string;
        title: string;
        description: string;
        icon: React.ReactNode;
    }> = [
        {
            action: 'format',
            testId: 'editor-ai-format',
            title: '格式化',
            description: '整理结构与排版',
            icon: <FileText size={16} />
        },
        {
            action: 'expand',
            testId: 'editor-ai-expand',
            title: '扩写',
            description: '补充细节更完整',
            icon: <Sparkles size={16} />
        },
        {
            action: 'rewrite',
            testId: 'editor-ai-rewrite',
            title: '改写',
            description: '优化表达和语气',
            icon: <PenLine size={16} />
        }
    ];

    useEffect(() => {
        const syncSelection = () => {
            const textarea = editorScrollRef.current;
            if (!textarea || document.activeElement !== textarea) return;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value.slice(start, end);

            if (start === end || !text.trim()) {
                setSelectionRange(null);
                if (!aiAvailable) setMenuOpen(false);
                return;
            }

            setSelectionRange({ start, end, text });
            setMenuStyle({ right: 24, top: 24 });
        };

        document.addEventListener('selectionchange', syncSelection);
        return () => document.removeEventListener('selectionchange', syncSelection);
    }, [aiAvailable, editorScrollRef]);

    return (
        <div className="border-r border-[#00000015] dark:border-[#ffffff15] flex flex-col relative z-30 bg-transparent flex-1 min-h-0">
            <textarea
                ref={editorScrollRef}
                data-testid="editor-input"
                className="w-full flex-1 p-8 md:p-10 resize-none bg-transparent outline-none font-mono text-[15px] md:text-[16px] leading-[1.8] no-scrollbar text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] dark:placeholder-[#6e6e73]"
                value={markdownInput}
                onChange={(e) => onInputChange(e.target.value)}
                onPaste={onPaste}
                onSelect={(e) => updateSelection(e.currentTarget)}
                onMouseUp={(e) => updateSelection(e.currentTarget)}
                onKeyUp={(e) => updateSelection(e.currentTarget)}
                onTouchEnd={(e) => updateSelection(e.currentTarget)}
                onScroll={scrollSyncEnabled ? onEditorScroll : undefined}
                placeholder="在这里输入 Markdown 内容..."
                spellCheck={false}
            />

            {aiAvailable && markdownInput.trim() && (
                <div className="absolute z-[80]" style={menuStyle} onMouseEnter={() => setMenuOpen(true)}>
                    <button
                        type="button"
                        data-testid="editor-ai-trigger"
                        data-loading={aiRewritePending ? 'true' : 'false'}
                        aria-label="AI 选区工具"
                        aria-busy={aiRewritePending}
                        onClick={() => setMenuOpen(true)}
                        className={`relative flex h-10 w-10 items-center justify-center rounded-full bg-[#0066cc] text-white shadow-apple transition-transform hover:scale-105 dark:bg-[#0a84ff] ${aiRewritePending ? 'animate-pulse shadow-[0_0_0_8px_rgba(0,102,204,0.10)] dark:shadow-[0_0_0_8px_rgba(10,132,255,0.14)]' : ''}`}
                    >
                        {aiRewritePending && (
                            <span className="absolute inset-0 rounded-full bg-[#0066cc]/40 animate-ping dark:bg-[#0a84ff]/40" aria-hidden="true" />
                        )}
                        <Bot size={18} />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl border border-black/10 bg-white p-1 text-sm text-[#1d1d1f] shadow-apple-lg dark:border-white/10 dark:bg-[#2c2c2e] dark:text-[#f5f5f7]" onMouseLeave={() => setMenuOpen(false)}>
                            {aiActions.map((item) => (
                                <button
                                    key={item.action}
                                    type="button"
                                    data-testid={item.testId}
                                    onClick={() => runAction(item.action)}
                                    disabled={aiRewritePending}
                                    className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                                >
                                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#0a84ff]/15 dark:text-[#0a84ff]">
                                        {item.icon}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block font-semibold leading-5">{item.title}</span>
                                        <span className="block text-[12px] font-medium leading-4 text-[#86868b] dark:text-[#a1a1a6]">{item.description}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Action / Info Bar for Editor */}
            <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-[#00000010] dark:border-[#ffffff10] bg-[#fbfbfd]/50 dark:bg-[#1c1c1e]/50 backdrop-blur-md">
                <div className="flex items-center gap-2 min-w-0">
                    <Wand2 size={14} className="text-[#0066cc] dark:text-[#0a84ff] shrink-0" />
                    <span className="text-[12.5px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
                        <span className="hidden sm:inline">支持直接粘贴 <span className="text-[#86868b] dark:text-[#a1a1a6]">飞书、Notion或Word等</span> 富文本，自动净化为 Markdown</span>
                        <span className="sm:hidden">支持直接粘贴 <span className="text-[#86868b] dark:text-[#a1a1a6]">飞书、Notion或Word等</span> 富文本，自动转化</span>
                    </span>
                </div>
                <div className="text-[12px] font-mono text-[#86868b] dark:text-[#a1a1a6]">
                    {markdownInput.length} 字
                </div>
            </div>
        </div>
    );
}
