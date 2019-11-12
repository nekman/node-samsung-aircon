# node-samsung-aircon

An attempt to refactor the  [node-samsung-airconditioner](https://github.com/zyrorl/node-samsung-airconditioner) library to use Promises.
Of course, this is not a bullet proof solution, because we connect to a socket so 
we might of course miss some events.

However, for basic use cases like connecting, reading a status and change a value it works fine.

### Example
```javascript
import SamsungDiscovery from 'node-samsung-aircon';
 
async function main() {
  // Create a discovery (with an optional logger)
  const discovery = new SamsungDiscovery().withLogger(console);
  const [aircon] = await discovery.discover();
 
  // Found device(s), we can now stop to discover more
  discovery.stop();

  console.log('Found a aircon device', aircon);

  try {
    // If a token is not supplied, just follow the
    // instuctions when prompted to power on the AC
    // and write down the token for the future.
    await aircon.login(process.env.TOKEN);
  } catch (e) {
    console.error('ERROR when trying to login', err);
  }
 
  const status = await aircon.fetchStatus();
  console.log('Status', status);
}
 
main()
.then(() => console.log('Done!'))
.catch(err => {
  console.log('ERROR!', err);
  process.exit(1);
});

```