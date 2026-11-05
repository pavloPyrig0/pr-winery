import { Overlay } from './overlays';

/** "?" controls overlay; the content is static markup in index.html. */
export function createHelp(onClose: () => void): Overlay {
  return new Overlay('help', onClose);
}
