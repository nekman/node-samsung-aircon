# node-samsung-aircon

An attempt to refactor the  [node-samsung-airconditioner](https://github.com/zyrorl/node-samsung-airconditioner) library to use promises.
Of course, this is not a bullet proof solution, because we connect to a socket 
that sends events...

However, for basic use cases like connecting, reading a status and change a value it works fine. And for other use cases it's probablby flawed and buggy. Please submit an issue if anything strange is found.

### Installation
```bash
npm i node-samsung-aircon -S
```
### Examples

The `main` function in all examples below are called like this:
```javascript
main()
.then(() => process.exit(0))
.catch(err => {
  console.log('ERROR!', err);
  process.exit(1);
});
```

#### With promises

```javascript
import SamsungDiscovery, { Utils } from 'node-samsung-aircon';
 
async function main() {
  // Create a discovery (with an optional logger)
  const discovery = new SamsungDiscovery().withLogger(console);
  const [aircon] = await discovery.discover();
 
  // Found device(s), we can now stop to discover more
  discovery.stop();
 
  // If a token is not supplied, just follow the
  // instuctions when prompted to power on the AC
  // and write down the token for the future.
  await aircon.login(process.env.TOKEN);
 
  // Wait before we ask for status (due to promises and events)
  // below is also an example where we consume events.
  await Utils.sleep(2000);

  const status = await aircon.fetchStatus();
  console.log({ status });
}
```

#### With promises (and events)

```javascript
import SamsungDiscovery, { Utils } from 'node-samsung-aircon';

async function main() {
  const discovery = new SamsungDiscovery();
  const [aircon] = await discovery.discover();
 
  // Found device(s), we can now stop to discover more
  discovery.stop();

  // Consume events
  aircon.on('read', line => {
    console.log('Read line', line);
  });
 
  aircon.on('state', state => {
    console.log('New state', state);
  });

  await aircon.login(process.env.TOKEN);
  await Utils.sleep(2000);

  await aircon.setTemp('22');
  await Utils.sleep(2000);

  await aircon.fetchStatus();
  await Utils.sleep(2000);
}
```

### Public API

```typescript
interface SamsungDiscovery {
  withLogger(logger: Partial<Console>): SamsungDiscovery;
  discover(maxWaitTime?: number): Promise<SamsungAircon[]>;
  stop(): void;
}
```

```typescript
interface SamsungAircon {
  connect(maxWaitTime?: number): Promise<void>;
  login(token: string, maxWaitTime?: number): Promise<void>;
  setTemp(temp: string): Promise<void>;
  setWindLevel(level: 'High' | 'Low' | 'Mid'): Promise<void>;
  setOpMode(mode: 'Dry' | 'Wind' | 'Cool' | 'Heat'): Promise<void>;
  deviceControl(key: string, value: string): Promise<void>;

  on(eventName: 'read' | 'state', (msg: any) => void): SamsungAircon;
}
```
