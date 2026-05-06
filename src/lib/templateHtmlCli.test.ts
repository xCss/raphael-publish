import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

describe('raphael-html-generator skill script', () => {
    it('generates an HTML file from JSON template parameters', async () => {
        const tempDir = await mkdtemp(join(tmpdir(), 'raphael-html-generator-'));
        const inputPath = join(tempDir, 'article.json');
        const outputPath = join(tempDir, 'article.html');

        try {
            await writeFile(inputPath, JSON.stringify({
                title: 'Agent HTML',
                summary: '自动生成 HTML。',
                sections: [{ heading: '能力', bullets: ['模板参数', '主题渲染'] }],
                theme: 'wechat'
            }), 'utf8');

            const { stdout } = await execFileAsync(process.execPath, [
                'skills/raphael-html-generator/scripts/generate-html.mjs',
                '--input',
                inputPath,
                '--output',
                outputPath
            ], { cwd: process.cwd() });

            const html = await readFile(outputPath, 'utf8');
            expect(stdout).toContain(outputPath);
            expect(html).toContain('<!doctype html>');
            expect(html).toContain('Agent HTML');
            expect(html).toContain('自动生成 HTML');
            expect(html).toContain('data-raphael-theme="wechat"');
        } finally {
            await rm(tempDir, { recursive: true, force: true });
        }
    });
});
