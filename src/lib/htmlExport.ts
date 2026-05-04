import { cleanInternalAttributes } from './wechatCompat';

async function imageSourceToDataUrl(source: string): Promise<string> {
    if (source.startsWith('data:')) return source;

    const response = await fetch(source, { cache: 'default' });
    if (!response.ok) {
        throw new Error(`HTML 导出图片失败：HTTP ${response.status}`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
                return;
            }
            reject(new Error('HTML 导出图片失败：无法读取图片数据'));
        };
        reader.onerror = () => reject(new Error('HTML 导出图片失败：无法读取图片数据'));
        reader.readAsDataURL(blob);
    });
}

export async function prepareHtmlForExport(html: string): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanInternalAttributes(html), 'text/html');
    const images = Array.from(doc.querySelectorAll('img'));

    await Promise.all(images.map(async (image) => {
        const source = image.getAttribute('src') || '';
        const originalSource = image.getAttribute('data-original-src') || '';

        if (source.startsWith('blob:')) {
            image.setAttribute('src', await imageSourceToDataUrl(source));
        } else if (originalSource.startsWith('raphael-image://')) {
            throw new Error('HTML 导出图片失败：本地图片尚未解析为可导出的图片数据');
        } else if (source.startsWith('raphael-image://')) {
            throw new Error('HTML 导出图片失败：本地图片尚未解析为可导出的图片数据');
        }

        image.removeAttribute('data-original-src');
    }));

    return doc.body.innerHTML;
}
