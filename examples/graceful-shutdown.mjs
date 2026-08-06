import { close, consume } from '../index.mjs';

await consume('events', 'topic', message => {
  console.log('received', message);
});

async function shutdown() {
  await close();
  process.exit(0);
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
