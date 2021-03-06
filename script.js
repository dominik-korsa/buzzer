const connectButton = document.getElementById('connect-button');
const bigButton = document.getElementById('big-button');
const player = document.getElementById('player');
const audioSelect = document.getElementById('audio-select');

function updateSrc() {
    player.src = `sounds/${audioSelect.value}.mp3`;
}

audioSelect.value = localStorage.getItem('buzzer-sound') || 'buzzer';
updateSrc();
audioSelect.addEventListener('change', () => {
    updateSrc();
    localStorage.setItem('buzzer-sound', audioSelect.value);
});

function playSound() {
    player.currentTime = 0;
    player.play();
}

bigButton.addEventListener('click', () => playSound());

player.addEventListener('play', () => {
    bigButton.classList.add('big-button--pressed');
});
player.addEventListener('ended', () => {
    bigButton.classList.remove('big-button--pressed');
});

let device;
let wakeLock = null;

async function connect(force) {
    console.log('Connecting...');
    try {
        if (force || !device) device = await navigator.bluetooth.requestDevice({
            filters: [{services: [parseInt('0xFFE0')]}]
        });
        if (device === null) {
            console.log('No device picked');
            return;
        }

        device.addEventListener('gattserverdisconnected', onDisconnect);
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(0xFFE0);
        const characteristic = await service.getCharacteristic(0xFFE1);
        await characteristic.startNotifications();
        if (device.id === 'XMPf1NtTCB4oXiZX091w0w==') bigButton.classList.add('big-button--blue');
        else bigButton.classList.remove('big-button--blue');
        connectButton.disabled = true;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.warn('Failed to request wake lock', err);
        }

        console.log('> Notifications started');
        characteristic.addEventListener('characteristicvaluechanged', () => playSound());
    } catch (error) {
        console.error(error);
    }
}

async function onDisconnect() {
    wakeLock?.release();
    wakeLock = null;
    connectButton.disabled = false;
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await connect(false);
}
