/** ~50-line signal helper — the entire UI "framework". */

type Effect = () => void;
let activeEffect: Effect | null = null;

export interface Signal<T> {
  (): T;
  set(v: T): void;
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subs = new Set<Effect>();
  const read = (() => {
    if (activeEffect) subs.add(activeEffect);
    return value;
  }) as Signal<T>;
  read.set = (v: T) => {
    if (Object.is(v, value)) return;
    value = v;
    for (const fn of [...subs]) fn();
  };
  return read;
}

export function effect(fn: Effect): void {
  const wrapped = () => {
    activeEffect = wrapped;
    try {
      fn();
    } finally {
      activeEffect = null;
    }
  };
  wrapped();
}

/** DOM builder. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | ((ev: Event) => void)> = {},
  ...children: Array<HTMLElement | string | null>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') node.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}
