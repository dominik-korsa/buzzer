import { Static, Type } from "@sinclair/typebox";
import Ajv from "ajv";
import addFormats from 'ajv-formats';

const srcSchema = Type.String({format: 'uri-reference'});

const soundSchema = Type.Object({
  src: Type.Union([srcSchema, Type.Array(srcSchema, {minItems: 1})]),
  name: Type.Optional(Type.String()),
  mode: Type.Optional(Type.Union([Type.Literal('random'), Type.Literal('sequence')])),
}, {
  $id: '#/$defs/sound'
});

const configSchema = Type.Object({
  sounds: Type.Record(
    Type.Union(['red', 'orange', 'yellow', 'green', 'blue', 'white', 'black', 'big-red', 'big-blue'].map((key) => Type.Literal(key))),
    Type.Ref(soundSchema),
  ),
});

export const fullConfigSchema = {
  ...configSchema,
  $defs: {
    sound: soundSchema,
  }
}

const ajv = addFormats(new Ajv({}), [
  'date-time',
  'time',
  'date',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uri',
  'uri-reference',
  'uuid',
  'uri-template',
  'json-pointer',
  'relative-json-pointer',
  'regex'
]);

export function validateConfig(inputConfig: unknown): asserts inputConfig is Static<typeof configSchema> {
  if (ajv.validate(fullConfigSchema, inputConfig)) return;
  const errors = ajv.errors ?? [];
  if (errors.length === 0) throw new Error('Failed to validate config');
  throw Error(ajv.errorsText(errors));
}
