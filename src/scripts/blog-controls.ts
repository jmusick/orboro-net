// Progressive enhancement for the /blog search-and-sort form (BlogIndex.astro).
// Without JavaScript the form is a plain GET form with an Apply button. With it,
// changing the sort submits straight away and the Apply button is hidden by the
// `is-enhanced` class (a class, not inline style: CSP sets style-src-attr 'none').
// Enter in the search box still submits the form natively.

export interface BlogControlsState {
  // Set when a sort change submitted the form, so the next page can put focus
  // back on the sort select after ClientRouter swaps the page.
  refocusSort: boolean;
}

// Only the parts of the DOM this uses. Kept structural because the project's
// Worker types shadow parts of lib.dom (and so the tests can pass plain objects).
interface SortSelect {
  focus(): void;
  addEventListener(type: "change", listener: () => void): void;
}
interface ControlsForm {
  dataset: Record<string, string | undefined>;
  classList: { add(token: string): void };
  querySelector(selectors: string): unknown;
  requestSubmit(): void;
}
export interface ControlsDocument {
  querySelector(selectors: string): unknown;
}

export function initBlogControls(doc: ControlsDocument, state: BlogControlsState): boolean {
  const refocus = state.refocusSort;
  state.refocusSort = false;
  const form = doc.querySelector("form.blog-controls") as ControlsForm | null;
  const sort = form?.querySelector("#blog-sort") as SortSelect | null | undefined;
  if (!form || !sort) return false;
  if (refocus) sort.focus();
  if (form.dataset.blogControlsInit) return false;
  form.dataset.blogControlsInit = "1";
  form.classList.add("is-enhanced");
  sort.addEventListener("change", () => {
    state.refocusSort = true;
    form.requestSubmit();
  });
  return true;
}
