import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface PwaStatusProps {
    isOnline: boolean;
}

export default function PwaStatus({ isOnline }: PwaStatusProps) {
    const [offlineToastDismissed, setOfflineToastDismissed] = useState(false);
    const [offlineReadyDismissed, setOfflineReadyDismissed] = useState(false);
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker
    } = useRegisterSW({
        onRegisterError(error) {
            console.error('Service worker registration failed', error);
        }
    });

    useEffect(() => {
        if (isOnline) setOfflineToastDismissed(false);
    }, [isOnline]);

    useEffect(() => {
        if (!offlineReady || needRefresh) return;

        const timeoutId = window.setTimeout(() => {
            setOfflineReady(false);
            setOfflineReadyDismissed(true);
        }, 3500);

        return () => window.clearTimeout(timeoutId);
    }, [offlineReady, needRefresh, setOfflineReady]);

    const showOffline = !isOnline && !offlineToastDismissed;
    const showOfflineReady = offlineReady && !offlineReadyDismissed;
    const visible = showOffline || showOfflineReady || needRefresh;
    if (!visible) return null;

    const message = showOffline
        ? '当前离线，可继续编辑本地草稿'
        : needRefresh
            ? '新版本已准备好，刷新即可更新'
            : '已可离线使用';

    const dismiss = () => {
        if (!isOnline) setOfflineToastDismissed(true);
        if (offlineReady) setOfflineReadyDismissed(true);
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    const Icon = showOffline ? WifiOff : needRefresh ? RefreshCw : CheckCircle2;

    return (
        <div className="pointer-events-none fixed right-4 top-[76px] z-[120] flex max-w-[calc(100vw-2rem)] justify-end sm:right-6" aria-live="polite">
            <div className="pointer-events-auto flex max-w-[360px] items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/92 px-4 py-3 text-[13px] font-medium text-[#1d1d1f] shadow-[0_12px_40px_rgba(0,0,0,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1c1c1e]/92 dark:text-[#f5f5f7]" role="status" data-testid="pwa-status">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f5a000]/12 text-[#9a6400] dark:bg-[#ffd98a]/12 dark:text-[#ffd98a]">
                        <Icon size={15} />
                    </span>
                    <span className="truncate">{message}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {needRefresh && (
                        <button
                            type="button"
                            onClick={() => updateServiceWorker(true)}
                            className="rounded-full bg-[#0066cc] px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-[#0052a3] dark:bg-[#0a84ff] dark:hover:bg-[#0070d9]"
                        >
                            刷新
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={dismiss}
                        className="rounded-full p-1.5 text-[#86868b] transition-colors hover:bg-black/5 hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:bg-white/10 dark:hover:text-white"
                        aria-label="关闭 PWA 状态提示"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
