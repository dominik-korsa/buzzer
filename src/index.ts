import jsyaml from 'js-yaml';
import { validateConfig } from "./config-schema.js";
import PromiseQueue from './promise-queue.js';

const connectButton = document.getElementById('connect-button') as HTMLButtonElement;
const connectButtonIcon = document.getElementById('connect-button-icon')!;

interface Button {
  players: HTMLAudioElement[];
  nextSound: number;
  mode: 'random' | 'sequence';
}

let buttons: Button[] = [];

const gattQueue = new PromiseQueue();

function playSound(index: number) {
  const button = buttons[index];
  if (button.players.length === 0) {
    console.warn(`No player for ${index}`);
    return;
  }
  const player = button.players[button.nextSound];
  player.currentTime = 0;
  player.play().catch(console.error);
  if (button.mode === 'random') {
    button.nextSound = Math.floor(Math.random() * button.players.length);
  } else {
    button.nextSound = (button.nextSound + 1) % button.players.length;
  }
}

for (let i = 0; i < 9; ++i) {
  let button = document.getElementById(`button-${i}`) as HTMLButtonElement;
  button.addEventListener('pointerdown', async (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    button.classList.add('pressed');
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    playSound(i);
  });
  button.addEventListener('pointercancel', () => {
    button.classList.remove('pressed');
  });
  button.addEventListener('pointerup', () => {
    button.classList.remove('pressed');
  });
  button.addEventListener('contextmenu', (event) => {
    if ((event as PointerEvent).pointerType !== 'mouse') event.preventDefault();
  });
  let spacePressed = false;
  let enterPressed = false;
  button.addEventListener('keydown', async (event) => {
    if (event.code === 'Space' && !spacePressed) spacePressed = true;
    else if (event.code === 'Enter' && !enterPressed) enterPressed = true;
    else return;
    playSound(i);
    button.classList.add('pressed');
  });
  button.addEventListener('keyup', (event) => {
    if (event.code === 'Space') spacePressed = false;
    else if (event.code === 'Enter') enterPressed = false;
    else return;
    button.classList.remove('pressed');
  });
}

let redPlayingCount = 0;
let bluePlayingCount = 0;

let redLedCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let blueLedCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

async function updateLEDs() {
  const redPlaying = redPlayingCount > 0;
  const bluePlaying = bluePlayingCount > 0;

  await gattQueue.enqueue(async () => {
    await redLedCharacteristic?.writeValueWithoutResponse(new Uint8Array([+redPlaying]));
    await blueLedCharacteristic?.writeValueWithoutResponse(new Uint8Array([+bluePlaying]));
  });

  document.getElementById('button-7')!
    .classList[redPlaying ? 'add' : 'remove']('playing');
  document.getElementById('button-8')!
    .classList[bluePlaying ? 'add' : 'remove']('playing');
}

let wakeLock: WakeLockSentinel | null = null;

async function connect(prompt: boolean) {
  console.log('Connecting...');
  try {
    let server: BluetoothRemoteGATTServer | null = null;
    try {
      const devices = await navigator.bluetooth.getDevices();
      if (devices.length > 0) {
        const device = devices[0];
        console.log(device);
        const promise = new Promise<void>((resolve, reject) => {
          const listener = () => {
            clearTimeout(timeoutId);
            console.log('Advertisement received');
            resolve();
            device.removeEventListener('advertisementreceived', listener);
          };
          device.addEventListener('advertisementreceived', listener);
          let timeoutId = setTimeout(() => {
            device.removeEventListener('advertisementreceived', listener);
            reject(new Error('Timeout waiting for advertisement'));
          }, 5000);
        });
        await device.watchAdvertisements();
        try {
          await promise;
        } catch (error) {
          console.warn(error);
        }
        server = await device.gatt?.connect() ?? null;
        device.addEventListener('gattserverdisconnected', onDisconnect);
        console.log('GATT server connected');
      }
    } catch (error) {
      console.warn(error);
    }
    if (!server && prompt) {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{services: ['9877867b-0423-41db-a5ab-28d28f73e179']}],
      });
      if (device === null) {
        console.log('No device picked');
        return;
      }
      console.log(device);
      server = await device.gatt?.connect() ?? null;
      device.addEventListener('gattserverdisconnected', onDisconnect);
      console.log('GATT server connected after prompt');
    }

    if (!server) return;
    const service = await server.getPrimaryService('9877867b-0423-41db-a5ab-28d28f73e179');
    let buttonsCharacteristic: BluetoothRemoteGATTCharacteristic;
    [
      buttonsCharacteristic,
      redLedCharacteristic,
      blueLedCharacteristic
    ] = await Promise.all([
      'c8123c59-a994-4a78-be72-cf18878c803a',
      'ebb830c8-2fb5-418c-af89-1c4911e1ac86',
      'd08e6f8f-0e4b-4eec-88e5-130f17f35c7a'
    ].map((uuid) => service.getCharacteristic(uuid)));
    await buttonsCharacteristic.startNotifications();
    buttonsCharacteristic.addEventListener('characteristicvaluechanged', () => {
      onValueChange(buttonsCharacteristic.value!);
    });
    console.log('Notifications started');

    connectButton.disabled = true;
    connectButtonIcon.innerText = 'bluetooth_connected';
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.warn('Failed to request wake lock', err);
    }

    onValueChange(await buttonsCharacteristic.readValue());
    await updateLEDs();
  } catch (error) {
    console.error(error);
  }
}

function getLitBytes(number: number) {
  let litBytes = [];
  for (let i = 0; number; ++i) {
    if (number % 2) litBytes.push(i);
    number = Math.floor(number / 2);
  }
  return litBytes;
}

let previousValue = 0;

function onValueChange(dataView: DataView) {
  const value = dataView.getUint16(0, true);
  getLitBytes(value & (previousValue ^ value)).forEach(async (i) => {
    playSound(i);
    document.getElementById(`button-${i}`)!.classList.add('pressed');
  });
  getLitBytes(previousValue & (previousValue ^ value)).forEach((i) => {
    document.getElementById(`button-${i}`)!.classList.remove('pressed');
  });
  previousValue = value;
}

async function onDisconnect() {
  console.log('GATT Server disconnected');
  wakeLock?.release();
  wakeLock = null;
  connectButton.disabled = false;
  connectButtonIcon.innerText = 'bluetooth';
  redLedCharacteristic = null;
  blueLedCharacteristic = null;
  await new Promise((resolve) => setTimeout(resolve, 2500));
  await connect(false);
}

const configDialog = document.getElementById('config-dialog') as HTMLDialogElement;
const configHistory = document.getElementById('config-dialog__history')!;
configDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
});

function showConfigWithError(message: unknown, details: unknown = '') {
  document.getElementById('config-dialog-error')!.classList.remove('hidden');
  document.getElementById('config-dialog-error__message')!.innerText = message instanceof Error ? message.message : `${message}`;
  document.getElementById('config-dialog-error__details')!.innerText = details instanceof Error ? details.message : `${details}`;
  configDialog.showModal();
}

async function loadConfig() {
  const params = new URLSearchParams(window.location.search);
  const configUrl = params.get('config');
  if (!configUrl) {
    configDialog.showModal();
    return false;
  }

  let data;
  try {
    const response = await fetch(configUrl);
    if (!response.ok) {
      showConfigWithError('Cannot load configuration', `Server responded with status code ${response.status} ${response.statusText}`);
      return;
    }
    data = jsyaml.load(await response.text());
    validateConfig(data);
  } catch (error) {
    console.error(error);
    showConfigWithError('Cannot load configuration', error);
    return;
  }
  const history = JSON.parse(localStorage.getItem('config-history') ?? '[]')
    .filter((url: string) => url !== configUrl);
  history.unshift(configUrl);
  localStorage.setItem('config-history', JSON.stringify(history));

  try {
    buttons = data.sounds.map((entry, index) => {
      let resolvedEntry = {
        src: [],
        ...entry ?? {},
      };
      const button = document.getElementById(`button-${index}`)!;
      if (typeof resolvedEntry.src === 'string') resolvedEntry.src = [resolvedEntry.src];
      button.title = resolvedEntry.name ?? (resolvedEntry.src.length > 0 ? resolvedEntry.src.join(', ') : 'No sound');
      return {
        players: resolvedEntry.src.map(url => new Audio(new URL(url, configUrl).toString())),
        mode: resolvedEntry.mode || 'random',
        nextSound: 0,
      };
    });

    buttons.forEach(({players}, index) => players.forEach(player => {
      player.addEventListener('play', async () => {
        if (index === 7) redPlayingCount++; else bluePlayingCount++;
        await updateLEDs();
      });
      player.addEventListener('ended', async () => {
        if (index === 7) redPlayingCount--; else bluePlayingCount--;
        await updateLEDs();
      });
    }));
    return true;
  } catch (error) {
    showConfigWithError(error);
  }
  return false;
}

async function start() {
  const history = JSON.parse(localStorage.getItem('config-history') ?? '[]');
  history.forEach((url: string) => {
    const link = configHistory
      .appendChild(document.createElement('li'))
      .appendChild(document.createElement('a'));
    link.text = url;
    link.href = `/?config=${encodeURIComponent(url)}`;
  })

  if (!await loadConfig()) return;

  console.log('Starting...');
  await connect(false);
  console.log('Ready!');
}

start().catch(console.error);

const resizeObserver = new ResizeObserver(entries => {
  document.documentElement.style.setProperty('--win-height', `${entries[0].target.clientHeight - 1}px`);
});
resizeObserver.observe(document.getElementById('content')!);

export const goFullscreen = () => document.documentElement.requestFullscreen();

document.addEventListener('click', () => {
  document.getElementById('interaction-required')!.classList.add('hidden');
}, {once: true});
