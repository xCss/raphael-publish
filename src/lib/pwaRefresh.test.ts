import { afterEach, describe, expect, test, vi } from 'vitest';
import { refreshServiceWorkerWithFallback } from './pwaRefresh';

describe('refreshServiceWorkerWithFallback', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    test('reloads via fallback when the service worker update does not navigate', async () => {
        vi.useFakeTimers();
        const updateServiceWorker = vi.fn(async () => {});
        const reloadPage = vi.fn();

        const refreshPromise = refreshServiceWorkerWithFallback({
            updateServiceWorker,
            reloadPage,
            fallbackDelayMs: 1500,
            setTimeoutFn: window.setTimeout
        });

        await refreshPromise;

        expect(updateServiceWorker).toHaveBeenCalledTimes(1);
        expect(reloadPage).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1500);

        expect(reloadPage).toHaveBeenCalledTimes(1);
    });
});
