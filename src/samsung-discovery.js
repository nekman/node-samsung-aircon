import os from 'os';
import SamsungDevice from './samsung-device';
import { timeout, defaultLogger } from './utils';
import CustomSSDP from './custom-ssdp';

export const NetworkInterfaceNamesToIgnore = [
  'vmnet',
  'vboxnet',
  'vnic',
  'tun'
];

/**
* @return {os.NetworkInterfaceInfoIPv4[]}
*/
export function getNetworkInterfaces() {
 const foundNetworkInterfaces = [];
 const ifaces = os.networkInterfaces();

 for (const [name, networkInterfaceInfoList] of Object.entries(ifaces)) {
   if (NetworkInterfaceNamesToIgnore.includes(name)) {
     // eslint-disable-next-line no-continue
     continue;
   }

   networkInterfaceInfoList
     .filter(info => !info.internal)
     .filter(info => info.family === 'IPv4')
     .forEach(interfaceInfo => {
       foundNetworkInterfaces.push(interfaceInfo);
     });
 }

 return foundNetworkInterfaces;
}

/**
 * Tries to discover the Samsung Airconditioner via SSDP.
 */
export default class SamsungDiscovery {

  /**
   *
   * @param {CustomSSDP} ssdp
   */
  constructor(ssdp = new CustomSSDP()) {
    this.ssdp = ssdp;
    this.logger = defaultLogger;
    this.stopped = true;
  }

  /**
   * @param {typeof defaultLogger?} logger
   * @return {SamsungDiscovery}
  */
  setLogger(logger = defaultLogger) {
    this.logger = logger;

    return this;
  }

  /**
   * Stop discovery
   */
  stop() {
    this.stopped = true;

    // @ts-ignore
    this.ssdp.stop();
  }

  /**
   *
   * @param {number?} maxWaitTime - max waiting time in ms
   * @return {Promise<SamsungDevice[]>}
   */
  async discover(maxWaitTime = 10000) {
    this.stopped = false;

    const foundNetworkInterfaces = getNetworkInterfaces();

    if (!foundNetworkInterfaces.length) {
      throw new Error('No network interface information was found');
    }

    const promises = foundNetworkInterfaces.map(info => {
      return Promise.race([
        timeout(maxWaitTime, 'when waiting for devices.'),
        this.listen(info.address, 1900)
      ]);
    });

    try {
      const devices = await Promise.all(promises);
      return devices;
    } catch (e) {
      this.logger.error('ERROR during discover', e);
      if (this.stopped) {
        // Ignore the error, due to stopped.
        return;
      }
      throw e;
    }
  }

  /**
   * @private
   * @param {string} ipAddress
   * @param {number} port
   */
  async listen(ipAddress, port) {
    // @ts-ignore
    const socket = this.ssdp.sockets[ipAddress];

    return new Promise(resolve => {
      // @ts-ignore
      this.ssdp.on('advertise-alive', (deviceInfo, deviceAddressInfo) => {
        this.logger.debug('Got a device:', deviceInfo);

        if (deviceInfo.MODELCODE === 'SAMSUNG_DEVICE') {
          this.logger.debug('Found a samsung device.');

          resolve(new SamsungDevice({
            mac: deviceInfo.MAC_ADDR,
            ip: deviceAddressInfo.address,
            info: deviceInfo
          }, this.logger));
        }
      });

      // @ts-ignore
      socket.on('listening', () => {
        this.logger.debug('Listening...');

        this.ssdp.notify(ipAddress, port, 'AIR CONDITIONER', {
          SPEC_VER: 'MSpec-1.00',
          SERVICE_NAME: 'ControlServer-MLib',
          MESSAGE_TYPE: 'CONTROLLER_START'
        });
      });

      // @ts-ignore
      this.ssdp.start();
    });
  }
}
