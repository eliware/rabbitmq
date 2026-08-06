import log from '@eliware/log';
import amqplib from 'amqplib';

export class RabbitMQError extends Error {
  constructor(message, { cause, operation } = {}) { super(message, { cause }); this.name = 'RabbitMQError'; this.operation = operation; }
}

export function getRabbitUrl(opts = {}) {
  if (opts.rabbitUrl) return opts.rabbitUrl;
  const { RABBITMQ_HOST: host, RABBITMQ_USER: user, RABBITMQ_PASS: pass, RABBITMQ_VHOST: vhost = '' } = process.env;
  if (!host) return null;
  return `amqp://${encodeURIComponent(user ?? '')}:${encodeURIComponent(pass ?? '')}@${host}/${encodeURIComponent(vhost)}`;
}
function validateName(value, label) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string`); }
function validateOptions(options) { if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be an object'); }

let connection;
let channel;

export async function _resetRabbitMQTestState() {
  const current = connection;
  connection = undefined;
  channel = undefined;
  if (current) { try { await current.close(); } catch {} }
}

async function connect({ amqplibLib, rabbitUrl }) {
  const url = getRabbitUrl({ rabbitUrl });
  const library = amqplibLib ?? amqplib;
  if (!url) throw new RabbitMQError('RabbitMQ URL or environment variables are required', { operation: 'connect' });
  if (!connection) { connection = await library.connect(url); channel = await connection.createChannel(); }
  return channel;
}

export async function publish(queue, type, message, options = {}, opts = {}) {
  validateName(queue, 'queue'); validateName(type, 'type'); validateOptions(options); validateOptions(opts);
  try {
    const ch = await connect({ amqplibLib: opts.amqplibLib, rabbitUrl: opts.rabbitUrl });
    await ch.assertExchange(queue, type, options);
    ch.publish(queue, queue, Buffer.from(JSON.stringify(message)));
    (opts.logger || log).debug(`Published message to exchange '${queue}' with routing key '${queue}'`, { message: JSON.stringify(message) });
  } catch (error) {
    (opts.logger || log).error(`Failed to publish message to exchange '${queue}'`, { error });
    throw error;
  }
}

export async function consume(queue, type, onMessage, options = {}, opts = {}) {
  validateName(queue, 'queue'); validateName(type, 'type');
  if (typeof onMessage !== 'function') throw new TypeError('onMessage must be a function');
  validateOptions(options); validateOptions(opts);
  try {
    const ch = await connect({ amqplibLib: opts.amqplibLib, rabbitUrl: opts.rabbitUrl });
    await ch.assertExchange(queue, type, options);
    await ch.assertQueue(queue, options);
    await ch.bindQueue(queue, queue, queue);
    await ch.consume(queue, async (msg) => {
      if (msg === null) return;
      let content; try { content = JSON.parse(msg.content.toString()); } catch { content = msg.content.toString(); }
      await onMessage(content); ch.ack(msg);
    });
    (opts.logger || log).debug(`Consuming queue '${queue}' (bound to exchange '${queue}')`);
  } catch (error) {
    (opts.logger || log).error(`Failed to consume messages from queue '${queue}'`, { error });
    throw error;
  }
}

export default { publish, consume, _resetRabbitMQTestState, getRabbitUrl, RabbitMQError };
