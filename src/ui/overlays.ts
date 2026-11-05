// Shared open/close behaviour for modal overlays (list view, help).
import { $ } from './dom';

export class Overlay {
  readonly el: HTMLElement;
  private returnFocus: HTMLElement | null = null;

  constructor(id: string, private onClose?: () => void) {
    this.el = $(id);
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.el || t.closest('[data-close]')) this.close();
    });
    // Keep Tab focus inside the overlay.
    this.el.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...this.el.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]')].filter((n) => !n.hasAttribute('disabled'));
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  get open() {
    return !this.el.hidden;
  }

  show() {
    if (this.open) return;
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.el.hidden = false;
    this.el.querySelector<HTMLElement>('[data-close]')?.focus();
  }

  close() {
    if (!this.open) return;
    this.el.hidden = true;
    (this.returnFocus && document.contains(this.returnFocus) ? this.returnFocus : $('garden-canvas'))?.focus();
    this.onClose?.();
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }
}
