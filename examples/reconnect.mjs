import { connect, publish, close } from '../index.mjs';

const options = { reconnect: true, reconnectDelay: 250 };
await connect(options);
await publish('events', 'topic', { event: 'reconnect-safe' }, {}, options);
await close();
