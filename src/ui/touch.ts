// On-screen diagonal d-pad and Tend button (fallback below 900px).
import type { Keyboard } from '../input/keyboard';
import { $ } from './dom';

export function attachTouch(keyboard: Keyboard, onTend: () => void) {
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.dpad button')) {
    const keys = (btn.dataset.keys ?? '').split(' ').filter(Boolean);
    const press = (e: PointerEvent) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      btn.classList.add('active');
      keys.forEach((k) => keyboard.virtual.add(k));
    };
    const release = () => {
      btn.classList.remove('active');
      keys.forEach((k) => keyboard.virtual.delete(k));
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  $('touch-tend').addEventListener('click', onTend);
}
