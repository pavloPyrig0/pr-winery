// Settings dialog: token, weed repositories, season.
import type { Season } from '../types';
import { parseRepoList, type Settings } from '../settings';
import { $ } from './dom';

export class SettingsDialog {
  private dialog = $<HTMLDialogElement>('settings');
  private returnFocus: HTMLElement | null = null;

  constructor(
    private get: () => Settings,
    private onSave: (s: Settings, tokenChanged: boolean) => void,
  ) {
    this.dialog.addEventListener('close', () => {
      if (this.dialog.returnValue === 'save') this.save();
      (this.returnFocus ?? $('garden-canvas'))?.focus();
    });
    $('clear-token').addEventListener('click', () => {
      $<HTMLInputElement>('token').value = '';
      $<HTMLInputElement>('token').focus();
    });
  }

  get open() {
    return this.dialog.open;
  }

  show() {
    if (this.dialog.open) return;
    const s = this.get();
    $<HTMLInputElement>('token').value = s.token;
    $<HTMLTextAreaElement>('repos').value = s.weedRepos.join('\n');
    $<HTMLSelectElement>('season').value = s.season;
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.dialog.returnValue = '';
    this.dialog.showModal();
    (s.token ? $('season') : $('token')).focus();
  }

  private save() {
    const prev = this.get();
    const token = $<HTMLInputElement>('token').value.trim();
    const next: Settings = {
      ...prev,
      token,
      weedRepos: parseRepoList($<HTMLTextAreaElement>('repos').value),
      season: $<HTMLSelectElement>('season').value as Season,
    };
    this.onSave(next, token !== prev.token);
  }
}
