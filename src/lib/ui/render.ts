// Markdown -> HTML, sanitised. Links stay; scripts, styles and event handlers go.
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.use({ gfm: true, breaks: false });

export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false });
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'select', 'textarea', 'iframe', 'object', 'embed', 'svg', 'math'],
    FORBID_ATTR: ['style', 'target'],
  });
}
