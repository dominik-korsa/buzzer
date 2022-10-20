import { ButtonId } from "./config-schema.js";
import { NamedSound } from "./config-parser.js";
import { createPlayer, Player } from "./players.js";

type PressType = 'space' | 'enter' | 'pointer' | 'bluetooth';

export class Button {
  private readonly el: HTMLButtonElement;
  private pressSet = new Set<PressType>();
  private player: Player | null;

  private initEvents() {
    this.el.addEventListener('pointerdown', async (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      this.el.classList.add('pressed');
      event.preventDefault();
      this.el.setPointerCapture(event.pointerId);
      this.press('pointer');
    });
    this.el.addEventListener('pointercancel', () => {
      this.release('pointer');
    });
    this.el.addEventListener('pointerup', () => {
      this.release('pointer');
    });
    this.el.addEventListener('contextmenu', (event) => {
      if ((event as PointerEvent).pointerType !== 'mouse') event.preventDefault();
    });
    this.el.addEventListener('keydown', async (event) => {
      if (event.code === 'Space') this.press('space');
      if (event.code === 'Enter') this.press('enter');
    });
    this.el.addEventListener('keyup', (event) => {
      if (event.code === 'Space') this.release('space');
      if (event.code === 'Enter') this.release('enter');
    });
  }

  press(type: PressType) {
    if (this.pressSet.size === 0) {
      this.el.classList.add('pressed');
      this.player?.handlePress();
    }
    this.pressSet.add(type);
  }

  release(type: PressType) {
    this.pressSet.delete(type);
    if (this.pressSet.size === 0) {
      this.el.classList.remove('pressed');
      this.player?.handleRelease();
    }
  }

  constructor(id: ButtonId, sound: NamedSound) {
    this.el = document.getElementById(`${id}-button`) as HTMLButtonElement;
    this.el.title = sound.name ?? 'No sound';
    const label = document.querySelector(`#${id}-button-label .label-text`);
    console.log(label);
    if (label) label.innerHTML = sound.name ?? '';
    this.initEvents();
    this.player = createPlayer(sound, null);
  }

  public onStart(handler: () => void) { this.player?.onStart(handler); }
  public onEnd(handler: () => void) { this.player?.onEnd(handler); }
}
