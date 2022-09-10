import PromiseQueue from "./promise-queue.js";

function getLitBytes(number: number) {
  let litBytes = [];
  for (let i = 0; number; ++i) {
    if (number % 2) litBytes.push(i);
    number = Math.floor(number / 2);
  }
  return litBytes;
}

const gattQueue = new PromiseQueue();

interface Handlers {
  connect: () => void;
  disconnect: () => void;
  buttonPressed: (i: number) => void;
  buttonReleased: (i: number) => void;
}

export class Bluetooth {
  private redLedCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private blueLedCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private previousValue = 0;
  private handlers: Handlers;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  async connect(prompt: boolean) {
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
          device.addEventListener('gattserverdisconnected', this.onDisconnect);
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
        device.addEventListener('gattserverdisconnected', this.onDisconnect);
        console.log('GATT server connected after prompt');
      }

      if (!server) return;
      const service = await server.getPrimaryService('9877867b-0423-41db-a5ab-28d28f73e179');
      let buttonsCharacteristic: BluetoothRemoteGATTCharacteristic;
      [
        buttonsCharacteristic,
        this.redLedCharacteristic,
        this.blueLedCharacteristic
      ] = await Promise.all([
        'c8123c59-a994-4a78-be72-cf18878c803a',
        'ebb830c8-2fb5-418c-af89-1c4911e1ac86',
        'd08e6f8f-0e4b-4eec-88e5-130f17f35c7a'
      ].map((uuid) => service.getCharacteristic(uuid)));
      await buttonsCharacteristic.startNotifications();
      buttonsCharacteristic.addEventListener('characteristicvaluechanged', () => {
        this.onValueChange(buttonsCharacteristic.value!);
      });
      console.log('Notifications started');
      this.onValueChange(await buttonsCharacteristic.readValue());
      this.handlers.connect();
    } catch (error) {
      console.error(error);
    }
  }

  private onValueChange(dataView: DataView) {
    const value = dataView.getUint16(0, true);
    getLitBytes(value & (this.previousValue ^ value)).forEach(this.handlers.buttonPressed);
    getLitBytes(this.previousValue & (this.previousValue ^ value)).forEach(this.handlers.buttonReleased);
    this.previousValue = value;
  }

  private async onDisconnect() {
    console.log('GATT Server disconnected');
    this.handlers.disconnect()
    this.redLedCharacteristic = null;
    this.blueLedCharacteristic = null;
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await this.connect(false);
  }

  setButtonsLit(red: boolean, blue: boolean) {
    return gattQueue.enqueue(async () => {
      await this.redLedCharacteristic?.writeValueWithoutResponse(new Uint8Array([+red]));
      await this.blueLedCharacteristic?.writeValueWithoutResponse(new Uint8Array([+blue]));
    });
  }
}
