/* eslint-disable no-console */
import SamsungDiscovery from './src/samsung-discovery';
import { sleep } from './src/utils';

/**
 *
 * @param {NodeJS.ProcessEnv} env
 */
async function main(env = process.env) {
  const token = env.TOKEN;

  const discovery = new SamsungDiscovery().setLogger(console);
  const [device] = await discovery.discover();

  // We have our device(s), no need to continue to listen for new devices anymore.
  discovery.stop();

  console.log('device', { device });
  await device.login(token);
  const status = await device.fetchStatus();

  console.log('Current status', status);

  await device.setTemp('23');
  await sleep(2000);

  const newStatus = await device.fetchStatus();

  console.log('Current status', newStatus);
}

main().then(() => {
  console.log('DONE!');
  process.exit(0);
}).catch(err => {
  console.error('ERROR!', err.stack);
  process.exit(1);
});
