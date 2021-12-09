const connectButton = document.getElementById('connect-button');
const bigButton = document.getElementById('big-button');
const player = document.getElementById('player');

bigButton.addEventListener('click', () => player.play());

player.addEventListener('play', () => {
    bigButton.classList.add('big-button--pressed');
});
player.addEventListener('ended', () => {
    bigButton.classList.remove('big-button--pressed');
});

async function connect() {
    try {
        const device = await navigator.bluetooth.requestDevice({
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
        connectButton.disabled = true;

        console.log('> Notifications started');
        characteristic.addEventListener('characteristicvaluechanged', () => player.play());
    } catch (error) {
        console.error(error);
    }
}

function onDisconnect() {
    connectButton.disabled = false;
}
