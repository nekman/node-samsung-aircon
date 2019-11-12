import tls from 'tls';
// @ts-ignore
import carrier from 'carrier';
import {
  sleep, timeout, readCertificateFile, defaultLogger
} from './utils';

export default class SamsungDevice {
  /**
   * @param {{ ip: string, mac: string, info: any }} ssdpData
   * @param {typeof defaultLogger?} logger
   */
  constructor(ssdpData, logger = defaultLogger) {
    this.logger = logger;

    this.ip = ssdpData.ip;
    this.mac = ssdpData.mac;
    this.info = ssdpData.info;

    /** @type {tls.TLSSocket} */
    this.socket = null;

    /** @type {string} */
    this.token = null;

    this.state = {
      pendingStatus: false,
      loginSuccess: false,
      message: ''
    };
  }

  /**
   *
   * @param {string} token
   * @param {number?} maxWaitTime
   */
  async login(token, maxWaitTime = 10000) {
    this.token = token;

    return this.connect(maxWaitTime);
  }

  /**
   * @param {number?} maxWaitTime
   * @return {Promise<void>}
   */
  async connect(maxWaitTime = 10000) {
    const pfx = await readCertificateFile();

    this.logger.debug('connect');

    const promise = new Promise((resolve, reject) => {
      // @ts-ignore
      this.socket = tls.connect({
        pfx,
        port: 2878,
        host: this.ip,
        rejectUnauthorized: false,
        secureContext: tls.createSecureContext({  ciphers: 'HIGH:!DH:!aNULL' })
      }, err => {
        if (err) {
          this.logger.error('ERROR', err);
          return reject(err);
        }
        this.consumeSocketEvents();
        resolve();
      });

      this.socket.on('end', (err) => {
        this.logger.error('Socket unexpected hang up', err);
        reject(new Error('Unexpected hang up'));
      });

      this.socket.on('error', err => {
        this.logger.error('Socket error', err);
        reject(new Error(`Socket error! ${err.message}`));
      });
    });

    await Promise.race([timeout(maxWaitTime, 'when trying to connect'), promise]);
  }

  consumeSocketEvents() {
    this.socket.setEncoding('utf8');
    this.logger.debug('Consume socket events');


    carrier.carry(this.socket, (line) => {
      // eslint-disable-next-line no-console
      this.logger.debug('line', { line });

      if (line === 'DRC-1.00') {
        return this.state;
      }

      if (this.token && line === '<?xml version="1.0" encoding="utf-8" ?><Update Type="InvalidateAccount"/>') {
        this.send(`<Request Type="AuthToken"><User Token="${this.token}" /></Request>`);
        return this.state;
      }

      if (line === '<?xml version="1.0" encoding="utf-8" ?><Update Type="InvalidateAccount"/>') {
        this.send('<Request Type="GetToken" />');
        return this.state;
      }

      if (line === '<?xml version="1.0" encoding="utf-8" ?><Response Type="GetToken" Status="Ready"/>') {
        this.logger.debug('Please power on the device within the next 30 seconds');
        return this.updateState({
          waiting: true,
          message: 'Please power on the device within the next 30 seconds'
        });
      }

      /* examine the line that contains the result */
      if (line === '<?xml version="1.0" encoding="utf-8" ?><Response Status="Fail" Type="Authenticate" ErrorCode="301" />') {
        this.logger.debug('Failed authentication');
        return this.updateState({
          pendingStatus: false,
          loginSuccess: false,
          waiting: false,
          message: 'Failed authentication'
        });
      }

      if (line.match(/<Update Type="GetToken" Status="Completed" Token="/)) {
        const matches = line.match(/Token="(.*)"/);
        if (matches) {
          const [, token] = matches[1];
          this.token = token;

          return this.updateState({
            pendingStatus: false,
            waiting: false,
            loginSuccess: true,
            message: 'Got token'
          });
        }
      }

      if (line.match(/Response Type="AuthToken" Status="Okay"/)) {
        return this.updateState({
          loginSuccess: true,
          waiting: false,
          pendingStatus: false,
          message: 'Successful login'
        });
      }

      // Other events
      if (line.match(/Update Type="Status"/)) {
        const matches = line.match(/Attr ID="(.*)" Value="(.*)"/);
        if (matches) {
          return this.updateState({ [matches[1]]: matches[2] });
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

        return this.updateState({
          pendingStatus: false,
          message: '',
          ...newState
        });
      }
    });
  }

  /**
   * Get the current status.
   * @return {Promise<{ [x: string]: any }>}
   */
  async fetchStatus() {
    this.updateState({ pendingStatus: true });

    await this.waitOnConnected();

    this.send(`<Request Type="DeviceState" DUID="${this.mac}"></Request>`);

    await this.waitOnStatus();

    return this.state;
  }

  /**
   * Send a control command to the device.
   * E.g ```deviceControl('AC_FUN_POWER', 'Off');```
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
   * Set temperature.
   *
   * @param {string} temp
   */
  async setTemp(temp) {
    return this.deviceControl('AC_FUN_TEMPSET', temp);
  }


  /**
   * Sets the wind level.
   *
   * @param {'High' | 'Low' | 'Mid'} level
   */
  async setWindLevel(level = 'High') {
    return this.deviceControl('AC_FUN_WINDLEVEL', level);
  }

    /**
   *
   * @param {'Dry' | 'Wind' | 'Cool' | 'Heat'} mode
   */
  async setOpMode(mode = 'Heat') {
    return this.deviceControl('AC_FUN_OPMODE', mode);
  }

  /**
   * @private
   * @param {string} xml
   */
  send(xml) {
    // eslint-disable-next-line no-console
    this.logger.debug('SEND:', xml);
    this.socket.write(`${xml}\r\n`);

    return this;
  }

  /**
   * @private
   * @param {{[x: string]: any}} newState
   */
  updateState(newState) {
    this.state = { ...this.state, ...newState };

    return this.state;
  }

  /**
   * @private
   */
  async waitOnConnected() {
    if (!this.socket) {
      throw new Error('not logged in');
    }

    if (!this.state.loginSuccess) {
      await sleep(100);
      return this.waitOnConnected();
    }
  }

  /**
   * @private
   */
  async waitOnStatus() {
    if (!this.socket) {
      throw new Error('not logged in');
    }

    if (this.state.pendingStatus) {
      await sleep(100);
      return this.waitOnStatus();
    }
  }
}
