import { buttonIds } from "./config-schema.js";
import { Bluetooth } from "./bluetooth.js";
import { Config } from "./config-parser.js";
import { mapKeys } from "./utils.js";
import { Button } from "./button.js";

export async function run(config: Config) {
  const connectButton = document.getElementById('connect-button') as HTMLButtonElement;
  const connectButtonIcon = document.getElementById('connect-button-icon')!;
  const fullscreenButton = document.getElementById('fullscreen-button') as HTMLButtonElement;
  let wakeLock: WakeLockSentinel | null = null;

  const bluetooth = new Bluetooth({
    connect: async () => {
      connectButton.disabled = true;
      connectButtonIcon.innerText = 'bluetooth_connected';
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('Failed to request wake lock', err);
      }
      await updateLEDs();
    },
    disconnect: () => {
      wakeLock?.release();
      wakeLock = null;
      connectButton.disabled = false;
      connectButtonIcon.innerText = 'bluetooth';
    },
    buttonPressed: (i) => {
      buttons[buttonIds[i]]?.press('bluetooth');
    },
    buttonReleased: (i) => {
      buttons[buttonIds[i]]?.release('bluetooth');
    }
  });

  let buttons = mapKeys(buttonIds, (id) => {
    const sound = config.sounds[id];
    const button = new Button(id, sound);
    button.onStart(async () => {
      if (id === 'big-red') redPlayingCount++; else bluePlayingCount++;
      await updateLEDs();
    });
    button.onEnd(async () => {
      if (id === 'big-red') redPlayingCount--; else bluePlayingCount--;
      await updateLEDs();
    });
    return button;
  });

  let redPlayingCount = 0;
  let bluePlayingCount = 0;

  async function updateLEDs() {
    const redPlaying = redPlayingCount > 0;
    const bluePlaying = bluePlayingCount > 0;

    await bluetooth.setButtonLEDs(redPlaying, bluePlaying);

    document.getElementById('big-red-button')!
      .classList[redPlaying ? 'add' : 'remove']('playing');
    document.getElementById('big-blue-button')!
      .classList[bluePlaying ? 'add' : 'remove']('playing');
  }

  const goFullscreen = () => document.documentElement.requestFullscreen();
  connectButton.addEventListener('click', () => bluetooth.connect(true));
  fullscreenButton.addEventListener('click', () => goFullscreen());

  console.log('Starting...');
  await bluetooth.connect(false);
  console.log('Ready!');
}
