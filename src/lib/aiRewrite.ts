import type { AiWritingPreferences } from './localDraft';

export type AiRewriteAction = 'format' | 'expand' | 'rewrite';

interface RequestAiRewriteOptions {
    aiWriting: AiWritingPreferences;
    action: AiRewriteAction;
    selectedText: string;
    context: string;
    fetchImpl?: typeof fetch;
}

function normalizeBaseUrl(baseUrl: string) {
    return baseUrl.replace(/\/+$/, '');
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
    fetchImpl = fetch
}: RequestAiRewriteOptions) {
    if (!aiWriting.baseUrl.trim() || !aiWriting.apiKey.trim() || !aiWriting.model.trim()) {
        throw new Error('请先配置 AI Writing 的 BASE_URL、API_KEY 和 MODEL');
    }

    const response = await fetchImpl(`${normalizeBaseUrl(aiWriting.baseUrl)}/chat/completions`, {
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
