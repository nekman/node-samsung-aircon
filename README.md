# samsung-aircon

An attempt to refactor the  [node-samsung-airconditioner](https://github.com/zyrorl/node-samsung-airconditioner) library to use Promises.
Of course, this is not a bullet proof solution, because we connect to a socket so 
we might of course miss some events.

However, for basic use cases like connecting, reading a status and change a value it works fine.

### Example
```javascript
import SamsungDiscovery from 'node-samsung-aircon';

async function main() {
  const discovery = new SamsungDiscovery();
  const [device] = await discovery.discover();

  console.log('Found a Samsung device', device);

  const status = await device.fetchStatus();
  console.log('Status', status);
}

main();
```