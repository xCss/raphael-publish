import type { AiWritingPreferences } from './localDraft';

export type AiRewriteAction = 'format' | 'expand' | 'rewrite';

export const RELAYX_BASE_URL = 'https://relayx.bax.workers.dev';

interface RequestAiRewriteOptions {
    aiWriting: AiWritingPreferences;
    action: AiRewriteAction;
    selectedText: string;
    context: string;
    relayAiRequests?: boolean;
    fetchImpl?: typeof fetch;
}

interface CheckAiModelAvailabilityOptions {
    aiWriting: AiWritingPreferences;
    relayAiRequests?: boolean;
    fetchImpl?: typeof fetch;
}

export type AiModelAvailabilityResult = {
    ok: boolean;
    message: string;
};

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

export function wrapBaseUrlWithRelayx(baseUrl: string) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    if (normalizedBaseUrl.startsWith(`${RELAYX_BASE_URL}/`)) {
        return normalizedBaseUrl;
    }
    return `${RELAYX_BASE_URL}/${normalizedBaseUrl}`;
}

function getAiRequestBaseUrl(baseUrl: string, relayAiRequests: boolean) {
    return relayAiRequests ? wrapBaseUrlWithRelayx(baseUrl) : normalizeBaseUrl(baseUrl);
}

function getActionInstruction(action: AiRewriteAction) {
    if (action === 'format') {
        return '将选中文本整理为适合微信公众号文章的 Markdown 结构：自动提取标题、段落、列表、表格和重点内容；修复复制粘贴造成的断行/格式失效；不要编造事实。';
    }
    if (action === 'expand') {
        return '在保留原意和 Markdown 结构的基础上扩写选中文本，补充必要细节，让表达更完整。';
    }
    return '保留原意，改写选中文本，让表达更自然、清晰，适合公众号文章阅读。';
}

export async function requestAiRewrite({
    aiWriting,
    action,
    selectedText,
    context,
    relayAiRequests = false,
    fetchImpl = fetch
}: RequestAiRewriteOptions) {
    if (!aiWriting.baseUrl.trim() || !aiWriting.apiKey.trim() || !aiWriting.model.trim()) {
        throw new Error('请先配置 AI Writing 的 BASE_URL、API_KEY 和 MODEL');
    }

    const baseUrl = getAiRequestBaseUrl(aiWriting.baseUrl, relayAiRequests);
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aiWriting.apiKey}`
        },
        body: JSON.stringify({
            model: aiWriting.model,
            messages: [
                {
                    role: 'system',
                    content: 'You rewrite Markdown text. Return only the replacement text. Preserve the original meaning and Markdown syntax. Do not add explanations or code fences.'
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        instruction: getActionInstruction(action),
                        action,
                        selectedText,
                        context
                    })
                }
            ],
            temperature: 0.4,
            max_tokens: 1200,
            stream: false
        })
    });

    if (!response.ok) {
        throw new Error(`AI 请求失败：HTTP ${response.status}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const replacement = data.choices?.[0]?.message?.content?.trim();
    if (!replacement) {
        throw new Error('AI 返回为空，无法应用改写');
    }

    return replacement;
}

export async function checkAiModelAvailability({
    aiWriting,
    relayAiRequests = false,
    fetchImpl = fetch
}: CheckAiModelAvailabilityOptions): Promise<AiModelAvailabilityResult> {
    if (!aiWriting.baseUrl.trim() || !aiWriting.apiKey.trim() || !aiWriting.model.trim()) {
        return { ok: false, message: '请先填写 BASE_URL、API_KEY 和 MODEL' };
    }

    try {
        const baseUrl = getAiRequestBaseUrl(aiWriting.baseUrl, relayAiRequests);
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${aiWriting.apiKey}`
            },
            body: JSON.stringify({
                model: aiWriting.model,
                messages: [
                    { role: 'system', content: 'Reply with ok.' },
                    { role: 'user', content: 'ok' }
                ],
                temperature: 0,
                max_tokens: 1,
                stream: false
            })
        });

        if (!response.ok) {
            return { ok: false, message: `模型不可用：HTTP ${response.status}` };
        }

        return { ok: true, message: '模型可用' };
    } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : '模型检测失败' };
    }
}
