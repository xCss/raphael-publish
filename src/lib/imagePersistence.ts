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

export interface ResolvedDraftImageHtml {
    html: string;
    objectUrls: string[];
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

function deleteImageRecord(database: IDBDatabase, imageId: string) {
    return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE_NAME, 'readwrite');
        transaction.objectStore(IMAGE_STORE_NAME).delete(imageId);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Failed to delete pasted image'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Image deletion was aborted'));
    });
}

function clearImageStore(database: IDBDatabase) {
    return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE_NAME, 'readwrite');
        transaction.objectStore(IMAGE_STORE_NAME).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Failed to clear pasted images'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Image store clearing was aborted'));
    });
}

function listDraftImageRecords(database: IDBDatabase, draftId: string) {
    return new Promise<DraftImageRecord[]>((resolve, reject) => {
        const transaction = database.transaction(IMAGE_STORE_NAME, 'readonly');
        const index = transaction.objectStore(IMAGE_STORE_NAME).index('draftId');
        const request = index.getAll(draftId);
        request.onsuccess = () => resolve((request.result as DraftImageRecord[] | undefined) ?? []);
        request.onerror = () => reject(request.error ?? new Error('Failed to list pasted images'));
        transaction.onerror = () => reject(transaction.error ?? new Error('Failed to list pasted images'));
    });
}

export function collectDraftImageReferenceIds(markdown: string, draftId = 'default') {
    const imageIds = new Set<string>();
    const referencePattern = /raphael-image:\/\/draft\/[^\s)"'<>]+/g;
    for (const match of markdown.matchAll(referencePattern)) {
        const parts = getDraftImageReferenceParts(match[0]);
        if (parts?.draftId === draftId) imageIds.add(parts.imageId);
    }
    return imageIds;
}

export function removeDraftImageReferencesFromMarkdown(markdown: string, draftId = 'default') {
    const lines = markdown.split(/\r?\n/);
    const filteredLines = lines.filter((line) => {
        const match = line.match(/^!\[[^\]]*\]\((raphael-image:\/\/draft\/[^)\s]+)\)$/);
        if (!match) return true;

        const parts = getDraftImageReferenceParts(match[1]);
        return parts?.draftId !== draftId;
    });

    return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
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

export async function clearPersistedDraftImages() {
    const database = await openImageDatabase();
    try {
        await clearImageStore(database);
    } finally {
        database.close();
    }
}

export async function cleanupOrphanDraftImages(markdown: string, draftId = 'default') {
    const referencedImageIds = collectDraftImageReferenceIds(markdown, draftId);
    const database = await openImageDatabase();
    try {
        const records = await listDraftImageRecords(database, draftId);
        const orphanRecords = records.filter((record) => !referencedImageIds.has(record.id));
        await Promise.all(orphanRecords.map((record) => deleteImageRecord(database, record.id)));
        return orphanRecords.length;
    } finally {
        database.close();
    }
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
): Promise<ResolvedDraftImageHtml> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = Array.from(doc.querySelectorAll('img'));
    const objectUrls: string[] = [];

    await Promise.all(images.map(async (image) => {
        const source = image.getAttribute('src') || '';
        if (!isDraftImageReference(source)) return;

        const resolvedSource = await resolveReference(source);
        if (!resolvedSource) return;

        image.setAttribute('data-original-src', source);
        image.setAttribute('src', resolvedSource);
        if (resolvedSource.startsWith('blob:')) objectUrls.push(resolvedSource);
    }));

    return { html: doc.body.innerHTML, objectUrls };
}
