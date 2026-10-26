/**
 * A text matcher for the element that reads `text` whole. An amount is a span
 * of its own (privacy mode redacts it), so a sentence with one is split across
 * elements and a plain string query no longer finds it.
 */
export const wholeLine =
  (text: string) =>
  (_: string, element: Element | null): boolean =>
    element?.textContent === text &&
    !Array.from(element.children).some(child => child.textContent === text);
