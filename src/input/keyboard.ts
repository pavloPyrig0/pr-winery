// Key-state map for movement plus a queue of one-shot actions.
// Movement reads which keys are *held* every fixed update; it never relies
// on OS keydown auto-repeat.

export type Action =
  | 'tend'
  | 'switch'
  | 'garden1'
  | 'garden2'
  | 'list'
  | 'help'
  | 'escape'
  | 'panel'
  | 'refresh';

const MOVE_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight',
]);

/** Keys a focused button/link handles natively; we leave them alone there. */
const NATIVE_ON_CONTROLS = new Set(['Tab', 'Space', 'Enter', 'NumpadEnter']);

export function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range'].includes(type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

function isControl(el: Element | null): boolean {
  if (!el || el === document.body) return false;
  if (el.tagName === 'CANVAS') return false;
  return el.matches('button, a[href], summary, [role="button"], [role="tab"], input, select, textarea');
}

export function actionFor(e: Pick<KeyboardEvent, 'code' | 'key'>): Action | null {
  if (e.key === '?') return 'help';
  switch (e.code) {
    case 'KeyE':
    case 'Space':
    case 'Enter':
    case 'NumpadEnter':
      return 'tend';
    case 'Tab':
      return 'switch';
    case 'Digit1':
    case 'Numpad1':
      return 'garden1';
    case 'Digit2':
    case 'Numpad2':
      return 'garden2';
    case 'KeyL':
      return 'list';
    case 'Escape':
      return 'escape';
    case 'Backslash':
    case 'IntlBackslash':
      return 'panel';
    case 'KeyR':
      return 'refresh';
  }
  return null;
}

export class Keyboard {
  private held = new Set<string>();
  /** Virtual keys held by on-screen controls (touch fallback). */
  readonly virtual = new Set<string>();
  private queue: Action[] = [];
  /** When false (e.g. a modal is open), movement keys are ignored. */
  movementEnabled = true;

  constructor(private onAction?: (a: Action) => void) {
    window.addEventListener('keydown', this.onDown, { capture: true });
    window.addEventListener('keyup', this.onUp, { capture: true });
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.clear);
  }

  private onDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const active = document.activeElement;
    const action = actionFor(e);
    if (isTextInput(active)) {
      if (action === 'escape') this.push(action);
      return;
    }
    if (isControl(active) && NATIVE_ON_CONTROLS.has(e.code)) return;
    if (MOVE_CODES.has(e.code)) {
      if (!e.code.startsWith('Shift')) e.preventDefault();
      this.held.add(e.code);
    }
    if (action) {
      e.preventDefault();
      if (!e.repeat) this.push(action);
    }
  };

  private onUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };

  private clear = () => {
    this.held.clear();
  };

  private push(a: Action) {
    this.queue.push(a);
    this.onAction?.(a);
  }

  isDown(code: string): boolean {
    return this.held.has(code) || this.virtual.has(code);
  }

  /** Screen-relative movement intent: right/down in [-1, 1]. */
  axes(): { right: number; down: number; run: boolean } {
    if (!this.movementEnabled) return { right: 0, down: 0, run: false };
    const k = (...codes: string[]) => codes.some((c) => this.isDown(c));
    const right = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
    const down = (k('KeyS', 'ArrowDown') ? 1 : 0) - (k('KeyW', 'ArrowUp') ? 1 : 0);
    return { right, down, run: k('ShiftLeft', 'ShiftRight') };
  }

  /** Drain one-shot actions queued since the last fixed update. */
  drain(): Action[] {
    const q = this.queue;
    this.queue = [];
    return q;
  }
}
