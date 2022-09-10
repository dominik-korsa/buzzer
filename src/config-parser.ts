import { ButtonId, buttonIds, ConfigSchema } from "./config-schema.js";
import { mapKeys } from "./utils.js";

export interface Config {
  sounds: Record<ButtonId, Sound | null>
}

export interface Sound {
  src: URL[];
  name: string;
  mode: 'sequence' | 'random';
}

export function parseConfig(configSchema: ConfigSchema, configUrl: string): Config {
  return {
    sounds: mapKeys(buttonIds, (id) => {
      const schema = configSchema.sounds[id];
      if (schema === undefined) return null;
      const src = (typeof schema.src === 'string' ? [schema.src] : schema.src);
      return {
        src: src.map((src) => new URL(src, configUrl)),
        name: schema.name || src.join(', '),
        mode: schema.mode || 'sequence',
      }
    })
  }
}
