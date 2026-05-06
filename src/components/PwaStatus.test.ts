import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { resetMockRegisterSWState, setMockRegisterSWState } from '../test/mocks/virtualPwaRegisterReact';
import PwaStatus from './PwaStatus';

type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

const updateServiceWorker = vi.fn(async () => {});
const setNeedRefresh = vi.fn();
const setOfflineReady = vi.fn();

function useRefreshAvailableState() {
    setMockRegisterSWState({
        offlineReady: [false, setOfflineReady],
        needRefresh: [true, setNeedRefresh],
        updateServiceWorker
    });
}

describe('PwaStatus', () => {
    let container: HTMLDivElement;
    let root: ReturnType<typeof createRoot>;

    beforeEach(() => {
        vi.useFakeTimers();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        useRefreshAvailableState();
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        resetMockRegisterSWState();
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    test('shows progress after the refresh button is clicked', async () => {
        await act(async () => {
            root.render(React.createElement(PwaStatus, { isOnline: true }));
        });

        const refreshButton = container.querySelector('button:not([aria-label])') as HTMLButtonElement | null;
        expect(refreshButton).not.toBeNull();
        expect(refreshButton?.textContent).toContain('刷新');

        await act(async () => {
            refreshButton?.click();
        });

        expect(updateServiceWorker).toHaveBeenCalledTimes(1);
        expect(refreshButton?.disabled).toBe(true);
        expect(refreshButton?.textContent).toContain('更新中');
    });
});
