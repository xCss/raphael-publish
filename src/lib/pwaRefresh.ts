type TimeoutHandle = ReturnType<typeof window.setTimeout>;
type SetTimeoutFn = (handler: () => void, timeout: number) => TimeoutHandle;
type ClearTimeoutFn = (handle: TimeoutHandle) => void;

interface ServiceWorkerRefreshTarget {
    addEventListener(type: 'controllerchange', listener: EventListener, options?: AddEventListenerOptions | boolean): void;
    removeEventListener(type: 'controllerchange', listener: EventListener, options?: EventListenerOptions | boolean): void;
}

interface RefreshServiceWorkerWithFallbackOptions {
    updateServiceWorker: () => Promise<void>;
    reloadPage: () => void;
    serviceWorker?: ServiceWorkerRefreshTarget;
    fallbackDelayMs?: number;
    setTimeoutFn?: SetTimeoutFn;
    clearTimeoutFn?: ClearTimeoutFn;
}

export async function refreshServiceWorkerWithFallback({
    updateServiceWorker,
    reloadPage,
    serviceWorker,
    fallbackDelayMs = 1500,
    setTimeoutFn = window.setTimeout.bind(window),
    clearTimeoutFn = window.clearTimeout.bind(window)
}: RefreshServiceWorkerWithFallbackOptions) {
    let reloaded = false;
    let fallbackTimer: TimeoutHandle | undefined;

    function cleanup() {
        serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
        if (fallbackTimer !== undefined) {
            clearTimeoutFn(fallbackTimer);
            fallbackTimer = undefined;
        }
    }

    function reloadOnce() {
        if (reloaded) return;
        reloaded = true;
        cleanup();
        reloadPage();
    }

    const handleControllerChange: EventListener = () => {
        reloadOnce();
    };

    serviceWorker?.addEventListener('controllerchange', handleControllerChange, { once: true });
    fallbackTimer = setTimeoutFn(reloadOnce, fallbackDelayMs);

    await updateServiceWorker();
}
