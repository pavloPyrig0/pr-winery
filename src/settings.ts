// Persistent user settings. The token lives in localStorage only.
import type { Season } from './types';

export interface Settings {
  token: string;
  weedRepos: string[];
  season: Season;
  panelCollapsed: boolean;
}

const KEY = 'prgarden.settings.v1';

function defaultSeason(now = new Date()): Season {
  const m = now.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export function loadSettings(): Settings {
  const base: Settings = { token: '', weedRepos: [], season: defaultSeason(), panelCollapsed: false };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    return { ...base, ...JSON.parse(raw) };
  } catch {
    return base;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings last for this session only */
  }
}

/** Parse "owner/name" lines, ignoring blanks and junk. */
export function parseRepoList(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.split(/[\n,]+/)) {
    const m = line.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '').match(/^([\w.-]+)\/([\w.-]+)$/);
    if (m) out.add(`${m[1]}/${m[2]}`);
  }
  return [...out];
}
