import { BasicSoundSchema, ButtonId, buttonIds, ConfigSchema } from "./config-schema.js";
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

export interface PressReleaseSound {
  mode: 'press-release';
  press: BasicSound | NoSound;
  release: BasicSound | NoSound;
  cancelPress: boolean;
  loopPress: boolean;
  cancelRelease: boolean;
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

export function parseConfig(inputConfig: ConfigSchema, configUrl: string): Config {
  return {
    sounds: mapKeys(buttonIds, (id): NamedSound => {
      const inputSound = inputConfig.sounds[id];
      if (inputSound === undefined) return { mode: 'none', name: 'No sound' };
      if ('press' in inputSound) {
        return {
          mode: 'press-release',
          press: inputSound.press ? parseBasicSound(inputSound.press, configUrl) : { mode: 'none' },
          release: inputSound.release ? parseBasicSound(inputSound.release, configUrl) : { mode: 'none' },
          cancelPress: inputSound.press?.cancel ?? true,
          loopPress: inputSound.press?.loop ?? false,
          cancelRelease: inputSound.release?.cancel ?? true,
          name: inputSound.name || 'Press & release sound'
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
