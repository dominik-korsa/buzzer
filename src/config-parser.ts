import { BasicSoundSchema, ButtonId, buttonIds, ConfigSchema, LoopSchema } from "./config-schema.js";
import { mapKeys } from "./utils.js";

export interface Config {
  sounds: Record<ButtonId, NamedSound>
}

export interface NoSound {
  mode: 'none',
}

export interface BasicSound {
  src: URL[];
  mode: 'sequence' | 'random';
}

export interface Loop {
  startTime: number;
  delay: number;
  delayChange: number;
}

export interface MinDuration {
  ifLessThan: number;
  playFor: number;
}

export interface PressReleaseSound {
  mode: 'press-release';
  press: BasicSound | NoSound;
  release: BasicSound | NoSound;
  cancelPress: boolean;
  pressLoop: Loop | null;
  cancelRelease: boolean;
  releaseMinTime: number;
  pressMinDuration: null | MinDuration;
}

export type Sound = BasicSound | NoSound | PressReleaseSound;
export type NamedSound = Sound & { name: string };

function parseBasicSound(inputSound: BasicSoundSchema, configUrl: string) {
  const src = (typeof inputSound.src === 'string' ? [inputSound.src] : inputSound.src);
  return {
    src: src.map((src) => new URL(src, configUrl)),
    mode: inputSound.mode || 'sequence',
  }
}

export function parseLoop(loopConfig: LoopSchema | null): Loop | null {
  if (loopConfig === null) return null;
  return {
    startTime: loopConfig.startTime ?? 0,
    delay: loopConfig.delay ?? 0,
    delayChange: loopConfig.delayChange ?? 1,
  }
}

export function parseConfig(inputConfig: ConfigSchema, configUrl: string): Config {
  return {
    sounds: mapKeys(buttonIds, (id): NamedSound => {
      const inputSound = inputConfig.sounds[id];
      if (inputSound === undefined) return { mode: 'none', name: 'No sound' };
      if ('press' in inputSound) {
        let pressMinDuration: MinDuration | null = null;
        if (typeof inputSound?.press?.minDuration === 'number') {
          pressMinDuration = {
            ifLessThan: inputSound.press.minDuration,
            playFor: inputSound.press.minDuration,
          }
        } else if (inputSound?.press?.minDuration) pressMinDuration = inputSound.press.minDuration;
        return {
          mode: 'press-release',
          press: inputSound.press ? parseBasicSound(inputSound.press, configUrl) : { mode: 'none' },
          release: inputSound.release ? parseBasicSound(inputSound.release, configUrl) : { mode: 'none' },
          cancelPress: inputSound.press?.cancel ?? true,
          pressLoop: parseLoop(inputSound.press?.loop ?? null),
          cancelRelease: inputSound.release?.cancel ?? true,
          releaseMinTime: inputSound.release?.minTime ?? 0,
          name: inputSound.name || 'Press & release sound',
          pressMinDuration,
        };
      }
      const parsed = parseBasicSound(inputSound, configUrl);
      return {
        name: inputSound.name || parsed.src.join(', '),
        ...parsed,
      };
    })
  }
}
