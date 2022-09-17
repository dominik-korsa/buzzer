import { BasicSound, Loop, PressReleaseSound, Sound } from "./config-parser.js";

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

  abstract handlePress(): void;
  abstract handleRelease(): void;
  abstract cancel(): void;
}

class BasicPlayerSingle {
  private readonly audio: HTMLAudioElement;
  private readonly loop: Loop | null;
  private nextLoopDelay: null | number = null;
  private lastEmitted = false;
  private timeoutId: number | undefined;

  private readonly startListeners: (() => void)[] = [];
  private readonly endListeners: (() => void)[] = [];

  public onStart(handler: () => void) {
    this.startListeners.push(handler);
  }

  public onEnd(handler: () => void) {
    this.endListeners.push(handler);
  }

  private emitStart() {
    if (this.lastEmitted) return;
    this.lastEmitted = true;
    this.startListeners.forEach((l) => l());
  }

  private emitEnd() {
    if (!this.lastEmitted) return;
    this.lastEmitted = false;
    this.endListeners.forEach((l) => l());
  }

  constructor(src: URL, loop: Loop | null) {
    this.loop = loop;
    this.audio = new Audio(src.toString());
    this.audio.addEventListener('play', () => {
      this.emitStart();
    });
    this.audio.addEventListener('pause', () => {
      if (this.nextLoopDelay !== null) return;
      this.emitEnd();
    });

    if (!loop) return;
    this.audio.addEventListener('ended', () => {
      if (this.nextLoopDelay === null) return;
      clearTimeout(this.timeoutId);
      this.timeoutId = window.setTimeout(() => {
        this.audio.currentTime = loop.startTime / 1000;
        this.audio.play().catch(console.error);
        clearTimeout(this.timeoutId)
        this.timeoutId = undefined;
      }, this.nextLoopDelay)
      this.nextLoopDelay *= loop.delayChange;
    });

    if (loop.delay < 0) {
      this.audio.addEventListener('timeupdate', () => {
        if (this.timeoutId !== undefined || this.nextLoopDelay === null) return;
        let ahead = this.audio.currentTime - this.audio.duration - loop.delay / 1000;
        if (ahead >= 0) {
          this.audio.currentTime = loop.startTime === 0 ? 0 : loop.startTime / 1000 + ahead;
          this.audio.play().catch(console.error)
        }
      });
    }
  }

  play() {
    clearTimeout(this.timeoutId);
    this.timeoutId = undefined;
    this.nextLoopDelay = this.loop?.delay ?? null;
    this.audio.currentTime = 0;
    this.audio.play().catch(console.error);
  }

  finish(cancel: boolean) {
    clearTimeout(this.timeoutId);
    this.timeoutId = undefined;
    this.nextLoopDelay = null;
    if (this.audio.paused) this.emitEnd();
    if (cancel) {
      this.audio.currentTime = 0;
      this.audio.pause();
    }
  }
}

export abstract class BasicPlayer extends Player {
  private readonly audio: BasicPlayerSingle[];

  constructor(sound: BasicSound, loop: Loop | null) {
    super();
    this.audio = sound.src.map((src) => new BasicPlayerSingle(src, loop));
    this.audio.forEach((audio) => {
      audio.onStart(() => { this.emitStart(); });
      audio.onEnd(() => { this.emitEnd(); });
    });
  }

  protected get audioCount() { return this.audio.length };

  protected play(i: number) {
    this.audio[i].play();
  }

  cancel() {
    this.audio.forEach((el) => {
      el.finish(true);
    });
  }

  handleRelease() {
    this.audio.forEach((el) => {
      el.finish(false);
    });
  }
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
    this.play(Math.floor(Math.random() * this.audioCount));
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

  private readonly sound: PressReleaseSound;

  private pressedSince: number | null = null;
  private releaseTimeoutId: number | undefined;

  constructor(sound: PressReleaseSound) {
    super();
    this.sound = sound;

    this.pressPlayer = createPlayer(sound.press, sound.pressLoop);
    this.releasePlayer = createPlayer(sound.release, null);

    this.pressPlayer.onStart(() => { this.emitStart(); });
    this.releasePlayer.onStart(() => { this.emitStart() });
    this.pressPlayer.onEnd(() => { this.emitEnd(); });
    this.releasePlayer.onEnd(() => { this.emitEnd() });
  }

  handlePress() {
    clearTimeout(this.releaseTimeoutId);
    this.releaseTimeoutId = undefined;
    this.pressedSince = Date.now();
    this.pressPlayer.handlePress();
    if (this.sound.cancelRelease) this.releasePlayer.cancel();
    else this.releasePlayer.handleRelease();
  }

  handleRelease() {
    if (!this.pressedSince) return;
    const pressDuration = Date.now() - this.pressedSince;
    clearTimeout(this.releaseTimeoutId);
    if (this.sound.pressMinDuration !== null && pressDuration < this.sound.pressMinDuration.ifLessThan) {
      this.releaseTimeoutId = window.setTimeout(() => {
        this.handleRelease();
      }, this.sound.pressMinDuration.playFor - pressDuration);
      return;
    }
    this.releaseTimeoutId = undefined;
    if (pressDuration >= this.sound.releaseMinTime) this.releasePlayer.handlePress();
    this.pressedSince = null;
    if (this.sound.cancelPress) this.pressPlayer.cancel();
    else this.pressPlayer.handleRelease();
  }

  cancel() {
    clearTimeout(this.releaseTimeoutId);
    this.releaseTimeoutId = undefined;
    this.pressedSince = null;
    this.pressPlayer.cancel();
    this.releasePlayer.cancel();
  }
}

export function createPlayer(sound: Sound, loop: Loop | null): Player {
  switch (sound.mode) {
    case "none": return new NoPlayer();
    case "sequence": return new SequencePlayer(sound, loop);
    case "random": return new RandomPlayer(sound, loop);
    case "press-release": return new PressReleasePlayer(sound);
  }
}
