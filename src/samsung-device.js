import tls from 'tls';
// @ts-ignore
import carrier from 'carrier';
import fs from 'fs';
import { promisify } from 'util';
import { sleep, timeout } from './utils';

const asyncReadFile = promisify(fs.readFile);


export default class SamsungDevice {
  /**
   * @param {{ token: string, ip: string, mac: string, info: any }} ssdpData
   */
  constructor(ssdpData) {
    this.token = ssdpData.token;
    this.ip = ssdpData.ip;
    this.mac = ssdpData.mac;
    this.info = ssdpData.info;

    /** @type {tls.TLSSocket} */
    this.socket = null;
    this.state = {};
  }

  /**
   * @param {number?} maxWaitTime
   * @return {Promise<void>}
   */
  async connect(maxWaitTime = 10000) {
    const pfx = await asyncReadFile('./ac14k_m.pfx');

    const promise = new Promise((resolve, reject) => {
      // @ts-ignore
      this.socket = tls.connect({
        pfx,
        port: 2878,
        host: this.ip,
        rejectUnauthorized: false,
        // https://github.com/CloCkWeRX/node-samsung-airconditioner/issues/7
        // Error: 140735892054848:error:14082174:SSL routines:ssl3_check_cert_and_algorithm:dh key too small:../deps/openssl/openssl/ssl/s3_clnt.c:3641:
        secureContext: tls.createSecureContext({  ciphers: 'HIGH:!DH:!aNULL' })
      }, err => {
        if (err) {
          return reject(err);
        }
        resolve();
        this.consumeSocketEvents();
      });

      this.socket.on('end', () => {
        reject(new Error('Unexpected hang up'));
      });

      this.socket.on('error', err => {
        reject(new Error(`Socket error! ${err.message}`));
      });
    });

    await Promise.race([timeout(maxWaitTime), promise]);
  }

  consumeSocketEvents() {
    this.socket.setEncoding('utf8');

    carrier.carry(this.socket, (line) => {
      // console.log('LINE', { line });

      if (line === 'DRC-1.00') {
        return;
      }

      if (line === '<?xml version="1.0" encoding="utf-8" ?><Update Type="InvalidateAccount"/>') {
        return this.send(`<Request Type="AuthToken"><User Token="${this.token}" /></Request>`);
      }

      if (line.match(/Response Type="AuthToken" Status="Okay"/)) {
        this.updateState({ loginSuccess: true });
      }

      // Other events
      if (line.match(/Update Type="Status"/)) {
        const matches = line.match(/Attr ID="(.*)" Value="(.*)"/);
        if (matches) {
          this.updateState({ [matches[1]]: matches[2] });
        }
      }

      if (line.match(/Response Type="DeviceState" Status="Okay"/)) {
        const attributes = line.split('><');
        const newState = {};
        attributes.forEach(attr => {
          const matches = attr.match(/Attr ID="(.*)" Type=".*" Value="(.*)"/);
          if (matches) {
            const [, key, value] = matches;
            newState[key] = value;
          }
        });

        this.updateState(newState);
        this.pendingStatus = false;
      }
    });
  }

  updateState(newState) {
    this.state = { ...this.state, ...newState };

    return this.state;
  }

  async waitOnConnected() {
    if (!this.socket) {
      throw new Error('not logged in');
    }

    if (!this.state.loginSuccess) {
      await sleep(100);
      return this.waitOnConnected();
    }
  }

  async waitOnStatus() {
    if (!this.socket) {
      throw new Error('not logged in');
    }

    if (this.pendingStatus) {
      await sleep(100);
      return this.waitOnStatus();
    }
  }


  async fetchStatus() {
    this.pendingStatus = true;

    await this.waitOnConnected();

    this.send(`<Request Type="DeviceState" DUID="${this.mac}"></Request>`);

    await this.waitOnStatus();

    return this.state;
  }

  /**
   *
   * @param {string} key
   * @param {string} value
   */
  async deviceControl(key, value) {
    await this.waitOnConnected();

    const id = Math.round(Math.random() * 10000);

    return this.send(
      `<Request Type="DeviceControl"><Control CommandID="cmd${id}" DUID="${this.mac}"><Attr ID="${key}" Value="${value}" /></Control></Request>`
    );
  }


  /**
   *
   * @param {string} xml
   */
  send(xml) {
    this.socket.write(`${xml}\r\n`);

    return this;
  }
}
