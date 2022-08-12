const connectButton = document.getElementById('connect-button');
const connectButtonIcon = document.getElementById('connect-button-icon');

const files = ['emergency-meeting.mp3', undefined, undefined, 'dobrze.mp3', undefined, undefined, undefined, 'buzzer.mp3', 'ding.mp3'];
const players = files.map((file) => new Audio(`sounds/${file}`));

const gattQueue = {
    handlers: [],
    async handleAll() {
        for (let i = 0; i < this.handlers.length; i++) {
            const {handler, resolve, reject} = this.handlers[i];
            try {
                await handler();
                resolve();
            } catch (error) {
                reject(error);
            }
        }
        this.handlers = [];
    },
    enqueue(handler) {
        return new Promise((resolve, reject) => {
            this.handlers.push({ handler, resolve, reject });
            if (this.handlers.length === 1) this.handleAll().catch(console.error);
        });
    },
};

function playSound(index) {
    const player = players[index];
    if (!player) {
        console.warn(`No player for ${index}`);
        return;
    }
    player.currentTime = 0;
    player.play();
}

for (let i = 0; i < 9; ++i) {
    let button = document.getElementById(`button-${i}`);
    button.addEventListener('click', () => playSound(i));
    button.title = files[i] || 'No sound';
}

let redPlayingCount = 0;
let bluePlayingCount = 0;

let redLedCharacteristic = null;
let blueLedCharacteristic = null;

async function updateLEDs() {
    const redPlaying = redPlayingCount > 0;
    const bluePlaying = bluePlayingCount > 0;

    await gattQueue.enqueue(async () => {
        await redLedCharacteristic?.writeValueWithoutResponse(new Uint8Array([ redPlaying ]));
        await blueLedCharacteristic?.writeValueWithoutResponse(new Uint8Array([ bluePlaying ]));
    });

    document.getElementById('button-7')
        .classList[redPlaying ? 'add' : 'remove']('playing');
    document.getElementById('button-8')
        .classList[bluePlaying ? 'add' : 'remove']('playing');
}

players.forEach((player, index) => {
    player.addEventListener('play', async () => {
        if (index === 7) redPlayingCount++; else bluePlayingCount++;
        await updateLEDs();
    });
    player.addEventListener('ended', async () => {
        if (index === 7) redPlayingCount--; else bluePlayingCount--;
        await updateLEDs();
    });
});

let wakeLock = null;

async function connect(prompt) {
    console.log('Connecting...');
    try {
        let server = null;
        try {
            const devices = await navigator.bluetooth.getDevices();
            if (devices.length > 0) {
                const device = devices[0];
                console.log(device);
                const promise = new Promise((resolve, reject) => {
                    const listener = () => {
                        clearTimeout(timeoutId);
                        console.log('Advertisement received');
                        resolve();
                    };
                    device.addEventListener('advertisementreceived', listener, { once: true });
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
                server = await device.gatt.connect();
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
            server = await device.gatt.connect();
            device.addEventListener('gattserverdisconnected', onDisconnect);
            console.log('GATT server connected after prompt');
        }

        if (!server) return;
        const service = await server.getPrimaryService('9877867b-0423-41db-a5ab-28d28f73e179');
        let buttonsCharacteristic;
        [
            buttonsCharacteristic,
            redLedCharacteristic,
            blueLedCharacteristic
        ] = await Promise.all([
            'c8123c59-a994-4a78-be72-cf18878c803a',
            'ebb830c8-2fb5-418c-af89-1c4911e1ac86',
            'd08e6f8f-0e4b-4eec-88e5-130f17f35c7a'
        ].map((uuid) => service.getCharacteristic(uuid)));
        await updateLEDs();
        await buttonsCharacteristic.startNotifications();

        connectButton.disabled = true;
        connectButtonIcon.innerText = 'bluetooth_connected';
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.warn('Failed to request wake lock', err);
        }

        console.log('> Notifications started');
        onValueChange(await buttonsCharacteristic.readValue());
        buttonsCharacteristic.addEventListener('characteristicvaluechanged', () => {
            onValueChange(buttonsCharacteristic.value);
        });
    } catch (error) {
        console.error(error);
    }
}

function getLitBytes(number) {
    let litBytes = [];
    for (let i = 0; number; ++i) {
        if (number % 2) litBytes.push(i);
        number = Math.floor(number / 2);
    }
    return litBytes;
}

const formatter = new Intl.ListFormat('en', {style: 'long', type: 'conjunction'});

let previousValue = 0;

function onValueChange(dataView) {
    const value = dataView.getUint16(0, true);
    getLitBytes(value & (previousValue ^ value)).forEach((i) => {
        playSound(i);
        document.getElementById(`button-${i}`).classList.add('pressed');
    });
    getLitBytes(previousValue & (previousValue ^ value)).forEach((i) => {
        document.getElementById(`button-${i}`).classList.remove('pressed');
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

async function start() {
    console.log('Starting...');
    const devices = await navigator.bluetooth.getDevices();
    await Promise.all(devices.map((device) => device.watchAdvertisements()))
    console.log('Ready!');
}

start().catch(console.error);
