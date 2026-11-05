// Entry point: wires data, game and UI together.
import './ui/styles.css';
import type { GardenData, GardenId } from './types';
import { gardenHealth, gardenSummary } from './github/mapping';
import { DataStore } from './github/store';
import type { Action } from './input/keyboard';
import { Game } from './game';
import { loadSettings, saveSettings, type Settings } from './settings';
import { $ } from './ui/dom';
import { AREA_LABEL } from './world/layout';
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
  game.jumpTo(g);
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
    listView.render(store.data, game.area ?? 'mine');
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
      switchTo(game.otherArea());
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
  onHover: (p, x, y) => hud.showTooltip(p?.item ?? null, p?.garden ?? 'mine', x, y),
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
    const area = game.area;
    const gardens: GardenId[] = area ? [area] : ['mine', 'review'];
    const areaItems = gardens.flatMap((g) => game.itemsBy[g]);
    const summaries = gardens.map((g) => ({
      label: area ? null : AREA_LABEL[g],
      text: gardenSummary(game.itemsBy[g], g),
    }));
    const gardenOf = new Map<string, GardenId>();
    for (const g of ['mine', 'review'] as GardenId[]) for (const i of game.itemsBy[g]) gardenOf.set(i.id, g);
    const entries = game.items.map((item) => ({ item, garden: gardenOf.get(item.id)! }));
    const hl = game.highlighted;

    hud.render({
      area,
      season: game.season,
      health: gardenHealth(areaItems),
      counts: { mine: game.countFor('mine'), review: game.countFor('review') },
      status: store.status,
      mock: MOCK,
    });
    panel.render({
      area,
      entries,
      highlighted: hl ? { item: hl.item, garden: hl.garden } : null,
      summaries,
      status: store.status.kind,
      fetchedAt: store.data?.fetchedAt ?? null,
      mock: MOCK,
      now: Date.now(),
    });
    if (listView.open) listView.render(store.data, area ?? 'mine');
    const canvas = document.getElementById('garden-canvas');
    const where = area ? `You are in the ${AREA_LABEL[area]} area.` : 'You are on the path between the two areas.';
    canvas?.setAttribute(
      'aria-label',
      `PR Garden: an isometric garden with two fenced areas, My PRs (${game.countFor('mine')} beds) and To review (${game.countFor('review')} beds), one flower bed per pull request. ${where} ${summaries.map((x) => x.text).join('. ')}. Use W A S D to walk, E to tend the highlighted bed, 1 or 2 to jump to an area, or press L for a list of links.`,
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
