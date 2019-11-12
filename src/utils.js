import fs from 'fs';
import { promisify } from 'util';

const asyncReadFile = promisify(fs.readFile);

/**
 *
 * @param {number} ms
 */
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 *
 * @param {number} ms
 */
export async function timeout(ms, extraMessage = '') {
  await sleep(ms);
  return Promise.reject(new Error(`Timeout! ${extraMessage}`));
}

const fileCache = {};

/**
 *
 * @param {{[x: string]: any}?} cache
 */
export async function readCertificateFile(cache = fileCache) {
  if (!cache.certificateFile) {
    cache.certificateFile = await asyncReadFile(`${__dirname}/ac14k_m.pfx`);
  }

  return cache.certificateFile;
}


/**
 * @param {...any?} args
 */
// eslint-disable-next-line no-unused-vars
function noopLogger(...args) {}

export const defaultLogger = {
  time: noopLogger,
  timeEnd: noopLogger,
  warn: noopLogger,
  info: noopLogger,
  debug: noopLogger,
  log: noopLogger,
  error: noopLogger
};
