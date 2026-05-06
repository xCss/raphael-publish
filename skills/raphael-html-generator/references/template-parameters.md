# Raphael HTML template parameters

Use JSON when calling `scripts/generate-html.mjs --input <file>`.

## Schema

```json
{
  "title": "文章标题",
  "subtitle": "可选副标题",
  "author": "可选作者",
  "date": "可选日期",
  "summary": "可选摘要，会渲染为“摘要”小节",
  "theme": "wechat",
  "markdown": "可选原始 Markdown；可和 sections 混用",
  "sections": [
    {
      "heading": "小节标题",
      "body": ["段落一", "段落二"],
      "bullets": ["要点一", "要点二"],
      "quote": "引用文字",
      "image": {
        "url": "https://example.com/image.png",
        "alt": "图片说明"
      }
    }
  ],
  "cta": {
    "label": "行动按钮文字",
    "url": "https://example.com"
  }
}
```

## Theme IDs

Supported theme ids:

`apple`, `claude`, `wechat`, `media`, `medium`, `stripe`, `workspace`, `linear`, `retro`, `bloomberg`, `notion`, `github`, `sspai`, `dracula`, `nord`, `sakura`, `ocean`, `mint`, `sunset`, `monokai`, `solarized`, `cyberpunk`, `ink`, `lavender`, `forest`, `glacier`, `coffee`, `bauhaus`, `copper`, `pastel`.

Default theme: `apple`.

## Notes

- Raw HTML in Markdown is escaped by the app renderer.
- External images stay as remote URLs for general HTML export. Blob/local draft images must be resolved inside the web app before export.
- Use `theme: "wechat"` when the output is mainly for 微信公众号.
