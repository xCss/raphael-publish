import { describe, expect, test, vi } from 'vitest';
import { checkAiModelAvailability, RELAYX_BASE_URL, requestAiRewrite, wrapBaseUrlWithRelayx } from './aiRewrite';

describe('requestAiRewrite', () => {
    test('wraps upstream base URLs with relayx without double wrapping', () => {
        expect(wrapBaseUrlWithRelayx('https://api.openai.com/v1')).toBe(`${RELAYX_BASE_URL}/https://api.openai.com/v1`);
        expect(wrapBaseUrlWithRelayx('https://api.openai.com/v1/')).toBe(`${RELAYX_BASE_URL}/https://api.openai.com/v1`);
        expect(wrapBaseUrlWithRelayx(`${RELAYX_BASE_URL}/https://api.openai.com/v1`)).toBe(`${RELAYX_BASE_URL}/https://api.openai.com/v1`);
    });

    test('sends an OpenAI-compatible chat completions request and returns replacement text', async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
            choices: [{ message: { content: '改写内容' } }]
        }), { status: 200 }));

        const result = await requestAiRewrite({
            aiWriting: {
                baseUrl: 'https://api.example.com/v1/',
                apiKey: 'local-key',
                model: 'gpt-4o-mini'
            },
            action: 'format',
            selectedText: '原文内容',
            context: '# 标题\n原文内容',
            fetchImpl
        });

        expect(fetchImpl).toHaveBeenCalledWith('https://api.example.com/v1/chat/completions', expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
                'Content-Type': 'application/json',
                Authorization: 'Bearer local-key'
            })
        }));
        expect(result).toBe('改写内容');
    });

    test('asks expand and rewrite actions to preserve the author voice with restrained wording', async () => {
        const requestBodies: Array<{
            messages: Array<{ role: string; content: string }>;
            temperature: number;
            max_tokens: number;
        }> = [];
        const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
            requestBodies.push(JSON.parse(String(init?.body ?? '{}')));
            return new Response(JSON.stringify({
                choices: [{ message: { content: '处理后的内容' } }]
            }), { status: 200 });
        });

        const aiWriting = {
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'local-key',
            model: 'gpt-4o-mini'
        };

        await requestAiRewrite({
            aiWriting,
            action: 'expand',
            selectedText: '原文内容',
            context: '# 标题\n原文内容',
            fetchImpl
        });
        await requestAiRewrite({
            aiWriting,
            action: 'rewrite',
            selectedText: '原文内容',
            context: '# 标题\n原文内容',
            fetchImpl
        });

        const [expandBody, rewriteBody] = requestBodies;
        const expandPayload = JSON.parse(expandBody.messages[1].content);
        const rewritePayload = JSON.parse(rewriteBody.messages[1].content);

        expect(expandBody.messages[0].content).toContain('像作者本人在修改自己的草稿');
        expect(expandPayload.instruction).toContain('扩写量控制');
        expect(expandPayload.instruction).toContain('不要把文章拔高');
        expect(expandBody.temperature).toBe(0.45);
        expect(expandBody.max_tokens).toBe(1600);

        expect(rewritePayload.instruction).toContain('保留原文的信息密度和个性表达');
        expect(rewritePayload.instruction).toContain('不要明显扩写');
        expect(rewriteBody.temperature).toBe(0.35);
        expect(rewriteBody.max_tokens).toBe(1200);
    });

    test('fails before calling fetch when AI settings are incomplete', async () => {
        const fetchImpl = vi.fn();

        await expect(requestAiRewrite({
            aiWriting: { baseUrl: '', apiKey: '', model: '' },
            action: 'rewrite',
            selectedText: '原文内容',
            context: '原文内容',
            fetchImpl
        })).rejects.toThrow('请先配置 AI Writing 的 BASE_URL、API_KEY 和 MODEL');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

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

    test('sends requests through relayx when forwarding is enabled', async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
            choices: [{ message: { content: '转发改写' } }]
        }), { status: 200 }));

        const result = await requestAiRewrite({
            aiWriting: { baseUrl: 'https://api.openai.com/v1', apiKey: 'local-key', model: 'gpt-4o-mini' },
            action: 'rewrite',
            selectedText: '原文内容',
            context: '原文内容',
            relayAiRequests: true,
            fetchImpl
        });

        expect(fetchImpl).toHaveBeenCalledWith(`${RELAYX_BASE_URL}/https://api.openai.com/v1/chat/completions`, expect.any(Object));
        expect(result).toBe('转发改写');
    });

    test('checks model availability through relayx with a minimal chat request', async () => {
        let requestBody = '';
        const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
            requestBody = String(init?.body ?? '');
            return new Response(JSON.stringify({
                choices: [{ message: { content: 'ok' } }]
            }), { status: 200 });
        });

        const result = await checkAiModelAvailability({
            aiWriting: { baseUrl: 'https://api.openai.com/v1', apiKey: 'local-key', model: 'gpt-4o-mini' },
            relayAiRequests: true,
            fetchImpl
        });

        expect(fetchImpl).toHaveBeenCalledWith(`${RELAYX_BASE_URL}/https://api.openai.com/v1/chat/completions`, expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ Authorization: 'Bearer local-key' })
        }));
        expect(JSON.parse(requestBody)).toEqual(expect.objectContaining({
            model: 'gpt-4o-mini',
            max_tokens: 1,
            stream: false
        }));
        expect(result).toEqual({ ok: true, message: '模型可用' });
    });
});
