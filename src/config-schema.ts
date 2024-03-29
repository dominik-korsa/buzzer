import { Static, Type } from "@sinclair/typebox";
import Ajv from "ajv";
import addFormats from 'ajv-formats';
import { IntersectAllOf, Nullable } from "./utils.js";

export const buttonIds = ['red', 'orange', 'yellow', 'green', 'blue', 'white', 'black', 'big-red', 'big-blue'] as const;

export type ButtonId = (typeof buttonIds)[number];

const srcSchema = Type.String({format: 'uri-reference'});

const basicSoundSchema = Type.Object({
  src: Type.Union([srcSchema, Type.Array(srcSchema, {minItems: 1})]),
  mode: Type.Optional(Type.Union([Type.Literal('sequence'), Type.Literal('random')])),
}, {$id: '#/$defs/basicSound'});

const cancellableBasicSoundSchema = IntersectAllOf([
  Type.Object({
    cancel: Type.Boolean(),
  }),
  Type.Ref(basicSoundSchema),
], {$id: '#/$defs/cancellableBasicSound'})

const loopSchema = Type.Partial(Type.Object({
  startTime: Type.Integer({ minimum: 0, description: 'Start time in milliseconds' }),
  delay: Type.Integer({ description: 'Delay before starting in milliseconds. If negative, restarts before playback end' }),
  delayChange: Type.Number({ exclusiveMinimum: 0 }),
}));

const pressReleaseSoundSchema = Type.Object({
  press: Nullable(IntersectAllOf([
    Type.Partial(Type.Object({
      cancel: Type.Boolean(),
      loop: Nullable(loopSchema),
      minDuration: Type.Union([
        Type.Null(),
        Type.Integer({ minimum: 1 }),
        Type.Object({
          ifLessThan: Type.Integer({ minimum: 1 }),
          playFor: Type.Integer({ minimum: 1 }),
        }),
      ])
    })),
    Type.Ref(basicSoundSchema),
  ])),
  release: Nullable(IntersectAllOf([
    Type.Partial(Type.Object({
      cancel: Type.Boolean(),
      minTime: Type.Integer({ minimum: 0, description: 'Minimum press time for release sound to play, in milliseconds' })
    })),
    Type.Ref(basicSoundSchema),
  ])),
});

const soundSchema = IntersectAllOf(
  [
    Type.Object({
      name: Type.Optional(Type.String()),
    }),
    Type.Union([
      Type.Ref(basicSoundSchema),
      pressReleaseSoundSchema,
    ]),
  ], {$id: '#/$defs/sound'},
);

const configSchema = Type.Object({
  sounds: Type.Partial(Type.Record(
    Type.Union(buttonIds.map((key) => Type.Literal(key))),
    Type.Ref(soundSchema),
  )),
});

export type BasicSoundSchema = Static<typeof basicSoundSchema>;
export type LoopSchema = Static<typeof loopSchema>;
export type ConfigSchema = Static<typeof configSchema>;

export const fullConfigSchema = {
  ...configSchema,
  $defs: {
    sound: soundSchema,
    basicSound: basicSoundSchema,
    cancellableBasicSound: cancellableBasicSoundSchema,
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

export function validateConfig(inputConfig: unknown): asserts inputConfig is ConfigSchema {
  if (ajv.validate(fullConfigSchema, inputConfig)) return;
  const errors = ajv.errors ?? [];
  if (errors.length === 0) throw new Error('Failed to validate config');
  throw Error(ajv.errorsText(errors));
}
