import { describe, expect, test, vi } from 'vitest';
import { requestAiRewrite } from './aiRewrite';

describe('requestAiRewrite', () => {
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
});
