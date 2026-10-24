import { marked } from 'marked';
import xss from 'xss';

// Feed markup is kept for reader portability, rather than passed through the
// site's author-content allowlist. Use the HTML parser to omit script/style
// bodies without joining malformed fragments into a new executable tag.
const { parseTag, escapeHtml } = xss as unknown as typeof import('xss');
const codeEnd = {
  script: /<\/script(?=[\t\n\f\r />])(?:[^"'<>]|"[^"]*"|'[^']*')*>/i,
  style: /<\/style(?=[\t\n\f\r />])(?:[^"'<>]|"[^"]*"|'[^']*')*>/i,
};
function omitFeedCode(html: string): string {
  const output: string[] = [];
  const rawText = {};
  while (html) {
    const block = { tag: '', afterOpen: 0 };
    try {
      // The tag parser is not raw-text aware. Stop at an opening code tag so
      // quotes or tag-looking examples in its body cannot swallow its close.
      parseTag(html, (source, _position, _tag, raw) => {
        const opening = raw.match(/^<(script|style)(?=[\t\n\f\r />])/i);
        if (opening) {
          block.tag = opening[1].toLowerCase();
          block.afterOpen = source + raw.length;
          throw rawText;
        }
        if (!/^<\/(script|style)(?=[\t\n\f\r />])/i.test(raw)) output.push(raw);
        return '';
      }, (text) => { output.push(escapeHtml(text)); return ''; });
    } catch (error) {
      if (error !== rawText) throw error;
    }
    if (!block.tag) break;
    const end = codeEnd[block.tag === 'script' ? 'script' : 'style'].exec(html.slice(block.afterOpen));
    if (!end) break;
    html = html.slice(block.afterOpen + end.index + end[0].length);
  }
  return output.join('');
}

export function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function escapeCdata(html: string): string {
  return html.replaceAll(']]>', ']]]]><![CDATA[>');
}

// Feed readers cannot execute or style our widgets. Keep those posts useful and
// small by linking to the full article instead of expanding shortcode payloads.
export function renderFeedHtml(markdown: string, excerpt: string, link: string, base: string): string {
  if (/\{\{\w+[^}]*\}\}/.test(markdown)) {
    return `<p>${escapeXml(excerpt)}</p><p><a href="${escapeXml(link)}">Read the full article on Orboro.net</a></p>`;
  }
  const html = omitFeedCode(marked.parse(markdown, { async: false }));
  // This is feed portability, not an HTML security sanitizer. Rewrite URL
  // attributes in emitted tags, leaving escaped code samples/text untouched.
  return html.replace(/<[a-z](?:[^"'<>]|"[^"]*"|'[^']*')*>/gi, (tag) => tag.replace(
    /(\s+)([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g,
    (attribute, spacing, name, doubleQuoted, singleQuoted, unquoted) => {
      if (!/^(src|href)$/i.test(name) || (doubleQuoted ?? singleQuoted ?? unquoted) === undefined) return attribute;
      const value = String(doubleQuoted ?? singleQuoted ?? unquoted).replaceAll('&amp;', '&');
      if (/^[a-z][a-z\d+.-]*:/i.test(value)) return attribute;
      try {
        return `${spacing}${name}="${escapeXml(new URL(value, link || base).href)}"`;
      } catch {
        return attribute;
      }
    },
  ));
}
