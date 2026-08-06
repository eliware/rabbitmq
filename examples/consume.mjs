import { consume, close } from '../index.mjs';

await consume('events', 'topic', async message => {
  console.log('received', message);
});

process.once('SIGTERM', () => void close());
process.once('SIGINT', () => void close());
