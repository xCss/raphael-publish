const DRAFT_IMAGE_REFERENCE_PREFIX = 'raphael-image://draft/';
const DATABASE_NAME = 'raphael-publish:image-store:v1';
const DATABASE_VERSION = 1;
const IMAGE_STORE_NAME = 'draft-images';

function encodeReferencePart(value: string) {
    return encodeURIComponent(value.trim()).replace(/%2F/gi, '/');
}

export function createDraftImageReference(draftId: string, imageId: string) {
    return `${DRAFT_IMAGE_REFERENCE_PREFIX}${encodeReferencePart(draftId)}/${encodeReferencePart(imageId)}`;
}

export function isDraftImageReference(value: string) {
    return value.startsWith(DRAFT_IMAGE_REFERENCE_PREFIX) && value.slice(DRAFT_IMAGE_REFERENCE_PREFIX.length).split('/').filter(Boolean).length >= 2;
}

export function getDraftImageReferenceParts(value: string) {
    if (!isDraftImageReference(value)) return null;

    const [draftId, ...imageIdParts] = value.slice(DRAFT_IMAGE_REFERENCE_PREFIX.length).split('/').filter(Boolean);
    return {
        draftId: decodeURIComponent(draftId),
        imageId: decodeURIComponent(imageIdParts.join('/'))
    };
}

export interface DraftImageRecord {
    id: string;
    draftId: string;
    blob: Blob;
    mimeType: string;
    size: number;
    createdAt: number;
    lastUsedAt: number;
}

function getIndexedDB(): IDBFactory | undefined {
    return typeof indexedDB === 'undefined' ? undefined : indexedDB;
}

function openImageDatabase(factory = getIndexedDB()) {
    return new Promise<IDBDatabase>((resolve, reject) => {
        if (!factory) {
            reject(new Error('IndexedDB is unavailable'));
            return;
        }

        const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
                const store = database.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'id' });
                store.createIndex('draftId', 'draftId', { unique: false });
            }
        };
        request.onerror = () => reject(request.error ?? new Error('Failed to open image database'));
        request.onsuccess = () => resolve(request.result);
    });
}

function writeImageRecord(database: IDBDatabase, record: DraftImageRecord) {
    return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE_NAME, 'readwrite');
        transaction.objectStore(IMAGE_STORE_NAME).put(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Failed to store pasted image'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Image storage was aborted'));
    });
}

function readImageRecord(database: IDBDatabase, imageId: string) {
    return new Promise<DraftImageRecord | null>((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE_NAME, 'readonly');
        const request = transaction.objectStore(IMAGE_STORE_NAME).get(imageId);
        request.onsuccess = () => resolve((request.result as DraftImageRecord | undefined) ?? null);
        request.onerror = () => reject(request.error ?? new Error('Failed to read pasted image'));
        transaction.onerror = () => reject(transaction.error ?? new Error('Failed to read pasted image'));
    });
}

export async function persistDraftImage(file: File, draftId = 'default') {
    const imageId = `pasted-${Date.now()}-${crypto.randomUUID()}`;
    const now = Date.now();
    const database = await openImageDatabase();

    try {
        await writeImageRecord(database, {
            id: imageId,
            draftId,
            blob: file,
            mimeType: file.type,
            size: file.size,
            createdAt: now,
            lastUsedAt: now
        });
    } finally {
        database.close();
    }

    return createDraftImageReference(draftId, imageId);
}

export async function resolveDraftImageReferenceToObjectUrl(reference: string) {
    const parts = getDraftImageReferenceParts(reference);
    if (!parts) return null;

    const database = await openImageDatabase();
    try {
        const record = await readImageRecord(database, parts.imageId);
        return record ? URL.createObjectURL(record.blob) : null;
    } finally {
        database.close();
    }
}

export async function resolveDraftImageReferencesInHtml(
    html: string,
    resolveReference: (reference: string) => Promise<string | null>
) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = Array.from(doc.querySelectorAll('img'));

    await Promise.all(images.map(async (image) => {
        const source = image.getAttribute('src') || '';
        if (!isDraftImageReference(source)) return;

        const resolvedSource = await resolveReference(source);
        if (!resolvedSource) return;

        image.setAttribute('data-original-src', source);
        image.setAttribute('src', resolvedSource);
    }));

    return doc.body.innerHTML;
}
