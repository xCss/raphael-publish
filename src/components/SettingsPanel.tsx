import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface SettingsPanelProps {
    open: boolean;
    onClose: () => void;
}

const sections = [
    {
        title: 'Appearance',
        description: '管理外观、主题和编辑体验偏好。'
    },
    {
        title: 'Drafts & Images',
        description: '控制本地草稿、粘贴图片持久化和存储清理。'
    },
    {
        title: 'AI Writing',
        description: '配置 BASE_URL、API_KEY 和 MODEL 后启用改写能力。'
    },
    {
        title: 'Quality Checks',
        description: '检查标题层级、图片 alt、段落长度和 AI 建议。'
    }
];

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);
        const handleChange = () => setMatches(mediaQuery.matches);

        handleChange();
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [query]);

    return matches;
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
    const isDesktopDrawer = useMediaQuery('(min-width: 640px)');
    const panelInitial = isDesktopDrawer ? { opacity: 0, x: 36 } : { opacity: 0, y: 28 };
    const panelAnimate = isDesktopDrawer ? { opacity: 1, x: 0 } : { opacity: 1, y: 0 };
    const panelExit = isDesktopDrawer ? { opacity: 0, x: 36 } : { opacity: 0, y: 28 };

    useEffect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[140]" aria-modal="true" role="dialog" aria-labelledby="settings-title">
                    <motion.button
                        type="button"
                        data-testid="settings-backdrop"
                        aria-label="关闭设置"
                        className="absolute inset-0 bg-black/20 dark:bg-black/45 backdrop-blur-[2px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.aside
                        data-testid="settings-panel"
                        data-variant={isDesktopDrawer ? 'desktop-drawer' : 'mobile-sheet'}
                        className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-hidden rounded-t-[28px] border border-black/10 bg-white/95 shadow-[0_-18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#1c1c1e]/95 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-l-[28px] sm:rounded-r-none sm:shadow-[-18px_0_60px_rgba(0,0,0,0.18)]"
                        initial={panelInitial}
                        animate={panelAnimate}
                        exit={panelExit}
                        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden" aria-hidden="true" />

                        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-5 dark:border-white/10 sm:px-6">
                            <div>
                                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#86868b] dark:text-[#a1a1a6]">Settings</p>
                                <h2 id="settings-title" className="mt-1 text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">设置</h2>
                                <p className="mt-1 text-sm text-[#86868b] dark:text-[#a1a1a6]">管理本地优先、图片和 AI 能力。</p>
                            </div>
                            <button
                                type="button"
                                data-testid="settings-close"
                                aria-label="关闭设置"
                                onClick={onClose}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-black/5 hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:bg-white/10 dark:hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="max-h-[calc(88dvh-154px)] space-y-3 overflow-y-auto px-5 py-4 sm:max-h-[calc(100dvh-154px)] sm:px-6">
                            {sections.map((section) => (
                                <section key={section.title} className="rounded-2xl border border-black/10 bg-[#f5f5f7]/80 p-4 dark:border-white/10 dark:bg-white/5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">{section.title}</h3>
                                            <p className="mt-1 text-[13px] leading-5 text-[#6e6e73] dark:text-[#a1a1a6]">{section.description}</p>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#86868b] shadow-sm dark:bg-[#2c2c2e] dark:text-[#a1a1a6]">Soon</span>
                                    </div>
                                </section>
                            ))}
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-black/10 bg-white/90 px-5 py-4 dark:border-white/10 dark:bg-[#1c1c1e]/90 sm:px-6">
                            <button type="button" onClick={onClose} className="h-11 rounded-full px-4 text-sm font-semibold text-[#86868b] transition-colors hover:bg-black/5 hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:bg-white/10 dark:hover:text-white">
                                取消
                            </button>
                            <button type="button" className="h-11 rounded-full bg-[#0066cc] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0052a3] dark:bg-[#0a84ff] dark:hover:bg-[#0070d9]">
                                保存设置
                            </button>
                        </div>
                    </motion.aside>
                </div>
            )}
        </AnimatePresence>
    );
}
