# [![eliware.org](https://eliware.org/logos/brand.png)](https://discord.gg/M6aTR9eTwN)

## @eliware/rabbitmq [![npm version](https://img.shields.io/npm/v/@eliware/rabbitmq.svg)](https://www.npmjs.com/package/@eliware/rabbitmq)[![license](https://img.shields.io/github/license/eliware/rabbitmq.svg)](LICENSE)[![build status](https://github.com/eliware/rabbitmq/actions/workflows/nodejs.yml/badge.svg)](https://github.com/eliware/rabbitmq/actions)

A small, testable ESM RabbitMQ client for Node.js.

## Features

- Publish JSON messages to exchanges.
- Declare exchanges, queues, and bindings, then consume messages.
- Reuse one connection/channel per process.
- Accept a RabbitMQ URL or environment-based configuration.
- Dependency-inject `amqplib` and a logger for deterministic tests.
- Acknowledge messages only after the handler completes.
- Reconnect after transient connection/channel failures.
- Expose explicit connection, health-check, status, and close helpers.
- Support TLS options, custom serialization, message properties, backpressure, and failed-message requeue behavior.
- Includes TypeScript declarations and structured `RabbitMQError` errors.

## Installation

```bash
npm install @eliware/rabbitmq
```

## Configuration

Set `RABBITMQ_URL` directly, or set `RABBITMQ_HOST`, `RABBITMQ_USER`, `RABBITMQ_PASS`, and optionally `RABBITMQ_VHOST`. The generated URL is `amqp://user:pass@host/vhost`; credentials and the virtual host are URL-encoded. An explicit `rabbitUrl` in the final options object takes precedence.

## Usage

```js
import rabbitmq from '@eliware/rabbitmq';

await rabbitmq.publish('events', 'topic', { event: 'created' });

await rabbitmq.consume('events', 'topic', async (message) => {
  console.log(message);
});
```

`publish(queue, type, message, exchangeOptions?, runtimeOptions?)` declares the exchange and publishes JSON using `queue` as both exchange and routing key. `consume(queue, type, handler, options?, runtimeOptions?)` declares the exchange and queue, binds them, and invokes the handler with parsed JSON. Queues default to durable unless `durable: false` is explicitly supplied; this avoids deprecated transient non-exclusive queues on newer RabbitMQ versions. Invalid JSON is delivered as text.

Runtime options are `{ rabbitUrl, amqplibLib, logger, tls, reconnect, reconnectDelay, serialize, deserialize, messageOptions, consumeOptions, requeueOnError }`. A logger can provide `debug()` and `error()` methods. `RabbitMQError` identifies connection/configuration failures and exposes an `operation` field.

```js
import { RabbitMQError, getRabbitUrl } from '@eliware/rabbitmq';

console.log(getRabbitUrl());
try {
  await rabbitmq.publish('events', 'direct', { ok: true }, {}, { rabbitUrl: process.env.RABBITMQ_URL });
} catch (error) {
  if (error instanceof RabbitMQError) console.error(error.operation, error.message);
  throw error;
}
```

`connect()` establishes or reuses the shared connection, `isConnected()` reports its state, `verifyConnection()` performs a health check, and `close()` gracefully closes it. Operations retry once after a connection failure by default; set `reconnect: false` to disable that behavior. Acknowledge/reject failures during shutdown are safely ignored and logged at debug level. `_resetRabbitMQTestState()` is retained for test cleanup or deliberate reconnects.

## Examples

Runnable examples are in [`examples/`](examples/):

- `basic-publish.mjs`
- `consume.mjs`
- `tls.mjs`
- `reconnect.mjs`
- `custom-serialization.mjs`
- `graceful-shutdown.mjs`

Run one with `node examples/basic-publish.mjs` after configuring the `RABBITMQ_*` environment variables.

## TypeScript

Type declarations are included automatically:

```ts
import { consume, publish } from '@eliware/rabbitmq';
await publish('events', 'direct', { hello: 'world' });
await consume('events', 'direct', (message) => console.log(message));
```

## Links

- [Home Page](https://eliware.org)
- [GitHub](https://github.com/eliware/rabbitmq)
- [npm](https://www.npmjs.com/package/@eliware/rabbitmq)
- [Discord](https://discord.gg/M6aTR9eTwN)

## License

[MIT © 2025 Eli Sterling, eliware.org](LICENSE)
