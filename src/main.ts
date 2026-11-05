// Entry point: wires data, game and UI together.
import './ui/styles.css';
import type { GardenData, GardenId } from './types';
import { gardenHealth, gardenSummary } from './github/mapping';
import { DataStore } from './github/store';
import type { Action } from './input/keyboard';
import { Game } from './game';
import { loadSettings, saveSettings, type Settings } from './settings';
import { $ } from './ui/dom';
import { Hud } from './ui/hud';
import { Panel } from './ui/panel';
import { ListView } from './ui/listView';
import { createHelp } from './ui/help';
import { SettingsDialog } from './ui/settings';
import { attachTouch } from './ui/touch';

const params = new URLSearchParams(location.search);
const MOCK = params.get('mock') === '1';

let settings: Settings = loadSettings();
const store = new DataStore({
  mock: MOCK,
  getToken: () => settings.token,
  getWeedRepos: () => settings.weedRepos,
});
store.loadCache();

const focusCanvas = () => $('garden-canvas')?.focus();

const listView = new ListView(() => syncPause());
const help = createHelp(() => syncPause());
const settingsDialog = new SettingsDialog(
  () => settings,
  (next, tokenChanged) => {
    const seasonChanged = next.season !== settings.season;
    settings = next;
    saveSettings(settings);
    if (seasonChanged) game.setSeason(settings.season);
    if (tokenChanged) {
      store.clearCache();
      game.setData(null);
    }
    void store.refresh();
    syncPause();
  },
);
document.getElementById('settings')!.addEventListener('close', () => syncPause());

function syncPause() {
  game.paused = listView.open || help.open || settingsDialog.open;
  game.keyboard.movementEnabled = !game.paused;
  renderUi();
}

function openSettings() {
  settingsDialog.show();
  syncPause();
}

function togglePanel() {
  settings.panelCollapsed = !settings.panelCollapsed;
  saveSettings(settings);
  panel.setCollapsed(settings.panelCollapsed);
  measure();
}

function switchTo(g: GardenId) {
  game.switchGarden(g);
}

function handleAction(a: Action) {
  if (settingsDialog.open) return; // the dialog handles its own keys (Esc closes it)
  if (a === 'escape') {
    if (listView.open) listView.close();
    else if (help.open) help.close();
    return;
  }
  if (a === 'list') {
    help.close();
    listView.render(store.data, game.garden);
    listView.toggle();
    syncPause();
    return;
  }
  if (a === 'help') {
    listView.close();
    help.toggle();
    syncPause();
    return;
  }
  if (game.paused) return;
  switch (a) {
    case 'switch':
      switchTo(game.garden === 'mine' ? 'review' : 'mine');
      break;
    case 'garden1':
      switchTo('mine');
      break;
    case 'garden2':
      switchTo('review');
      break;
    case 'panel':
      togglePanel();
      break;
    case 'refresh':
      void store.refresh();
      renderUi();
      break;
  }
}

const hud = new Hud({
  onTab: (g) => {
    switchTo(g);
    focusCanvas();
  },
  onRefresh: () => void store.refresh(),
  onList: () => handleAction('list'),
  onHelp: () => handleAction('help'),
  onSettings: openSettings,
});

const panel = new Panel({
  onTend: (id) => {
    const item = game.items.find((i) => i.id === id);
    if (item) game.tendItem(item);
  },
  onWalkTo: (id) => {
    game.walkTo(id);
    focusCanvas();
  },
  onOpenSettings: openSettings,
  onToggle: togglePanel,
});
panel.setCollapsed(settings.panelCollapsed);

const game = new Game($('stage'), {
  onUiChange: () => renderUi(),
  onAction: handleAction,
  onHover: (item, x, y) => hud.showTooltip(item, game.garden, x, y),
  openUrl: (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
}, settings.season);

let uiQueued = false;
function renderUi() {
  if (uiQueued) return;
  uiQueued = true;
  queueMicrotask(() => {
    uiQueued = false;
    const items = game.items;
    const summary = gardenSummary(items, game.garden);
    hud.render({
      garden: game.garden,
      season: game.season,
      health: gardenHealth(items),
      counts: { mine: game.countFor('mine'), review: game.countFor('review') },
      status: store.status,
      mock: MOCK,
    });
    panel.render({
      garden: game.garden,
      items,
      highlighted: game.highlighted?.item ?? null,
      summary,
      status: store.status.kind,
      fetchedAt: store.data?.fetchedAt ?? null,
      mock: MOCK,
      now: Date.now(),
    });
    if (listView.open) listView.render(store.data, game.garden);
    const canvas = document.getElementById('garden-canvas');
    const beds = items.filter((i) => i.kind === 'bed').length;
    canvas?.setAttribute(
      'aria-label',
      `${game.garden === 'mine' ? 'My garden' : 'Review garden'}: an isometric garden with ${beds} flower bed${beds === 1 ? '' : 's'}, one per pull request. ${summary}. Use W A S D to walk, E to tend the highlighted bed, or press L for a list of links.`,
    );
  });
}

function measure() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const collapsed = settings.panelCollapsed;
  if (w < 900) game.setViewport({ width: w, height: collapsed ? h - 44 : h * 0.62 });
  else game.setViewport({ width: collapsed ? w : w - 320 - 32, height: h });
}
window.addEventListener('resize', measure);

let lastData: GardenData | null = store.data;
store.onChange(() => {
  if (store.data !== lastData) {
    lastData = store.data;
    game.setData(store.data);
  }
  renderUi();
});

async function boot() {
  measure();
  game.data = store.data;
  await game.init();
  attachTouch(game.keyboard, () => game.tendHighlighted());
  focusCanvas();
  renderUi();
  void store.refresh();
  store.startAuto();
  if (!MOCK && !settings.token) openSettings();
}

void boot();

// Handy for poking at the game from the console during development.
if (import.meta.env.DEV) (window as unknown as { __garden: unknown }).__garden = { game: () => game, store };
