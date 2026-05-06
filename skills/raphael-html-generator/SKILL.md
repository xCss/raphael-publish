---
name: raphael-html-generator
description: Use when an agent needs to generate Raphael Publish themed HTML from structured template parameters or Markdown, especially for WeChat-ready article output, batch rendering, or programmatic use without the WYSIWYG UI.
---

# Raphael HTML Generator

Generate a complete HTML document through Raphael Publish's existing Markdown renderer and theme pipeline.

## Availability

- Repo-local skill: any agent running in this repository can use it.
- Call the bundled script from the repo root, or ask for the `raphael-html-generator` skill by name.
- Use `wechat` as the default theme for公众号 / WeChat output unless a different theme is requested.

## Quick start

1. Create a JSON file with template parameters.
2. Run the bundled script from the repository root:

```bash
node skills/raphael-html-generator/scripts/generate-html.mjs \
  --input article.json \
  --output article.html
```

The script loads `src/lib/templateHtml.ts`, renders Markdown, applies the selected Raphael theme, and writes a complete HTML document.

## Input options

Use one of:

- `--input <file>`: JSON template parameter file.
- `--params-json '<json>'`: inline JSON parameters.
- `--markdown <file>`: raw Markdown file; combine with `--title` and `--theme`.

Required:

- `--output <file>`: destination HTML path.

For the full JSON shape and theme IDs, read `references/template-parameters.md`.

## Minimal JSON

```json
{
  "title": "产品周报",
  "summary": "本周重点关注增长和交付。",
  "theme": "wechat",
  "sections": [
    {
      "heading": "增长",
      "body": ["新增用户 **1280**。", "转化率提升 3%。"],
      "bullets": ["新增渠道 A", "优化落地页"]
    }
  ],
  "cta": {
    "label": "查看项目",
    "url": "https://github.com/liuxiaopai-ai/raphael-publish"
  }
}
```

## Workflow

1. Prefer structured JSON when the user gives template fields.
2. Prefer `--markdown` when the user already has full Markdown.
3. Choose `theme: "wechat"` for 微信公众号 output unless the user asks for another style.
4. Run the generator.
5. Inspect the output file for the requested title/content and `data-raphael-theme`.

## Constraints

- Do not add dependencies for this workflow.
- Do not duplicate the app renderer; use the bundled script so output stays aligned with `src/lib/markdown.ts`.
- Remote images remain remote URLs in general HTML export. If the user needs WeChat paste-safe Base64 images, use the web app copy flow or add an explicit follow-up implementation for image bundling.
