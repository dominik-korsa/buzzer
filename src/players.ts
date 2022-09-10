import { Sound } from "./config-parser.js";

export abstract class Player {
  private readonly startListeners: (() => void)[] = [];
  private readonly endListeners: (() => void)[] = [];

  public onStart(handler: () => void) { this.startListeners.push(handler); }
  public onEnd(handler: () => void) { this.endListeners.push(handler); }

  protected createAudio(src: URL) {
    const audio = new Audio(src.toString());
    audio.addEventListener('play', () => { this.startListeners.forEach((l) => l()) });
    audio.addEventListener('ended', () => { this.endListeners.forEach((l) => l()) });
    return audio;
  }

  abstract handlePress(): void;
  abstract handleRelease(): void;
}

export class SequencePlayer extends Player {
  private readonly audio: HTMLAudioElement[];
  private next = 0;

  constructor(sound: Sound) {
    super();
    this.audio = sound.src.map((src) => this.createAudio(src));
  }

  handlePress() {
    const audio = this.audio[this.next];
    audio.currentTime = 0;
    audio.play().catch(console.error);
    this.next = (this.next + 1) % this.audio.length;
  }

  handleRelease() {}
}

export class RandomPlayer extends Player {
  private readonly audio: HTMLAudioElement[];

  constructor(sound: Sound) {
    super();
    this.audio = sound.src.map((src) => this.createAudio(src));
  }

  handlePress() {
    const audio = this.audio[Math.floor(Math.random() * this.audio.length)];
    audio.currentTime = 0;
    audio.play().catch(console.error);
  }

  handleRelease() {}
}

export function createPlayer(sound: Sound) {
  switch (sound.mode) {
    case "sequence": return new SequencePlayer(sound);
    case "random": return new RandomPlayer(sound);
  }
}
