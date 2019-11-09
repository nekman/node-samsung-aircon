import os from 'os';
import SamsungDevice from './samsung-device';
import { timeout } from './utils';
import CustomSSDP from './custom-ssdp';

const NetworkInterfaceNamesToIgnore = [
  'vmnet',
  'vboxnet',
  'vnic',
  'tun'
];

export default class SamsungDiscovery {
  /**
   *
   * @param {string} token
   */
  constructor(token) {
    this.token = token;
    /** @type {os.NetworkInterfaceInfoIPv4[]} */
    this.foundNewtworkInterfaces = [];
    this.ssdp = new CustomSSDP();
  }

  /**
   * @return {os.NetworkInterfaceInfoIPv4[]}
   */
  getNetworkInterfaces() {
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
   *
   * @param {number?} maxWaitTime - max waiting time in ms
   * @return {Promise<SamsungDevice>}
   */
  async discover(maxWaitTime = 10000) {
    const foundNetworkInterfaces = this.getNetworkInterfaces();

    if (!foundNetworkInterfaces.length) {
      throw new Error('No network interface information was found');
    }

    const [first] = foundNetworkInterfaces;

    const device = await Promise.race([
      timeout(maxWaitTime),
      this.listen(first.address, 1900)
    ]);

    return device;
  }

  /**
   *
   * @param {string} ipAddress
   * @param {number} port
   */
  async listen(ipAddress, port) {
    const socket = this.ssdp.sockets[ipAddress];

    return new Promise(resolve => {
      this.ssdp.on('advertise-alive', (deviceInfo, deviceAddressInfo) => {
        if (deviceInfo.MODELCODE === 'SAMSUNG_DEVICE') {
          resolve(new SamsungDevice({
            token: this.token,
            mac: deviceInfo.MAC_ADDR,
            ip: deviceAddressInfo.address,
            info: deviceInfo
          }));

          this.ssdp.stop();
        }
      });

      // @ts-ignore
      socket.on('listening', () => {
        this.ssdp.notify(ipAddress, port, 'AIR CONDITIONER', {
          SPEC_VER: 'MSpec-1.00',
          SERVICE_NAME: 'ControlServer-MLib',
          MESSAGE_TYPE: 'CONTROLLER_START'
        });
      });

      this.ssdp.start();
    });
  }
}
