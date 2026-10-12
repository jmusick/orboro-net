import type EasyMDE from "easymde";
import { renderMarkdown } from "./markdown.ts";

// EasyMDE's built-in preview runs its own nested Marked parser and inserts the
// unsanitized result with innerHTML. The admin editor bundles this module
// instead, so the preview goes through the publishing renderer itself: the same
// Marked instance, highlighter and `xss` allowlist (tags, attributes and URL
// schemes) that `renderMarkdown` applies before content reaches `set:html`.
// There is no second allowlist to drift. Shortcodes are expanded only by the
// public render pipeline, so `{{token}}` stays visible as text here, as before.
export function renderEditorPreview(markdown: string): string {
  return renderMarkdown(markdown);
}

// Options for `new EasyMDE(...)`, kept apart from the DOM wiring in
// `src/scripts/admin-editor.ts` so tests can check which renderer the preview
// and side-by-side panes use.
export function editorOptions(element: HTMLTextAreaElement): EasyMDE.Options {
  return {
    element,
    autoDownloadFontAwesome: false,
    theme: "orboro",
    spellChecker: false,
    autosave: { enabled: false, uniqueId: "" },
    minHeight: "300px",
    maxHeight: "560px",
    toolbar: [
      "bold", "italic", "strikethrough", "heading", "|",
      "quote", "unordered-list", "ordered-list", "|",
      "link", "image", "table", "|",
      "preview", "side-by-side", "fullscreen", "|",
      "guide",
    ],
    previewRender: (markdown) => renderEditorPreview(markdown),
  };
}
