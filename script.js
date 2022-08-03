const connectButton = document.getElementById('connect-button');
const connectButtonIcon = document.getElementById('connect-button-icon');

const files = ['emergency-meeting.mp3', undefined, undefined, 'dobrze.mp3', undefined, undefined, undefined, 'buzzer.mp3', 'ding.mp3'];
const players = files.map((file) => new Audio(`sounds/${file}`));

function playSound(index) {
    const player = players[index];
    if (!player) {
        console.warn(`No player for ${index}`);
        return;
    }
    player.currentTime = 0;
    player.play();
}

function bindButton(elementId, index) {
    let button = document.getElementById(elementId);
    button.addEventListener('click', () => playSound(index));
    button.title = files[index] || 'No sound';
}
for (let i = 0; i < 7; ++i) bindButton(`small-button-${i}`, i);
bindButton("big-red-button", 7);
bindButton("big-blue-button", 8);

// player.addEventListener('play', () => {
//     bigButton.classList.add('big-button--pressed');
// });
// player.addEventListener('ended', () => {
//     bigButton.classList.remove('big-button--pressed');
// });

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
                        resolve();
                    };
                    device.addEventListener('advertisementreceived', listener);
                    let timeoutId = setTimeout(() => {
                        device.removeEventListener('advertisementreceived', listener);
                        reject(new Error('Timeout waiting for advertisement'));
                    }, 10000);
                })
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
        const characteristic = await service.getCharacteristic('c8123c59-a994-4a78-be72-cf18878c803a');
        await characteristic.startNotifications();
        connectButton.disabled = true;
        connectButtonIcon.innerText = 'bluetooth_connected';
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.warn('Failed to request wake lock', err);
        }

        console.log('> Notifications started');
        onValueChange(await characteristic.readValue());
        characteristic.addEventListener('characteristicvaluechanged', () => {
            onValueChange(characteristic.value);
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
    });
    previousValue = value;
}

async function onDisconnect() {
    console.log('GATT Server disconnected');
    wakeLock?.release();
    wakeLock = null;
    connectButton.disabled = false;
    connectButtonIcon.innerText = 'bluetooth';
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await connect(false);
}

connect(false)
