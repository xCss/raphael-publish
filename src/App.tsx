import { useEffect, useState, useRef, useCallback } from 'react';
import { PenLine, Eye } from 'lucide-react';
import { md, preprocessMarkdown, applyTheme } from './lib/markdown';
import { markElementIndexes } from './lib/markdownIndexer';
import { makeWeChatCompatible } from './lib/wechatCompat';
import { THEMES } from './lib/themes';
import { defaultContent } from './defaultContent';
import { findImagePosition, selectTextAreaRange } from './lib/imageSelector';
import { findElementPosition, type ElementLocation } from './lib/markdownLocator';
import Header from './components/Header';
import PwaStatus from './components/PwaStatus';
import ThemeSelector from './components/ThemeSelector';
import Toolbar from './components/Toolbar';
import EditorPanel from './components/EditorPanel';
import PreviewPanel from './components/PreviewPanel';
import SettingsPanel from './components/SettingsPanel';
import Toast from './components/Toast';
import { DEFAULT_PREFERENCES, loadMarkdownDraft, loadPreferences, saveMarkdownDraft, savePreferences } from './lib/localDraft';
import { cleanupOrphanDraftImages, clearPersistedDraftImages, removeDraftImageReferencesFromMarkdown, resolveDraftImageReferencesInHtml, resolveDraftImageReferenceToObjectUrl } from './lib/imagePersistence';
import { checkAiModelAvailability, requestAiRewrite, type AiModelAvailabilityResult, type AiRewriteAction } from './lib/aiRewrite';
import { prepareHtmlForExport } from './lib/htmlExport';
import { createPdfExportContainer } from './lib/pdfExport';

export default function App() {
    const [preferences] = useState(() => loadPreferences(typeof window === 'undefined' ? undefined : window.localStorage, {
        ...DEFAULT_PREFERENCES,
        activeTheme: THEMES[0].id
    }));
    const [themeMode, setThemeMode] = useState<'light' | 'dark'>(preferences.themeMode);
    const [markdownInput, setMarkdownInput] = useState<string>(() => loadMarkdownDraft(typeof window === 'undefined' ? undefined : window.localStorage, defaultContent));
    const [renderedHtml, setRenderedHtml] = useState<string>('');
    const [activeTheme, setActiveTheme] = useState(preferences.activeTheme);
    const [copied, setCopied] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'pc'>(preferences.previewDevice);
    const [activePanel, setActivePanel] = useState<'editor' | 'preview'>('editor');
    const [scrollSyncEnabled, setScrollSyncEnabled] = useState(preferences.scrollSyncEnabled);
    const [persistPastedImages, setPersistPastedImages] = useState(preferences.persistPastedImages);
    const [keepImageReferencesOnDisable, setKeepImageReferencesOnDisable] = useState(preferences.keepImageReferencesOnDisable);
    const [relayAiRequests, setRelayAiRequests] = useState(preferences.relayAiRequests);
    const [aiWriting, setAiWriting] = useState(preferences.aiWriting);
    const [aiModelAvailability, setAiModelAvailability] = useState<AiModelAvailabilityResult>({ ok: false, message: '请先填写 BASE_URL、API_KEY 和 MODEL' });
    const [aiModelChecking, setAiModelChecking] = useState(false);
    const [aiRewritePending, setAiRewritePending] = useState(false);
    const [aiRewriteError, setAiRewriteError] = useState('');
    const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);
    const editorScrollRef = useRef<HTMLTextAreaElement>(null);
    const previewOuterScrollRef = useRef<HTMLDivElement>(null);
    const previewInnerScrollRef = useRef<HTMLDivElement>(null);
    const scrollSyncLockRef = useRef<'editor' | 'preview' | null>(null);
    const scrollLockReleaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', themeMode === 'dark');
    }, [themeMode]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            saveMarkdownDraft(window.localStorage, markdownInput);
        }, 300);

        return () => window.clearTimeout(timeoutId);
    }, [markdownInput]);

    useEffect(() => {
        if (!persistPastedImages) return;

        const timeoutId = window.setTimeout(() => {
            cleanupOrphanDraftImages(markdownInput).catch((err: unknown) => {
                console.warn('Failed to cleanup orphan pasted images:', err);
            });
        }, 2000);

        return () => window.clearTimeout(timeoutId);
    }, [markdownInput, persistPastedImages]);

    useEffect(() => {
        savePreferences(window.localStorage, {
            themeMode,
            activeTheme,
            previewDevice,
            scrollSyncEnabled,
            persistPastedImages,
            keepImageReferencesOnDisable,
            relayAiRequests,
            aiWriting
        });
    }, [themeMode, activeTheme, previewDevice, scrollSyncEnabled, persistPastedImages, keepImageReferencesOnDisable, relayAiRequests, aiWriting]);

    useEffect(() => {
        if (!aiWriting.baseUrl.trim() || !aiWriting.apiKey.trim() || !aiWriting.model.trim()) {
            setAiModelChecking(false);
            setAiModelAvailability({ ok: false, message: '请先填写 BASE_URL、API_KEY 和 MODEL' });
            return;
        }

        let cancelled = false;
        setAiModelChecking(true);
        const timeoutId = window.setTimeout(() => {
            checkAiModelAvailability({ aiWriting, relayAiRequests })
                .then((result) => {
                    if (!cancelled) setAiModelAvailability(result);
                })
                .catch((err: unknown) => {
                    if (!cancelled) setAiModelAvailability({ ok: false, message: err instanceof Error ? err.message : '模型检测失败' });
                })
                .finally(() => {
                    if (!cancelled) setAiModelChecking(false);
                });
        }, 500);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [aiWriting, relayAiRequests]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const toggleTheme = () => {
        setThemeMode((prev) => {
            return prev === 'light' ? 'dark' : 'light';
        });
    };

    const handlePersistPastedImagesChange = (enabled: boolean) => {
        if (enabled || !persistPastedImages) {
            setPersistPastedImages(enabled);
            return;
        }

        const shouldDisable = window.confirm('关闭后将清空本地保存的粘贴图片，当前文章中的本地图片可能无法继续预览。确定关闭吗？');
        if (!shouldDisable) return;

        if (!keepImageReferencesOnDisable) {
            setMarkdownInput((currentMarkdown) => removeDraftImageReferencesFromMarkdown(currentMarkdown));
        }
        setPersistPastedImages(false);
        clearPersistedDraftImages().catch((err: unknown) => {
            console.warn('Failed to clear pasted image storage:', err);
        });
    };

    useEffect(() => {
        let cancelled = false;
        let objectUrls: string[] = [];

        // Core rendering: markdown → HTML → styled HTML
        const rawHtml = md.render(preprocessMarkdown(markdownInput));
        const styledHtml = applyTheme(rawHtml, activeTheme);

        // Enhancement layer: add index markers for click-to-locate
        // This is decoupled from core rendering logic
        const indexedHtml = markElementIndexes(styledHtml);

        resolveDraftImageReferencesInHtml(indexedHtml, resolveDraftImageReferenceToObjectUrl)
            .then((result) => {
                if (cancelled) {
                    result.objectUrls.forEach((url) => URL.revokeObjectURL(url));
                    return;
                }
                objectUrls = result.objectUrls;
                setRenderedHtml(result.html);
            })
            .catch((err: unknown) => {
                console.warn('Failed to resolve persisted image previews:', err);
                if (!cancelled) setRenderedHtml(indexedHtml);
            });

        return () => {
            cancelled = true;
            objectUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [markdownInput, activeTheme]);

    useEffect(() => {
        if (!scrollSyncEnabled) {
            scrollSyncLockRef.current = null;
            if (scrollLockReleaseTimeoutRef.current) {
                clearTimeout(scrollLockReleaseTimeoutRef.current);
                scrollLockReleaseTimeoutRef.current = null;
            }
        }
    }, [scrollSyncEnabled]);

    useEffect(() => {
        scrollSyncLockRef.current = null;
        if (scrollLockReleaseTimeoutRef.current) {
            clearTimeout(scrollLockReleaseTimeoutRef.current);
            scrollLockReleaseTimeoutRef.current = null;
        }
    }, [previewDevice]);

    useEffect(() => {
        return () => {
            if (scrollLockReleaseTimeoutRef.current) {
                clearTimeout(scrollLockReleaseTimeoutRef.current);
            }
        };
    }, []);

    const getActivePreviewScrollElement = () => {
        if (previewDevice === 'pc') return previewOuterScrollRef.current;
        return previewInnerScrollRef.current;
    };

    const syncScrollPosition = (
        sourceElement: HTMLElement,
        targetElement: HTMLElement,
        sourcePanel: 'editor' | 'preview'
    ) => {
        if (!scrollSyncEnabled) return;
        if (scrollSyncLockRef.current && scrollSyncLockRef.current !== sourcePanel) return;

        const sourceMaxScroll = sourceElement.scrollHeight - sourceElement.clientHeight;
        const targetMaxScroll = targetElement.scrollHeight - targetElement.clientHeight;
        if (sourceMaxScroll <= 0) {
            targetElement.scrollTop = 0;
            return;
        }

        const scrollRatio = sourceElement.scrollTop / sourceMaxScroll;
        scrollSyncLockRef.current = sourcePanel;
        targetElement.scrollTop = scrollRatio * Math.max(targetMaxScroll, 0);

        if (scrollLockReleaseTimeoutRef.current) {
            clearTimeout(scrollLockReleaseTimeoutRef.current);
        }

        scrollLockReleaseTimeoutRef.current = setTimeout(() => {
            if (scrollSyncLockRef.current === sourcePanel) {
                scrollSyncLockRef.current = null;
            }
            scrollLockReleaseTimeoutRef.current = null;
        }, 50);
    };

    const handleEditorScroll = () => {
        const editorElement = editorScrollRef.current;
        const previewElement = getActivePreviewScrollElement();
        if (!editorElement || !previewElement) return;
        syncScrollPosition(editorElement, previewElement, 'editor');
    };

    const handlePreviewOuterScroll = () => {
        if (previewDevice !== 'pc') return;
        const previewElement = previewOuterScrollRef.current;
        const editorElement = editorScrollRef.current;
        if (!previewElement || !editorElement) return;
        syncScrollPosition(previewElement, editorElement, 'preview');
    };

    const handlePreviewInnerScroll = () => {
        if (previewDevice === 'pc') return;
        const previewElement = previewInnerScrollRef.current;
        const editorElement = editorScrollRef.current;
        if (!previewElement || !editorElement) return;
        syncScrollPosition(previewElement, editorElement, 'preview');
    };

    const handleCopy = async () => {
        if (!previewRef.current) return;
        setIsCopying(true);
        try {
            const finalHtmlForCopy = await makeWeChatCompatible(renderedHtml, activeTheme);

            const blob = new Blob([finalHtmlForCopy], { type: 'text/html' });
            const textBlob = new Blob([previewRef.current.innerText], { type: 'text/plain' });

            const clipboardItem = new ClipboardItem({
                'text/html': blob,
                'text/plain': textBlob
            });
            await navigator.clipboard.write([clipboardItem]);

            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed', err);
            alert(err instanceof Error ? err.message : '复制格式失败，请检查浏览器剪贴板权限');
        } finally {
            setIsCopying(false);
        }
    };

    const handleExportHtml = async () => {
        try {
            const exportHtml = await prepareHtmlForExport(renderedHtml);
            const blob = new Blob([exportHtml], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Raphael_Article_${new Date().getTime()}.html`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('HTML export failed', err);
            alert(err instanceof Error ? err.message : '导出 HTML 失败，请检查图片是否可访问');
        }
    };

    const handleExportPdf = async () => {
        if (!previewRef.current) return;
        const { default: html2pdf } = await import('html2pdf.js');
        const element = previewRef.current;
        const backgroundColor = document.documentElement.classList.contains('dark') ? '#000000' : '#ffffff';
        const opt = {
            margin: 10,
            filename: `Raphael_Article_${new Date().getTime()}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor },
            jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const }
        };
        const cloneContainer = createPdfExportContainer(element, backgroundColor);

        document.body.appendChild(cloneContainer);
        try {
            await html2pdf().set(opt).from(cloneContainer).save();
        } finally {
            cloneContainer.remove();
        }
    };

    const handleImageClick = useCallback((info: { type: string; index: number; src?: string; alt?: string; content?: string }) => {
        if (!editorScrollRef.current) return;

        let location: ElementLocation | null = null;

        // Images use specialized positioning
        if (info.type === 'image' && info.src) {
            const match = findImagePosition(markdownInput, info.src, info.alt || '');
            if (match) {
                // Add type field to match ElementLocation interface
                location = {
                    start: match.start,
                    end: match.end,
                    type: 'image'
                };
            }
        } else {
            // Other elements use generic positioning
            location = findElementPosition(markdownInput, info.type, '', info.index);
        }

        if (location) {
            // Always select the entire content - consistent user experience
            selectTextAreaRange(editorScrollRef.current, location.start, location.end);

            // Switch to editor panel on mobile
            if (window.innerWidth < 768 && activePanel !== 'editor') {
                setActivePanel('editor');
            }
        }
    }, [markdownInput, activePanel]);

    const getSelectionContext = useCallback((start: number, end: number) => {
        const contextStart = Math.max(0, start - 500);
        const contextEnd = Math.min(markdownInput.length, end + 500);
        return markdownInput.slice(contextStart, contextEnd);
    }, [markdownInput]);

    const handleSelectionAiAction = useCallback(async (action: AiRewriteAction, range: { start: number; end: number; text: string }) => {
        setAiRewriteError('');

        if (markdownInput.slice(range.start, range.end) !== range.text) {
            setAiRewriteError('选区内容已变化，请重新选择后再使用 AI。');
            return;
        }

        setAiRewritePending(true);
        try {
            const replacement = await requestAiRewrite({
                aiWriting,
                action,
                selectedText: range.text,
                context: getSelectionContext(range.start, range.end),
                relayAiRequests
            });
            setMarkdownInput((currentMarkdown) => {
                const isWholeDocumentRange = range.start === 0 && range.end === range.text.length;
                const currentTargetText = isWholeDocumentRange
                    ? currentMarkdown
                    : currentMarkdown.slice(range.start, range.end);
                if (currentTargetText !== range.text) {
                    setAiRewriteError(isWholeDocumentRange ? '正文内容已变化，已保留你的最新编辑。' : '选区内容已变化，请重新选择后再使用 AI。');
                    return currentMarkdown;
                }

                return currentMarkdown.slice(0, range.start) +
                    replacement +
                    currentMarkdown.slice(range.end);
            });
        } catch (err) {
            setAiRewriteError(err instanceof Error ? err.message : 'AI 改写失败，请检查配置和网络。');
        } finally {
            setAiRewritePending(false);
        }
    }, [aiWriting, getSelectionContext, markdownInput, relayAiRequests]);

    const handleEditorAiAction = useCallback((action: AiRewriteAction, range: { start: number; end: number; text: string } | null) => {
        const effectiveRange = range ?? { start: 0, end: markdownInput.length, text: markdownInput };
        if (!effectiveRange.text.trim()) {
            setAiRewriteError('没有可供 AI 处理的正文内容。');
            return;
        }
        void handleSelectionAiAction(action, effectiveRange);
    }, [handleSelectionAiAction, markdownInput]);

    const deviceWidthClass = () => {
        if (previewDevice === 'mobile') return 'w-[520px] max-w-full';
        if (previewDevice === 'tablet') return 'w-[800px] max-w-full';
        return 'w-[840px] xl:w-[1024px] max-w-[95%]';
    };

    const gridLayoutClass = () => {
        if (previewDevice === 'mobile') return 'md:grid-cols-[55fr_45fr]';
        if (previewDevice === 'tablet') return 'md:grid-cols-[45fr_55fr]';
        return 'md:grid-cols-[38.2fr_61.8fr]';
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden antialiased bg-[#fbfbfd] dark:bg-black transition-colors duration-300">

            <Header themeMode={themeMode} onToggleTheme={toggleTheme} onOpenSettings={() => setIsSettingsOpen(true)} />

            <PwaStatus isOnline={isOnline} />
            {aiRewriteError && (
                <Toast
                    message={aiRewriteError}
                    variant="error"
                    onDismiss={() => setAiRewriteError('')}
                    dismissLabel="关闭 AI 提示"
                    testId="ai-rewrite-toast"
                />
            )}

            <SettingsPanel
                open={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                persistPastedImages={persistPastedImages}
                onPersistPastedImagesChange={handlePersistPastedImagesChange}
                keepImageReferencesOnDisable={keepImageReferencesOnDisable}
                onKeepImageReferencesOnDisableChange={setKeepImageReferencesOnDisable}
                scrollSyncEnabled={scrollSyncEnabled}
                onScrollSyncEnabledChange={setScrollSyncEnabled}
                relayAiRequests={relayAiRequests}
                onRelayAiRequestsChange={setRelayAiRequests}
                aiWriting={aiWriting}
                onAiWritingChange={setAiWriting}
                aiModelAvailability={aiModelAvailability}
                aiModelChecking={aiModelChecking}
            />

            {/* 移动端 Tab 切换 */}
            <div className="md:hidden glass-toolbar flex items-center z-[90]">
                <button
                    data-testid="tab-editor"
                    onClick={() => setActivePanel('editor')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold transition-colors border-b-2 ${activePanel === 'editor' ? 'text-[#0066cc] dark:text-[#0a84ff] border-[#0066cc] dark:border-[#0a84ff]' : 'text-[#86868b] dark:text-[#a1a1a6] border-transparent'}`}
                >
                    <PenLine size={15} />
                    编辑
                </button>
                <button
                    data-testid="tab-preview"
                    onClick={() => setActivePanel('preview')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold transition-colors border-b-2 ${activePanel === 'preview' ? 'text-[#0066cc] dark:text-[#0a84ff] border-[#0066cc] dark:border-[#0a84ff]' : 'text-[#86868b] dark:text-[#a1a1a6] border-transparent'}`}
                >
                    <Eye size={15} />
                    预览
                </button>
            </div>

            {/* 排版设置 & 工具栏 (桌面端) */}
            <div className={`glass-toolbar hidden md:grid grid-cols-1 ${gridLayoutClass()} px-0 z-[90] transition-all duration-500`}>
                <ThemeSelector activeTheme={activeTheme} onThemeChange={setActiveTheme} />
                <Toolbar
                    previewDevice={previewDevice}
                    onDeviceChange={setPreviewDevice}
                    onExportPdf={handleExportPdf}
                    onExportHtml={handleExportHtml}
                    onCopy={handleCopy}
                    copied={copied}
                    isCopying={isCopying}
                />
            </div>

            {/* 移动端工具栏：分两行避免按钮被主题栏挤出可视区 */}
            <div className="md:hidden glass-toolbar z-[90]">
                <div className="overflow-x-auto no-scrollbar border-b border-[#00000010] dark:border-[#ffffff10]">
                    <ThemeSelector activeTheme={activeTheme} onThemeChange={setActiveTheme} />
                </div>
                <Toolbar
                    previewDevice={previewDevice}
                    onDeviceChange={setPreviewDevice}
                    onExportPdf={handleExportPdf}
                    onExportHtml={handleExportHtml}
                    onCopy={handleCopy}
                    copied={copied}
                    isCopying={isCopying}
                />
            </div>

            {/* 编辑区 & 预览区 */}
            <main className={`flex-1 overflow-hidden grid grid-cols-1 ${gridLayoutClass()} relative transition-all duration-500`}>
                <div className={`${activePanel === 'editor' ? 'flex' : 'hidden'} md:flex flex-col overflow-hidden`}>
                    <EditorPanel
                        markdownInput={markdownInput}
                        onInputChange={setMarkdownInput}
                        editorScrollRef={editorScrollRef}
                        onEditorScroll={handleEditorScroll}
                        scrollSyncEnabled={scrollSyncEnabled}
                        persistPastedImages={persistPastedImages}
                        aiRewritePending={aiRewritePending}
                        aiAvailable={aiModelAvailability.ok}
                        onAiSelectionAction={handleEditorAiAction}
                    />
                </div>
                <div className={`${activePanel === 'preview' ? 'flex' : 'hidden'} md:flex flex-col overflow-hidden`}>
                    <PreviewPanel
                        renderedHtml={renderedHtml}
                        deviceWidthClass={deviceWidthClass()}
                        previewDevice={previewDevice}
                        previewRef={previewRef}
                        previewOuterScrollRef={previewOuterScrollRef}
                        previewInnerScrollRef={previewInnerScrollRef}
                        onPreviewOuterScroll={handlePreviewOuterScroll}
                        onPreviewInnerScroll={handlePreviewInnerScroll}
                        scrollSyncEnabled={scrollSyncEnabled}
                        onImageClick={handleImageClick}
                    />
                </div>
            </main>

        </div>
    );
}
