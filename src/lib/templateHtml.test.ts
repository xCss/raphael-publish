import { describe, expect, it } from 'vitest';
import { renderMarkdownToHtml } from './templateHtml';

describe('renderMarkdownToHtml', () => {
    it('renders markdown into a complete Raphael-styled HTML document', async () => {
        const html = await renderMarkdownToHtml({
            title: '自动生成文章',
            markdown: '# 自动生成文章\n\n> 给 Agent 使用。\n\n- 参数化\n- 可导出',
            theme: 'wechat'
        });

        expect(html).toContain('<!doctype html>');
        expect(html).toContain('<title>自动生成文章</title>');
        expect(html).toContain('<meta name="generator" content="Raphael Publish">');
        expect(html).toContain('微信公众号原生');
        expect(html).toContain('<h1');
        expect(html).toContain('自动生成文章');
        expect(html).toContain('给 Agent 使用');
        expect(html).toContain('data-raphael-theme="wechat"');
        expect(html).not.toContain('data-md-type');
        expect(html).not.toContain('data-md-index');
    });

    it('turns template parameters into markdown before rendering', async () => {
        const html = await renderMarkdownToHtml({
            title: '产品周报',
            subtitle: '第 12 周',
            author: 'Raphael Agent',
            summary: '本周重点关注增长和交付。',
            sections: [
                {
                    heading: '增长',
                    body: ['新增用户 **1280**。', '转化率提升 3%。']
                },
                {
                    heading: '交付',
                    bullets: ['完成 HTML 导出', '补齐 Agent skill']
                }
            ],
            cta: {
                label: '查看项目',
                url: 'https://github.com/liuxiaopai-ai/raphael-publish'
            },
            theme: 'apple'
        });

        expect(html).toContain('产品周报');
        expect(html).toContain('第 12 周');
        expect(html).toContain('Raphael Agent');
        expect(html).toContain('<strong');
        expect(html).toContain('1280');
        expect(html).toContain('完成 HTML 导出');
        expect(html).toContain('查看项目');
        expect(html).toContain('https://github.com/liuxiaopai-ai/raphael-publish');
    });
});
