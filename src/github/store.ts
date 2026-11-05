// Loads garden data (mock or GitHub), caches it, and refreshes it.
import type { GardenData } from '../types';
import { fetchGarden, GitHubError } from './client';
import { mockData } from './mock';

export type StatusKind = 'no-token' | 'loading' | 'ok' | 'offline' | 'rate' | 'auth' | 'error';

export interface Status {
  kind: StatusKind;
  message: string;
  resetAt?: string;
}

const CACHE_KEY = 'prgarden.cache.v1';
const REFRESH_MS = 5 * 60_000;
const FOCUS_MIN_GAP_MS = 30_000;

export interface StoreConfig {
  mock: boolean;
  getToken(): string;
  getWeedRepos(): string[];
}

export class DataStore {
  data: GardenData | null = null;
  status: Status = { kind: 'loading', message: 'Loading…' };
  private inflight: Promise<void> | null = null;
  private lastAttempt = 0;
  private listeners = new Set<() => void>();

  constructor(private cfg: StoreConfig) {}

  onChange(fn: () => void) {
    this.listeners.add(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  loadCache() {
    if (this.cfg.mock) return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) this.data = JSON.parse(raw) as GardenData;
    } catch {
      this.data = null;
    }
  }

  clearCache() {
    this.data = null;
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  }

  private saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.data));
    } catch {
      /* ignore quota errors */
    }
  }

  refresh(): Promise<void> {
    if (this.inflight) return this.inflight;
    this.lastAttempt = Date.now();
    this.inflight = this.doRefresh().finally(() => {
      this.inflight = null;
      this.emit();
    });
    return this.inflight;
  }

  private async doRefresh() {
    if (this.cfg.mock) {
      this.data = mockData();
      this.status = { kind: 'ok', message: 'Mock data' };
      return;
    }
    const token = this.cfg.getToken();
    if (!token) {
      this.status = { kind: 'no-token', message: 'Add a GitHub token to grow your garden' };
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.status = { kind: 'offline', message: 'You are offline · showing the last garden' };
      return;
    }
    this.status = { kind: 'loading', message: 'Refreshing…' };
    this.emit();
    try {
      this.data = await fetchGarden(token, this.cfg.getWeedRepos());
      this.saveCache();
      this.status = { kind: 'ok', message: this.data.warnings[0] ?? 'Up to date' };
    } catch (e) {
      if (e instanceof GitHubError) {
        const messages: Record<string, string> = {
          auth: 'GitHub rejected the token · open settings to fix it',
          rate: 'GitHub rate limit reached · showing the last garden',
          offline: 'You are offline · showing the last garden',
          network: 'Could not reach GitHub · showing the last garden',
          graphql: `GitHub error: ${e.message}`,
        };
        const kind: StatusKind = e.kind === 'network' || e.kind === 'graphql' ? 'error' : e.kind;
        this.status = { kind, message: messages[e.kind], resetAt: e.resetAt };
      } else {
        this.status = { kind: 'error', message: 'Something went wrong while refreshing' };
        console.error(e);
      }
    }
  }

  /** Auto-refresh every 5 minutes, on focus and when coming back online. */
  startAuto() {
    window.setInterval(() => void this.refresh(), REFRESH_MS);
    const maybe = () => {
      if (Date.now() - this.lastAttempt > FOCUS_MIN_GAP_MS) void this.refresh();
    };
    window.addEventListener('focus', maybe);
    window.addEventListener('online', () => void this.refresh());
    window.addEventListener('offline', () => {
      this.status = { kind: 'offline', message: 'You are offline · showing the last garden' };
      this.emit();
    });
  }
}
