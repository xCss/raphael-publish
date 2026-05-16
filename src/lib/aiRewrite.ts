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

const NATURAL_EDITOR_SYSTEM_PROMPT = [
    '你是中文 Markdown 文章编辑，只返回替换后的 Markdown 正文。',
    '改稿目标：像作者本人在修改自己的草稿，而不是生成一篇崭新的 AI 范文。',
    '保留原文事实、观点、称谓、口吻、段落重心和 Markdown 语法；不要添加未提供的数据、案例或结论。',
    '避免 AI 套话：不要使用“总之、综上、值得一提的是、不难发现、可以说、在这个过程中、进一步来说”等模板化连接和拔高总结，除非原文已有。',
    '优先使用短句和具体表达；不要过度排比、广告腔、鸡汤化或宏大叙事。',
    '不要解释你的修改，不要添加代码围栏。'
].join('\n');

function getActionInstruction(action: AiRewriteAction) {
    if (action === 'format') {
        return [
            '将选中文本整理为适合微信公众号文章的 Markdown 结构。',
            '自动提取标题、段落、列表、表格和重点内容；修复复制粘贴造成的断行、空格和格式失效。',
            '只整理结构，不替作者补观点；不要编造事实，不要把朴素表达改成宣传文案。'
        ].join('\n');
    }
    if (action === 'expand') {
        return [
            '在保留原意、作者口吻和 Markdown 结构的基础上克制扩写。',
            '只补齐读者理解所需的背景、动作、例子或过渡；扩写量控制在原文约 1.2-1.6 倍，原文很短时最多增加 2-4 句。',
            '不要把文章拔高成行业趋势、时代意义或万能结论；不要新增具体数字、专有名词、引用来源或无法从上下文推出的事实。',
            '保留原文里有个性的说法，优先补具体细节，不要堆形容词。'
        ].join('\n');
    }
    return [
        '保留原意，改写选中文本，让表达更自然、清晰，适合公众号文章阅读。',
        '重点是修顺语序、删掉冗余、替换生硬词，保留原文的信息密度和个性表达。',
        '不要明显扩写，长度尽量保持在原文 80%-120%；不要改成“首先、其次、最后”式结构，除非原文已经如此。',
        '不要过度礼貌、过度完整或过度总结，让文字像真人编辑后的草稿。'
    ].join('\n');
}

function getActionRequestTuning(action: AiRewriteAction) {
    if (action === 'format') {
        return { temperature: 0.2, maxTokens: 1600 };
    }
    if (action === 'expand') {
        return { temperature: 0.45, maxTokens: 1600 };
    }
    return { temperature: 0.35, maxTokens: 1200 };
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
    const requestTuning = getActionRequestTuning(action);
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
                    content: NATURAL_EDITOR_SYSTEM_PROMPT
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
            temperature: requestTuning.temperature,
            max_tokens: requestTuning.maxTokens,
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
