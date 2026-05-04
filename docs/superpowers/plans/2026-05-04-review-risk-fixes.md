# Review Risk Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the highest-priority review risks without changing the app's core Markdown authoring workflow.

**Architecture:** Keep the current React/Vite client-only architecture. Make targeted changes at the existing trust boundaries: Markdown rendering, AI request validation, PDF/export cleanup, pasted-image object URL lifecycle, and Playwright selectors. Prefer small helpers in existing files over new abstractions unless a helper is needed for testability.

**Tech Stack:** React 18, TypeScript, Vite, markdown-it, Turndown, Vitest/jsdom, Playwright.

---

## File Structure

- Modify: `src/lib/markdown.ts` — disable raw HTML in `markdown-it` while preserving standard Markdown rendering and code highlighting.
- Modify: `src/lib/markdown.test.ts` — add regression tests for escaped raw HTML and unaffected standard Markdown.
- Modify: `src/lib/htmlToMarkdown.test.ts` — add regression tests proving `[Image 1]` placeholders remain suppressed and image files still become Markdown image syntax.
- Modify: `src/lib/aiRewrite.ts` — validate AI `baseUrl` before fetch.
- Modify: `src/lib/aiRewrite.test.ts` — add URL validation tests.
- Modify: `src/lib/imagePersistence.ts` — return resolved image object URLs plus metadata so callers can revoke generated URLs.
- Modify: `src/lib/imagePersistence.test.ts` — update expected return shape and add multi-image tracking test.
- Modify: `src/App.tsx` — revoke persisted-image object URLs on render cleanup, improve PDF cleanup with `try/finally`, and export durable image HTML where practical.
- Modify: `e2e/app.spec.ts` — update stale/ambiguous SettingsPanel locators.
- No commit should be created unless the user explicitly requests it.

---

### Task 1: Disable raw HTML without breaking normal Markdown or rich paste placeholders

**Files:**
- Modify: `src/lib/markdown.ts:6-9`
- Modify: `src/lib/markdown.test.ts`
- Modify: `src/lib/htmlToMarkdown.test.ts`

- [ ] **Step 1: Add failing Markdown safety tests**

Add tests to `src/lib/markdown.test.ts`:

```ts
describe('markdown html safety', () => {
    it('escapes raw html instead of rendering executable elements', () => {
        const html = renderMarkdown('<img src=x onerror="alert(1)"><script>alert(1)</script>');
        const doc = new DOMParser().parseFromString(html, 'text/html');

        expect(doc.querySelector('script')).toBeNull();
        expect(doc.querySelector('img')).toBeNull();
        expect(doc.body.textContent).toContain('<img src=x onerror="alert(1)">');
        expect(doc.body.textContent).toContain('<script>alert(1)</script>');
    });

    it('still renders standard markdown elements', () => {
        const html = renderMarkdown('# 标题\n\n**加粗**\n\n[链接](https://example.com)\n\n![图片](https://example.com/a.png)');
        const doc = new DOMParser().parseFromString(html, 'text/html');

        expect(doc.querySelector('h1')?.textContent).toBe('标题');
        expect(doc.querySelector('strong')?.textContent).toBe('加粗');
        expect(doc.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
        expect(doc.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png');
    });
});
```

- [ ] **Step 2: Add failing rich-paste placeholder regression test**

In `src/lib/htmlToMarkdown.test.ts`, ensure current behavior is explicitly protected:

```ts
test('suppresses clipboard image placeholders like [Image 1]', () => {
    const textarea = document.createElement('textarea');
    textarea.value = 'before';
    const setMarkdownInput = vi.fn();
    const event = createPasteEvent(textarea, {
        'text/plain': '[Image 1]'
    });

    handleSmartPaste(event, setMarkdownInput);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(setMarkdownInput).not.toHaveBeenCalled();
});
```

If the existing test helper uses a different shape, adapt the test to the existing helper rather than creating a parallel fixture.

- [ ] **Step 3: Run targeted tests and verify failure**

Run:

```bash
pnpm vitest run src/lib/markdown.test.ts src/lib/htmlToMarkdown.test.ts
```

Expected: the raw HTML test fails before implementation because raw HTML currently renders as DOM.

- [ ] **Step 4: Disable raw HTML**

Change `src/lib/markdown.ts`:

```ts
export const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
    highlight: function (str, lang) {
        // existing highlight implementation unchanged
    }
});
```

- [ ] **Step 5: Run targeted tests and verify pass**

Run:

```bash
pnpm vitest run src/lib/markdown.test.ts src/lib/htmlToMarkdown.test.ts
```

Expected: all targeted tests pass. Confirm `[Image 1]` placeholder behavior and normal Markdown rendering are unchanged.

---

### Task 2: Validate AI baseUrl before sending credentials/content

**Files:**
- Modify: `src/lib/aiRewrite.ts`
- Modify: `src/lib/aiRewrite.test.ts`

- [ ] **Step 1: Add failing validation tests**

Add tests to `src/lib/aiRewrite.test.ts`:

```ts
test('rejects invalid AI base URLs before calling fetch', async () => {
    const fetchImpl = vi.fn();

    await expect(requestAiRewrite({
        aiWriting: { baseUrl: 'notaurl', apiKey: 'local-key', model: 'gpt-4o-mini' },
        action: 'rewrite',
        selectedText: '原文内容',
        context: '原文内容',
        fetchImpl
    })).rejects.toThrow('AI BASE_URL 必须是有效的 URL');

    expect(fetchImpl).not.toHaveBeenCalled();
});

test('rejects non-HTTPS remote AI base URLs before calling fetch', async () => {
    const fetchImpl = vi.fn();

    await expect(requestAiRewrite({
        aiWriting: { baseUrl: 'http://api.example.com/v1', apiKey: 'local-key', model: 'gpt-4o-mini' },
        action: 'rewrite',
        selectedText: '原文内容',
        context: '原文内容',
        fetchImpl
    })).rejects.toThrow('AI BASE_URL 需要使用 HTTPS');

    expect(fetchImpl).not.toHaveBeenCalled();
});

test('allows localhost HTTP AI base URLs for local development', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
        choices: [{ message: { content: '本地改写' } }]
    }), { status: 200 }));

    const result = await requestAiRewrite({
        aiWriting: { baseUrl: 'http://localhost:8787', apiKey: 'local-key', model: 'gpt-4o-mini' },
        action: 'rewrite',
        selectedText: '原文内容',
        context: '原文内容',
        fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:8787/chat/completions', expect.any(Object));
    expect(result).toBe('本地改写');
});
```

- [ ] **Step 2: Run targeted test and verify failure**

Run:

```bash
pnpm vitest run src/lib/aiRewrite.test.ts
```

Expected: new validation tests fail before implementation.

- [ ] **Step 3: Implement URL normalization and validation**

In `src/lib/aiRewrite.ts`, replace `normalizeBaseUrl` with a validated helper:

```ts
function isLocalDevelopmentHost(hostname: string) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function normalizeBaseUrl(baseUrl: string) {
    let url: URL;
    try {
        url = new URL(baseUrl.trim());
    } catch {
        throw new Error('AI BASE_URL 必须是有效的 URL');
    }

    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalDevelopmentHost(url.hostname))) {
        throw new Error('AI BASE_URL 需要使用 HTTPS（本地 localhost 开发除外）');
    }

    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
}
```

Do not attempt to prove CORS during validation; actual CORS support is only knowable by making the browser request.

- [ ] **Step 4: Run targeted test and verify pass**

Run:

```bash
pnpm vitest run src/lib/aiRewrite.test.ts
```

Expected: all AI rewrite tests pass.

---

### Task 3: Track and revoke persisted image object URLs

**Files:**
- Modify: `src/lib/imagePersistence.ts`
- Modify: `src/lib/imagePersistence.test.ts`
- Modify: `src/App.tsx:91-114`

- [ ] **Step 1: Add failing image resolution metadata tests**

Update `src/lib/imagePersistence.test.ts` so `resolveDraftImageReferencesInHtml` returns an object:

```ts
test('returns resolved html and generated object urls', async () => {
    const html = '<p><img src="raphael-image://draft/default/pasted-image-1" alt="截图"></p>';

    const result = await resolveDraftImageReferencesInHtml(html, async () => 'blob:http://localhost/resolved-image');

    expect(result.html).toContain('src="blob:http://localhost/resolved-image"');
    expect(result.html).toContain('data-original-src="raphael-image://draft/default/pasted-image-1"');
    expect(result.objectUrls).toEqual(['blob:http://localhost/resolved-image']);
});
```

- [ ] **Step 2: Run targeted test and verify failure**

Run:

```bash
pnpm vitest run src/lib/imagePersistence.test.ts
```

Expected: test fails because the function currently returns a string.

- [ ] **Step 3: Return html plus objectUrls**

Change `src/lib/imagePersistence.ts`:

```ts
export interface ResolvedDraftImageHtml {
    html: string;
    objectUrls: string[];
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
```

- [ ] **Step 4: Revoke object URLs in App render effect cleanup**

Update `src/App.tsx:91-114`:

```ts
useEffect(() => {
    let cancelled = false;
    let objectUrls: string[] = [];

    const rawHtml = md.render(preprocessMarkdown(markdownInput));
    const styledHtml = applyTheme(rawHtml, activeTheme);
    const indexedHtml = markElementIndexes(styledHtml);

    resolveDraftImageReferencesInHtml(indexedHtml, resolveDraftImageReferenceToObjectUrl)
        .then((result) => {
            if (cancelled) {
                result.objectUrls.forEach((url) => URL.revokeObjectURL(url));
                return;
            }
            objectUrls = result.objectUrls;
            setRenderedHtml(result.html);
        })
        .catch((err: unknown) => {
            console.warn('Failed to resolve persisted image previews:', err);
            if (!cancelled) setRenderedHtml(indexedHtml);
        });

    return () => {
        cancelled = true;
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
}, [markdownInput, activeTheme]);
```

- [ ] **Step 5: Run targeted tests and LSP diagnostics**

Run:

```bash
pnpm vitest run src/lib/imagePersistence.test.ts
```

Then run LSP diagnostics on modified files. Expected: tests pass and no TypeScript errors.

---

### Task 4: Make PDF cleanup deterministic and keep HTML export durable

**Files:**
- Modify: `src/App.tsx:226-266`

- [ ] **Step 1: Inspect whether export helpers are already covered**

There are no direct `App.tsx` unit tests today. Keep this task implementation small and verify through build plus e2e smoke.

- [ ] **Step 2: Use original durable refs for HTML export**

In `handleExportHtml`, before creating the Blob, convert preview-only blob URLs back to durable `raphael-image://draft/...` references where `data-original-src` exists:

```ts
const handleExportHtml = () => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanInternalAttributes(renderedHtml), 'text/html');
    doc.querySelectorAll('img[data-original-src]').forEach((image) => {
        const originalSrc = image.getAttribute('data-original-src');
        if (originalSrc) image.setAttribute('src', originalSrc);
        image.removeAttribute('data-original-src');
    });

    const blob = new Blob([doc.body.innerHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Raphael_Article_${new Date().getTime()}.html`;
    a.click();
    URL.revokeObjectURL(url);
};
```

Note: durable `raphael-image://` URLs are app-internal references, not standalone external image files. Later Cloudflare Worker work can define a server-side export strategy if standalone image export is required.

- [ ] **Step 3: Make PDF cleanup use try/finally**

Update `handleExportPdf`:

```ts
document.body.appendChild(cloneContainer);
try {
    await html2pdf().set(opt).from(cloneContainer).save();
} finally {
    cloneContainer.remove();
}
```

- [ ] **Step 4: Run build**

Run:

```bash
pnpm build
```

Expected: build passes. Large chunk warning may remain and is not part of this task.

---

### Task 5: Fix stale and ambiguous Playwright SettingsPanel locators

**Files:**
- Modify: `e2e/app.spec.ts:124-204`

- [ ] **Step 1: Update desktop settings assertions**

Replace stale `Appearance` assertion with currently rendered sections:

```ts
await expect(panel.getByRole('heading', { name: 'Drafts & Images' })).toBeVisible();
await expect(panel.getByRole('heading', { name: 'AI Writing' })).toBeVisible();
await expect(page.getByText('Quality Checks')).toBeHidden();
```

- [ ] **Step 2: Scope mobile AI Writing assertion to settings panel**

Replace:

```ts
await expect(page.getByText('AI Writing')).toBeVisible();
```

with:

```ts
await expect(panel.getByRole('heading', { name: 'AI Writing' })).toBeVisible();
```

- [ ] **Step 3: Replace stale save button label**

The current SettingsPanel footer uses `完成`, not `保存设置`. Replace:

```ts
await expect(page.getByRole('button', { name: '保存设置' })).toBeInViewport({ ratio: 1 });
```

with:

```ts
await expect(page.getByTestId('settings-save')).toBeInViewport({ ratio: 1 });
```

- [ ] **Step 4: Run affected e2e tests first**

Run:

```bash
pnpm exec playwright test e2e/app.spec.ts:124 e2e/app.spec.ts:145 e2e/app.spec.ts:179 --workers=1
```

Expected: these three settings tests pass.

- [ ] **Step 5: Run full e2e suite**

Run:

```bash
pnpm test:e2e
```

Expected: all tests pass. If the mobile scroll navigation timeout recurs, rerun the single mobile scroll test with `--workers=1`; if it only fails under full parallel load, document it as a remaining flake and do not mix that fix into this task without new evidence.

---

### Task 6: Full verification

**Files:**
- All modified files.

- [ ] **Step 1: Run LSP diagnostics on modified source files**

Run diagnostics for:

- `src/lib/markdown.ts`
- `src/lib/aiRewrite.ts`
- `src/lib/imagePersistence.ts`
- `src/App.tsx`

Expected: zero errors.

- [ ] **Step 2: Run unit tests**

Run:

```bash
pnpm test
```

Expected: all Vitest tests pass.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: zero lint errors.

- [ ] **Step 4: Run build**

Run:

```bash
pnpm build
```

Expected: build passes. Existing large chunk warning may remain.

- [ ] **Step 5: Run e2e**

Run:

```bash
pnpm test:e2e
```

Expected: all Playwright tests pass, or any remaining flake is isolated with a single-test rerun and documented.

- [ ] **Step 6: Review git diff**

Run:

```bash
git diff -- src/lib/markdown.ts src/lib/markdown.test.ts src/lib/htmlToMarkdown.test.ts src/lib/aiRewrite.ts src/lib/aiRewrite.test.ts src/lib/imagePersistence.ts src/lib/imagePersistence.test.ts src/App.tsx e2e/app.spec.ts
```

Expected: diff contains only planned security/correctness/test changes.

- [ ] **Step 7: Do not commit unless explicitly requested**

The project instructions prohibit committing without an explicit user request. Report verification results and leave changes unstaged unless the user asks for a commit.
