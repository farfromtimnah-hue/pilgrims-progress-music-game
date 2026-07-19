/**
 * Minimal, deliberately unstyled DOM helpers — this session is
 * placeholder-UI-first (boxes, labels, basic layout), matching the existing
 * language-select-screen.ts style. No CSS framework, no visual polish.
 */

export function clear(root: HTMLElement): void {
  root.replaceChildren();
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { text?: string; attrs?: Record<string, string>; onClick?: () => void } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  }
  if (options.onClick) node.addEventListener("click", options.onClick);
  return node;
}

export function button(text: string, onClick: () => void, attrs: Record<string, string> = {}): HTMLButtonElement {
  const b = el("button", { text, onClick, attrs });
  b.type = "button";
  return b;
}

export function heading(level: 1 | 2 | 3, text: string): HTMLElement {
  return el(`h${level}` as "h1" | "h2" | "h3", { text });
}

export function paragraph(text: string): HTMLParagraphElement {
  return el("p", { text });
}

export function box(...children: (HTMLElement | string)[]): HTMLDivElement {
  const div = el("div", { attrs: { style: "border: 1px solid #888; padding: 8px; margin: 4px 0;" } });
  for (const child of children) {
    div.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return div;
}
