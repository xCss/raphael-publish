import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

function buildLongMarkdown() {
    return Array.from({ length: 120 }, (_, index) => `## Section ${index + 1}\n\n这是第 ${index + 1} 段内容，用来验证编辑器和预览区的滚动同步是否稳定。\n\n`).join('');
}

async function waitForScrollableArea(page: import('@playwright/test').Page, testId: string) {
    await expect
        .poll(
            async () =>
                page.evaluate((id) => {
                    const element = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
                    if (!element) return -1;
                    return element.scrollHeight - element.clientHeight;
                }, testId),
            {
                timeout: 8000,
                intervals: [100, 150, 250]
            }
        )
        .toBeGreaterThan(200);
}

async function setScrollRatio(page: import('@playwright/test').Page, testId: string, ratio: number) {
    await page.evaluate(
        ([id, nextRatio]) => {
            const element = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
            if (!element) return;

            const maxScroll = element.scrollHeight - element.clientHeight;
            if (maxScroll <= 0) {
                element.scrollTop = 0;
                return;
            }

            element.scrollTop = maxScroll * nextRatio;
            element.dispatchEvent(new Event('scroll'));
        },
        [testId, ratio] as const
    );
}

async function scrollAndWaitForSync(
    page: import('@playwright/test').Page,
    sourceTestId: string,
    targetTestId: string,
    targetRatio: number
) {
    await expect
        .poll(
            async () => {
                await setScrollRatio(page, sourceTestId, targetRatio);

                return page.evaluate(([sourceId, targetId, expectedRatio]) => {
                    const source = document.querySelector(`[data-testid="${sourceId}"]`) as HTMLElement | null;
                    const target = document.querySelector(`[data-testid="${targetId}"]`) as HTMLElement | null;
                    if (!source || !target) return Number.POSITIVE_INFINITY;

                    const sourceMax = source.scrollHeight - source.clientHeight;
                    const targetMax = target.scrollHeight - target.clientHeight;
                    if (sourceMax <= 0 || targetMax <= 0) return Number.POSITIVE_INFINITY;

                    const sourceRatio = source.scrollTop / sourceMax;
                    const targetRatio = target.scrollTop / targetMax;

                    if (Math.abs(sourceRatio - expectedRatio) >= 0.06 || target.scrollTop <= 0) {
                        return Number.POSITIVE_INFINITY;
                    }

                    return Math.abs(targetRatio - expectedRatio);
                }, [sourceTestId, targetTestId, targetRatio] as const);
            },
            {
                timeout: 8000,
                intervals: [100, 150, 250]
            }
        )
        .toBeLessThan(0.12);
}

test('keeps the copy button visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.getByTestId('tab-preview').click();
    const copyButton = page.locator('[data-testid="copy-button"]:visible');

    await expect(copyButton).toBeVisible();

    const box = await copyButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});

test('renders bold text with punctuation without leaking markdown markers', async ({ page }) => {
    await page.goto('/');

    const editor = page.getByTestId('editor-input');
    await editor.fill('2025年初，伦敦黄金市场的一个月拆借利率一度升至**5%**。');

    const preview = page.getByTestId('preview-content');
    await expect(preview.locator('strong')).toHaveText('5%');
    await expect(preview).not.toContainText('**5%**');
    await expect(preview).toContainText('2025年初，伦敦黄金市场的一个月拆借利率一度升至5%。');
});

test('exports a non-blank PDF from the visible preview', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await expect(page.getByTestId('preview-content')).toContainText('Raphael Publish');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-testid="export-pdf"]:visible').click();
    const download = await downloadPromise;
    const pdfPath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(pdfPath);

    const pdfBytes = await readFile(pdfPath);

    expect(pdfBytes.length).toBeGreaterThan(10_000);
});

test('keeps the PDF export clone within the A4 printable width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await expect(page.getByTestId('preview-content')).toContainText('Raphael Publish');

    const widths = await page.evaluate(() => {
        const source = document.querySelector('[data-testid="preview-content"]') as HTMLElement | null;
        if (!source) return null;

        const clone = source.cloneNode(true) as HTMLElement;
        clone.style.width = '190mm';
        clone.style.maxWidth = '190mm';
        clone.style.minWidth = '0';
        const container = document.createElement('div');
        container.style.background = '#ffffff';
        container.style.width = '190mm';
        container.style.maxWidth = '190mm';
        container.style.minWidth = '0';
        container.appendChild(clone);
        document.body.appendChild(container);

        const cloneRect = clone.getBoundingClientRect();
        const result = {
            cloneWidth: cloneRect.width,
            containerWidth: container.getBoundingClientRect().width,
            scrollWidth: clone.scrollWidth
        };

        container.remove();
        return result;
    });

    expect(widths).not.toBeNull();
    expect(widths!.cloneWidth).toBeLessThanOrEqual(720);
    expect(widths!.containerWidth).toBeLessThanOrEqual(720);
    expect(widths!.scrollWidth).toBeLessThanOrEqual(Math.ceil(widths!.cloneWidth) + 1);
});

test('restores the local markdown draft after reload', async ({ page }) => {
    await page.goto('/');

    const editor = page.getByTestId('editor-input');
    await editor.fill('# 本地草稿\n\n断网也应该继续保留。');
    await expect
        .poll(() => page.evaluate(() => localStorage.getItem('raphael-publish:markdown-draft:v1')), {
            timeout: 2000,
            intervals: [100, 150, 250]
        })
        .toBe('# 本地草稿\n\n断网也应该继续保留。');

    await page.reload();
    await expect(page.getByTestId('editor-input')).toHaveValue('# 本地草稿\n\n断网也应该继续保留。');
});

test('opens settings without replacing the split editor and preview workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const editor = page.getByTestId('editor-input');
    await editor.fill('# 草稿\n\n![本地截图](raphael-image://draft/default/pasted-test-image)\n\n正文');

    await page.getByTestId('settings-button').click();

    const panel = page.getByTestId('settings-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-variant', 'desktop-drawer');
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Drafts & Images' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'AI Writing' })).toBeVisible();
    await expect(panel.getByRole('switch', { name: '滚动同步' })).toBeChecked();
    await expect(page.getByText('Quality Checks')).toBeHidden();
    await expect(page.locator('[data-testid="scroll-sync-toggle"]')).toHaveCount(0);
    await expect(page.getByTestId('editor-input')).toBeVisible();
    await expect(page.getByTestId('preview-content')).toBeVisible();

    await page.getByTestId('settings-close').click();
    await expect(panel).toBeHidden();
});

test('controls scroll sync from settings and persists preference', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await expect(page.locator('[data-testid="scroll-sync-toggle"]')).toHaveCount(0);

    await page.getByTestId('settings-button').click();
    const toggle = page.getByRole('switch', { name: '滚动同步' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeChecked();

    await toggle.click();
    await expect(toggle).not.toBeChecked();

    await page.reload();
    await page.getByTestId('settings-button').click();

    await expect(page.getByRole('switch', { name: '滚动同步' })).not.toBeChecked();
});

test('opens settings as a mobile sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await page.getByTestId('settings-button').click();

    const panel = page.getByTestId('settings-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-variant', 'mobile-sheet');
    await expect(panel.getByRole('heading', { name: 'AI Writing' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
});

test('persists pasted image preference from settings', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const editor = page.getByTestId('editor-input');
    await editor.fill('# 草稿\n\n![本地截图](raphael-image://draft/default/pasted-test-image)\n\n正文');

    await page.getByTestId('settings-button').click();

    const toggle = page.getByRole('switch', { name: '本地保存粘贴图片' });
    await expect(toggle).toBeVisible();
    await expect(toggle).not.toBeChecked();

    await toggle.click();
    await expect(toggle).toBeChecked();

    await page.reload();
    await page.getByTestId('settings-button').click();

    await expect(page.getByRole('switch', { name: '本地保存粘贴图片' })).toBeChecked();
});

test('confirms before disabling pasted image storage and clears local images', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const editor = page.getByTestId('editor-input');
    await editor.fill('# 草稿\n\n![本地截图](raphael-image://draft/default/pasted-test-image)\n\n正文');

    await page.getByTestId('settings-button').click();

    const toggle = page.getByRole('switch', { name: '本地保存粘贴图片' });
    await toggle.click();
    await expect(toggle).toBeChecked();

    await page.evaluate(async () => {
        const request = indexedDB.open('raphael-publish:image-store:v1', 1);
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('draft-images')) {
                    const store = db.createObjectStore('draft-images', { keyPath: 'id' });
                    store.createIndex('draftId', 'draftId', { unique: false });
                }
            };
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction('draft-images', 'readwrite');
            transaction.objectStore('draft-images').put({
                id: 'pasted-test-image',
                draftId: 'default',
                blob: new Blob(['image-bytes'], { type: 'image/png' }),
                mimeType: 'image/png',
                size: 11,
                createdAt: Date.now(),
                lastUsedAt: Date.now()
            });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        database.close();
    });

    page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('清空本地保存的粘贴图片');
        await dialog.dismiss();
    });
    await toggle.click();
    await expect(toggle).toBeChecked();

    page.once('dialog', async (dialog) => {
        expect(dialog.message()).toContain('清空本地保存的粘贴图片');
        await dialog.accept();
    });
    await toggle.click();
    await expect(toggle).not.toBeChecked();

    await expect(editor).toHaveValue(/raphael-image:\/\/draft\/default\/pasted-test-image/);

    await expect.poll(() => page.evaluate(async () => {
        const request = indexedDB.open('raphael-publish:image-store:v1');
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
        const count = await new Promise<number>((resolve, reject) => {
            const transaction = database.transaction('draft-images', 'readonly');
            const countRequest = transaction.objectStore('draft-images').count();
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => reject(countRequest.error);
        });
        database.close();
        return count;
    })).toBe(0);
});

test('can remove local image references when disabling pasted image storage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const editor = page.getByTestId('editor-input');
    await editor.fill('# 草稿\n\n![本地截图](raphael-image://draft/default/pasted-test-image)\n\n正文');

    await page.getByTestId('settings-button').click();

    const storageToggle = page.getByRole('switch', { name: '本地保存粘贴图片' });
    await storageToggle.click();
    await expect(storageToggle).toBeChecked();

    const keepReferencesToggle = page.getByRole('switch', { name: '关闭缓存时保留 Markdown 图片引用' });
    await expect(keepReferencesToggle).toBeChecked();
    await keepReferencesToggle.click();
    await expect(keepReferencesToggle).not.toBeChecked();

    page.once('dialog', async (dialog) => {
        await dialog.accept();
    });
    await storageToggle.click();
    await expect(storageToggle).not.toBeChecked();
    await expect(editor).not.toHaveValue(/raphael-image:\/\/draft\/default\/pasted-test-image/);
    await expect(editor).toHaveValue(/正文/);
});

test('saves and clears local AI writing configuration', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await page.getByTestId('settings-button').click();

    await expect(page.getByRole('switch', { name: '转发 AI 请求' })).toBeChecked();
    await page.getByTestId('ai-base-url-input').fill('https://api.example.com/v1');
    await page.getByTestId('ai-api-key-input').fill('local-key');
    await page.getByTestId('ai-model-input').fill('gpt-4o-mini');
    await expect(page.getByTestId('settings-save')).toBeInViewport({ ratio: 1 });
    await page.getByTestId('settings-close').click();

    await page.reload();
    await page.getByTestId('settings-button').click();

    await expect(page.getByTestId('ai-base-url-input')).toHaveValue('https://api.example.com/v1');
    await expect(page.getByTestId('ai-api-key-input')).toHaveValue('local-key');
    await expect(page.getByTestId('ai-model-input')).toHaveValue('gpt-4o-mini');
    await expect(page.getByTestId('ai-config-warning')).toContainText('浏览器本地存储');

    await page.getByTestId('ai-config-clear').click();

    await expect(page.getByTestId('ai-base-url-input')).toHaveValue('');
    await expect(page.getByTestId('ai-api-key-input')).toHaveValue('');
    await expect(page.getByTestId('ai-model-input')).toHaveValue('');
});

test('formats selected editor text from the floating AI menu', async ({ page }) => {
    await page.route('https://relayx.bax.workers.dev/https://api.example.com/v1/chat/completions', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 350));
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ choices: [{ message: { content: '# Tailscale 五分钟入门\n\n家里 NAS、办公室服务器、海外 VPS 可以通过 Tailscale 互联。\n\n## 核心步骤\n\n- 注册账号\n- 每台机器安装客户端\n- 使用 MagicDNS 互访' } }] })
        });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await page.getByTestId('settings-button').click();
    await page.getByTestId('ai-base-url-input').fill('https://api.example.com/v1');
    await page.getByTestId('ai-api-key-input').fill('local-key');
    await page.getByTestId('ai-model-input').fill('gpt-4o-mini');
    await page.getByTestId('settings-close').click();

    const editor = page.getByTestId('editor-input');
    await editor.fill('家里 NAS、办公室服务器、海外 VPS、出差笔记本——想让它们像在同一个局域网里互访，过去要折腾路由器端口转发、DDNS、自建 FRP、申请证书……');
    await editor.focus();
    await page.evaluate(() => {
        const textarea = document.querySelector('[data-testid="editor-input"]') as HTMLTextAreaElement;
        textarea.setSelectionRange(0, textarea.value.length);
        textarea.dispatchEvent(new Event('select', { bubbles: true }));
    });

    await expect(page.getByTestId('editor-ai-trigger')).toBeVisible();
    await page.getByTestId('editor-ai-trigger').hover();
    await page.getByTestId('editor-ai-format').click();
    await expect(page.getByTestId('editor-ai-trigger')).toHaveAttribute('data-loading', 'true');

    await expect(editor).toHaveValue(/# Tailscale 五分钟入门/);
});

test('shows AI bot for a usable model and rewrites the whole document without selection', async ({ page }) => {
    await page.route('https://relayx.bax.workers.dev/https://api.example.com/v1/chat/completions', async (route) => {
        const body = route.request().postDataJSON() as { max_tokens?: number };
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                choices: [{ message: { content: body.max_tokens === 1 ? 'ok' : '# 全文已改写\n\n这是处理后的完整内容。' } }]
            })
        });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await page.getByTestId('settings-button').click();
    await page.getByTestId('ai-base-url-input').fill('https://api.example.com/v1');
    await page.getByTestId('ai-api-key-input').fill('local-key');
    await page.getByTestId('ai-model-input').fill('gpt-4o-mini');
    await expect(page.getByTestId('ai-model-status')).toHaveAttribute('data-status', 'available', { timeout: 5000 });
    await expect(page.getByTestId('ai-model-status')).toHaveAttribute('title', /模型可用/);
    await page.getByTestId('settings-close').click();

    const editor = page.getByTestId('editor-input');
    await editor.fill('第一段内容\n\n第二段内容');
    await editor.focus();
    await page.keyboard.press('ArrowRight');

    await expect(page.getByTestId('editor-ai-trigger')).toBeVisible();
    await page.getByTestId('editor-ai-trigger').click();
    await page.getByTestId('editor-ai-rewrite').click();

    await expect(editor).toHaveValue('# 全文已改写\n\n这是处理后的完整内容。');
});

test('keeps user edits made while a whole-document AI rewrite is pending', async ({ page }) => {
    await page.route('https://relayx.bax.workers.dev/https://api.example.com/v1/chat/completions', async (route) => {
        const body = route.request().postDataJSON() as { max_tokens?: number };
        if (body.max_tokens === 1) {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ choices: [{ message: { content: 'ok' } }] })
            });
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ choices: [{ message: { content: '# AI 旧结果' } }] })
        });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await page.getByTestId('settings-button').click();
    await page.getByTestId('ai-base-url-input').fill('https://api.example.com/v1');
    await page.getByTestId('ai-api-key-input').fill('local-key');
    await page.getByTestId('ai-model-input').fill('gpt-4o-mini');
    await expect(page.getByTestId('ai-model-status')).toHaveAttribute('data-status', 'available', { timeout: 5000 });
    await page.getByTestId('settings-close').click();

    const editor = page.getByTestId('editor-input');
    await editor.fill('准备改写的旧内容');
    await page.getByTestId('editor-ai-trigger').click();
    await page.getByTestId('editor-ai-rewrite').click();
    await expect(page.getByTestId('editor-ai-trigger')).toHaveAttribute('data-loading', 'true');

    await editor.fill('用户编辑的新内容');

    await expect(editor).toHaveValue('用户编辑的新内容');
    await expect(page.getByTestId('ai-rewrite-toast')).toContainText('正文内容已变化');
});

for (const device of [
    { testId: 'device-mobile', label: 'mobile' },
    { testId: 'device-tablet', label: 'tablet' }
] as const) {
    test(`syncs editor and ${device.label} preview scrolling in both directions`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');

        const editor = page.getByTestId('editor-input');
        await editor.fill(buildLongMarkdown());
        await page.locator(`[data-testid="${device.testId}"]:visible`).click();
        await waitForScrollableArea(page, 'editor-input');
        await waitForScrollableArea(page, 'preview-inner-scroll');

        await scrollAndWaitForSync(page, 'editor-input', 'preview-inner-scroll', 0.72);
        await scrollAndWaitForSync(page, 'preview-inner-scroll', 'editor-input', 0.28);
    });
}
