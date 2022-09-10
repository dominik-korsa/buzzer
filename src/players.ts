import { BasicSound, PressReleaseSound, Sound } from "./config-parser.js";

export abstract class Player {
  private readonly startListeners: (() => void)[] = [];
  private readonly endListeners: (() => void)[] = [];

  public onStart(handler: () => void) {
    this.startListeners.push(handler);
  }

  public onEnd(handler: () => void) {
    this.endListeners.push(handler);
  }

  protected emitStart() {
    this.startListeners.forEach((l) => l());
  }

  protected emitEnd() {
    this.endListeners.forEach((l) => l());
  }

  protected createAudio(src: URL, loop: boolean) {
    const audio = new Audio(src.toString());
    audio.addEventListener('play', () => { this.emitStart(); });
    audio.addEventListener('pause', () => { this.emitEnd(); });
    if (loop) {
      audio.addEventListener('timeupdate', () => {
        const buffer = 0.3
        if (audio.currentTime > audio.duration - buffer) {
          audio.currentTime = 0
          audio.play().catch(console.error)
        }
      })
    }
    return audio;
  }

  abstract handlePress(): void;
  abstract handleRelease(): void;
  abstract cancel(): void;
}

export abstract class BasicPlayer extends Player {
  private readonly audio: HTMLAudioElement[];

  constructor(sound: BasicSound, loop: boolean) {
    super();
    this.audio = sound.src.map((src) => this.createAudio(src, loop));
  }

  protected get audioCount() { return this.audio.length };

  protected play(i: number) {
    const audio = this.audio[i];
    audio.currentTime = 0;
    audio.play().catch(console.error);
  }

  cancel() {
    this.audio.forEach((el) => { el.pause(); });
  }

  handleRelease() {}
}

export class SequencePlayer extends BasicPlayer {
  private next = 0;

  handlePress() {
    this.play(this.next);
    this.next = (this.next + 1) % this.audioCount;
  }
}

export class RandomPlayer extends BasicPlayer {
  handlePress() {
    this.play(Math.random() * this.audioCount)
  }
}

export class NoPlayer extends Player {
  handlePress() {}
  handleRelease() {}
  cancel() {}
}

export class PressReleasePlayer extends Player {
  private readonly pressPlayer: Player;
  private readonly releasePlayer: Player;

  private readonly cancelPress: boolean;
  private readonly cancelRelease: boolean;

  private isPressed = false;

  constructor(sound: PressReleaseSound) {
    super();
    this.cancelPress = sound.cancelPress;
    this.cancelRelease = sound.cancelRelease;

    this.pressPlayer = createPlayer(sound.press, sound.loopPress);
    this.releasePlayer = createPlayer(sound.release, false);

    this.pressPlayer.onStart(() => { this.emitStart(); });
    this.releasePlayer.onStart(() => { this.emitStart() });
    this.pressPlayer.onEnd(() => { this.emitEnd(); });
    this.releasePlayer.onEnd(() => { this.emitEnd() });
  }

  handlePress() {
    this.isPressed = true;
    this.pressPlayer.handlePress();
    if (this.releasePlayer) this.releasePlayer.cancel();
  }

  handleRelease() {
    this.isPressed = false;
    this.releasePlayer.handlePress();
    if (this.cancelPress) this.pressPlayer.cancel();
  }

  cancel() {
    this.isPressed = false;
    this.pressPlayer.cancel();
    this.releasePlayer.cancel();
  }
}

export function createPlayer(sound: Sound, loop: boolean): Player {
  switch (sound.mode) {
    case "none": return new NoPlayer();
    case "sequence": return new SequencePlayer(sound, loop);
    case "random": return new RandomPlayer(sound, loop);
    case "press-release": return new PressReleasePlayer(sound);
  }
}
