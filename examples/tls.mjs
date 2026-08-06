import { connect, verifyConnection, close } from '../index.mjs';

const options = {
  rabbitUrl: process.env.RABBITMQ_URL,
  tls: {
    ca: process.env.RABBITMQ_TLS_CA,
    rejectUnauthorized: process.env.RABBITMQ_TLS_REJECT_UNAUTHORIZED !== 'false',
  },
};

await connect(options);
console.log(`TLS connection: ${await verifyConnection(options) ? 'ok' : 'failed'}`);
await close();
