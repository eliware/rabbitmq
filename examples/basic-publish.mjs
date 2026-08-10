import { close, publish } from '../index.mjs';

await publish('events', 'topic', { event: 'created' });
console.log('published');
await close();
