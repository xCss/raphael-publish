export const MARKDOWN_DRAFT_STORAGE_KEY = 'raphael-publish:markdown-draft:v1';
export const PREFERENCES_STORAGE_KEY = 'raphael-publish:preferences:v1';

export type ThemeMode = 'light' | 'dark';
export type PreviewDevice = 'mobile' | 'tablet' | 'pc';

export interface AiWritingPreferences {
    baseUrl: string;
    apiKey: string;
    model: string;
}

export interface StoredPreferences {
    themeMode: ThemeMode;
    activeTheme: string;
    previewDevice: PreviewDevice;
    scrollSyncEnabled: boolean;
    persistPastedImages: boolean;
    keepImageReferencesOnDisable: boolean;
    relayAiRequests: boolean;
    aiWriting: AiWritingPreferences;
}

export const DEFAULT_PREFERENCES: StoredPreferences = {
    themeMode: 'light',
    activeTheme: 'mac',
    previewDevice: 'pc',
    scrollSyncEnabled: true,
    persistPastedImages: false,
    keepImageReferencesOnDisable: true,
    relayAiRequests: true,
    aiWriting: {
        baseUrl: '',
        apiKey: '',
        model: ''
    }
};

const blobImageMarkdownPattern = /^!\[[^\]\n]*\]\(blob:[^)\n]+\)\n*/gm;

function canUseStorage(storage: Storage | undefined): storage is Storage {
    return typeof storage !== 'undefined';
}

export function loadMarkdownDraft(storage: Storage | undefined, fallback: string) {
    if (!canUseStorage(storage)) return fallback;

    try {
        const savedDraft = storage.getItem(MARKDOWN_DRAFT_STORAGE_KEY);
        return savedDraft === null ? fallback : savedDraft;
    } catch {
        return fallback;
    }
}

export function saveMarkdownDraft(storage: Storage | undefined, draft: string) {
    if (!canUseStorage(storage)) return false;

    try {
        storage.setItem(MARKDOWN_DRAFT_STORAGE_KEY, draft.replace(blobImageMarkdownPattern, '').trimEnd());
        return true;
    } catch {
        return false;
    }
}

function isThemeMode(value: unknown): value is ThemeMode {
    return value === 'light' || value === 'dark';
}

function isPreviewDevice(value: unknown): value is PreviewDevice {
    return value === 'mobile' || value === 'tablet' || value === 'pc';
}

function isStoredPreferenceCandidate(value: unknown): value is Partial<StoredPreferences> {
    return typeof value === 'object' && value !== null;
}

function normalizeAiWritingPreferences(value: unknown, fallback: AiWritingPreferences) {
    if (typeof value !== 'object' || value === null) return fallback;
    const candidate = value as Partial<AiWritingPreferences>;

    return {
        baseUrl: typeof candidate.baseUrl === 'string' ? candidate.baseUrl : fallback.baseUrl,
        apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : fallback.apiKey,
        model: typeof candidate.model === 'string' ? candidate.model : fallback.model
    };
}

export function normalizePreferences(value: unknown, fallback: StoredPreferences = DEFAULT_PREFERENCES): StoredPreferences {
    if (!isStoredPreferenceCandidate(value)) return fallback;

    return {
        themeMode: isThemeMode(value.themeMode) ? value.themeMode : fallback.themeMode,
        activeTheme: typeof value.activeTheme === 'string' && value.activeTheme.length > 0 ? value.activeTheme : fallback.activeTheme,
        previewDevice: isPreviewDevice(value.previewDevice) ? value.previewDevice : fallback.previewDevice,
        scrollSyncEnabled: typeof value.scrollSyncEnabled === 'boolean' ? value.scrollSyncEnabled : fallback.scrollSyncEnabled,
        persistPastedImages: typeof value.persistPastedImages === 'boolean' ? value.persistPastedImages : fallback.persistPastedImages,
        keepImageReferencesOnDisable: typeof value.keepImageReferencesOnDisable === 'boolean' ? value.keepImageReferencesOnDisable : fallback.keepImageReferencesOnDisable,
        relayAiRequests: typeof value.relayAiRequests === 'boolean' ? value.relayAiRequests : fallback.relayAiRequests,
        aiWriting: normalizeAiWritingPreferences(value.aiWriting, fallback.aiWriting)
    };
}

export function loadPreferences(storage: Storage | undefined, fallback: StoredPreferences = DEFAULT_PREFERENCES) {
    if (!canUseStorage(storage)) return fallback;

    try {
        const rawValue = storage.getItem(PREFERENCES_STORAGE_KEY);
        if (rawValue === null) return fallback;
        return normalizePreferences(JSON.parse(rawValue), fallback);
    } catch {
        return fallback;
    }
}

export function savePreferences(storage: Storage | undefined, preferences: StoredPreferences) {
    if (!canUseStorage(storage)) return false;

    try {
        storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
        return true;
    } catch {
        return false;
    }
}
