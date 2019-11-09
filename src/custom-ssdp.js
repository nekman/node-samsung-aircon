/* eslint-disable no-nested-ternary */
import { Server } from 'node-ssdp';
import netmask from 'netmask';
import { getSSDPHeader } from './utils';

export default class CustomSSDP extends Server {

  /**
   *
   * @param {string} ipAddress
   * @param {number} port
   * @param {string} signature
   * @param {{ [x: string]: string }} headers
   */
  notify(ipAddress, port, signature, headers) {

    // @ts-ignore
    Object.keys(this._usns).forEach(() => {
      const heads = {
        HOST: '239.255.255.250:1900',
        'CACHE-CONTROL': 'max-age=20',
        SERVER: signature,
        LOCATION: ipAddress
      };

      let out = getSSDPHeader('NOTIFY', heads);

      Object.entries(headers).forEach(([key, value]) => {
        out += `${key}: ${value}\r\n`;
      });

      const quad0 = parseInt(ipAddress.split('.')[0], 10);
      // eslint-disable-next-line no-bitwise
      const mask = ((quad0 & 0x80) === 0) ? 8 : ((quad0 & 0xc0) === 0xf0) ? 16 : 24;

      // TBD: use the (obsolete) class A/B/C netmasks
      const bcast = new netmask.Netmask(`${ipAddress}/${mask}`).broadcast;

      const buffer = Buffer.from(out);

      // @ts-ignore
      const socket = this.sockets[ipAddress];

      socket.setBroadcast(true);

      socket.send(buffer, 0, buffer.length, port, bcast);
    });
  }
}
