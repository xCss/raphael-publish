import type { Dispatch, SetStateAction } from 'react';

type ServiceWorkerState = [boolean, Dispatch<SetStateAction<boolean>>];

interface MockRegisterSWState {
    offlineReady: ServiceWorkerState;
    needRefresh: ServiceWorkerState;
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

const noopSetter: Dispatch<SetStateAction<boolean>> = () => {};

const defaultState: MockRegisterSWState = {
    offlineReady: [false, noopSetter],
    needRefresh: [false, noopSetter],
    updateServiceWorker: async () => {}
};

let currentState = defaultState;

export function setMockRegisterSWState(nextState: MockRegisterSWState) {
    currentState = nextState;
}

export function resetMockRegisterSWState() {
    currentState = defaultState;
}

export function useRegisterSW() {
    return currentState;
}
