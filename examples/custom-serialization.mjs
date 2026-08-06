import { publish, consume, close } from '../index.mjs';

const options = {
  serialize: value => `event:${value.name}`,
  deserialize: value => ({ name: value.replace('event:', '') }),
};

await consume('events', 'direct', message => {
  console.log('received', message);
}, {}, options);
await publish('events', 'direct', { name: 'created' }, {}, options);

process.once('SIGTERM', () => void close());
process.once('SIGINT', () => void close());
