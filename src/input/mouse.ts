// Secondary mouse input: click-to-walk, hover tooltips and wheel zoom.

export interface MouseHandlers {
  onClick(x: number, y: number): void;
  onHover(x: number, y: number, clientX: number, clientY: number): void;
  onLeave(): void;
  onZoom(factor: number): void;
}

export function attachMouse(el: HTMLElement, h: MouseHandlers): () => void {
  let downAt: { x: number; y: number } | null = null;
  const rel = (e: PointerEvent | WheelEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    downAt = rel(e);
  };
  const up = (e: PointerEvent) => {
    if (!downAt || e.button !== 0) return;
    const p = rel(e);
    if (Math.hypot(p.x - downAt.x, p.y - downAt.y) < 6) h.onClick(p.x, p.y);
    downAt = null;
  };
  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const p = rel(e);
    h.onHover(p.x, p.y, e.clientX, e.clientY);
  };
  const leave = () => h.onLeave();
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    h.onZoom(Math.exp(-delta * 0.0015));
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', leave);
  el.addEventListener('wheel', wheel, { passive: false });
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerleave', leave);
    el.removeEventListener('wheel', wheel);
  };
}
