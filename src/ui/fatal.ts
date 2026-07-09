/**
 * Fatal-error surface. Anything that would otherwise leave a silent blank screen
 * (a startup throw, a scene crash, an unhandled rejection) renders here instead,
 * with a one-click "clear saved data & reload" recovery.
 */
import { clearAllData } from '@platform/storage';
import { el } from './reactive';

let shown = false;

export function showFatal(title: string, detail: string): void {
  if (shown) return;
  shown = true;
  const host = document.getElementById('ui') ?? document.body;
  const panel = el(
    'div',
    { class: 'fatal-overlay' },
    el(
      'div',
      { class: 'fatal-panel' },
      el('h2', { text: `⚠ ${title}` }),
      el('p', {
        text: 'Something went wrong starting the game. This is often stale or incompatible saved data — clearing it usually fixes it.',
      }),
      el('pre', { class: 'fatal-detail', text: detail.slice(0, 800) }),
      el(
        'div',
        { class: 'btn-row' },
        el(
          'button',
          {
            class: 'btn primary',
            onclick: async () => {
              await clearAllData();
              location.reload();
            },
          },
          'Clear saved data & reload',
        ),
        el('button', { class: 'btn', onclick: () => location.reload() }, 'Just reload'),
      ),
    ),
  );
  host.append(panel);
}

/** Install global handlers so no error can leave a blank screen. */
export function installFatalHandlers(): void {
  window.addEventListener('error', (e) => {
    showFatal('Unexpected error', e.message ? `${e.message}\n${e.error?.stack ?? ''}` : String(e));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    showFatal('Unexpected error', r?.stack ?? r?.message ?? String(r));
  });
}
