/* eslint-disable no-console */
import SamsungDiscovery from './src/samsung-discovery';

const token = process.env.TOKEN || '<insert token>';

async function main() {
  console.log({ token });
  const device = await new SamsungDiscovery(token).discover();

  await device.connect();

  const status = await device.fetchStatus();

  console.log({ status });
}

main().then(() => {
  console.log('DONE!');
  process.exit(0);
}).catch(err => {
  console.error('ERROR!', err);
  process.exit(1);
});
