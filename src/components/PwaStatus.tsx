import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { refreshServiceWorkerWithFallback } from '../lib/pwaRefresh';
import Toast from './Toast';

interface PwaStatusProps {
    isOnline: boolean;
}

export default function PwaStatus({ isOnline }: PwaStatusProps) {
    const [offlineToastDismissed, setOfflineToastDismissed] = useState(false);
    const [offlineReadyDismissed, setOfflineReadyDismissed] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
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
        if (!isOnline || !('serviceWorker' in navigator)) return;

        const checkForServiceWorkerUpdate = async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            await registration?.update();
        };

        const intervalId = window.setInterval(() => {
            checkForServiceWorkerUpdate().catch((error: unknown) => {
                console.warn('Service worker update check failed', error);
            });
        }, 30_000);

        return () => window.clearInterval(intervalId);
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
            ? '新版本已准备好'
            : '已可离线使用';

    const dismiss = () => {
        if (!isOnline) setOfflineToastDismissed(true);
        if (offlineReady) setOfflineReadyDismissed(true);
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    const refreshNow = () => {
        if (isUpdating) return;

        setIsUpdating(true);
        const serviceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
            ? navigator.serviceWorker
            : undefined;

        void refreshServiceWorkerWithFallback({
            updateServiceWorker,
            serviceWorker,
            reloadPage: () => window.location.reload()
        }).catch((error: unknown) => {
            console.warn('Service worker refresh failed', error);
        });
    };

    const variant = showOffline ? 'offline' : needRefresh ? 'refresh' : 'success';

    return (
        <Toast
            message={message}
            variant={variant}
            onDismiss={dismiss}
            dismissLabel="关闭 PWA 状态提示"
            testId="pwa-status"
            action={needRefresh && (
                <button
                    type="button"
                    onClick={refreshNow}
                    disabled={isUpdating}
                    aria-busy={isUpdating}
                    className="rounded-full bg-[#0066cc] px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-[#0052a3] disabled:cursor-wait disabled:opacity-70 dark:bg-[#0a84ff] dark:hover:bg-[#0070d9]"
                >
                    {isUpdating ? '更新中...' : '刷新'}
                </button>
            )}
        />
    );
}
