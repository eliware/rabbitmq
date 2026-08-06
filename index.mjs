import log from '@eliware/log';
import amqplib from 'amqplib';

export class RabbitMQError extends Error {
  constructor(message, { cause, operation } = {}) { super(message, { cause }); this.name = 'RabbitMQError'; this.operation = operation; }
}

export function getRabbitUrl(opts = {}) {
  if (opts.rabbitUrl) return opts.rabbitUrl;
  if (process.env.RABBITMQ_URL) return process.env.RABBITMQ_URL;
  const { RABBITMQ_HOST: host, RABBITMQ_USER: user, RABBITMQ_PASS: pass, RABBITMQ_VHOST: vhost = '' } = process.env;
  if (!host) return null;
  return `amqp://${encodeURIComponent(user ?? '')}:${encodeURIComponent(pass ?? '')}@${host}/${encodeURIComponent(vhost)}`;
}
function validateName(value, label) { if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string`); }
function validateOptions(options) { if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be an object'); }
function runtimeLogger(opts) { return opts.logger || log; }
function rabbitError(message, operation, cause) { if (cause instanceof RabbitMQError) return cause; const detail = cause instanceof Error && cause.message ? `: ${cause.message}` : ''; return new RabbitMQError(`${message}${detail}`, { operation, cause }); }

let connection;
let channel;
let connectionKey;
let connectPromise;
let reconnecting = false;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function clearConnection(current) {
  if (!current || connection === current) { connection = undefined; channel = undefined; connectionKey = undefined; }
}
function attachConnectionEvents(current, logger) {
  if (!current?.on) return;
  current.on('error', error => logger.error('RabbitMQ connection error', { error }));
  current.on('close', () => clearConnection(current));
  current.on('blocked', reason => logger.warn?.('RabbitMQ connection blocked', { reason }));
  current.on('unblocked', () => logger.info?.('RabbitMQ connection unblocked'));
}

export async function connect(opts = {}) {
  validateOptions(opts);
  const url = getRabbitUrl(opts);
  const library = opts.amqplibLib ?? amqplib;
  const logger = runtimeLogger(opts);
  if (!url) throw new RabbitMQError('RabbitMQ URL or environment variables are required', { operation: 'connect' });
  const key = `${url}:${JSON.stringify(opts.tls ?? {})}`;
  if (connection && channel && connectionKey === key) return { connection, channel };
  if (connectPromise) return connectPromise;
  connectPromise = (async () => {
    try {
      const current = await library.connect(url, opts.tls);
      const currentChannel = await current.createChannel();
      connection = current; channel = currentChannel; connectionKey = key;
      attachConnectionEvents(current, logger);
      return { connection: current, channel: currentChannel };
    } catch (error) { throw rabbitError('Failed to connect to RabbitMQ', 'connect', error); }
    finally { connectPromise = undefined; }
  })();
  return connectPromise;
}

export async function close() {
  const current = connection;
  clearConnection(current);
  if (current && typeof current.close === 'function') await current.close();
}
export function isConnected() { return connection !== undefined; }
export async function verifyConnection(opts = {}) {
  const { connection: current, channel: currentChannel } = await connect(opts);
  if (typeof currentChannel.checkExchange === 'function') await currentChannel.checkExchange('amq.direct');
  return Boolean(current);
}
export async function _resetRabbitMQTestState() { try { await close(); } catch {} }

async function withReconnect(fn, opts, operation) {
  try { return await fn((await connect(opts)).channel); }
  catch (error) {
    clearConnection(connection);
    if (opts.reconnect === false || reconnecting) throw rabbitError(`RabbitMQ ${operation} failed`, operation, error);
    reconnecting = true;
    try { await wait(opts.reconnectDelay ?? 50); return await fn((await connect(opts)).channel); }
    catch (retryError) { throw rabbitError(`RabbitMQ ${operation} failed`, operation, retryError); }
    finally { reconnecting = false; }
  }
}

export async function publish(queue, type, message, options = {}, opts = {}) {
  validateName(queue, 'queue'); validateName(type, 'type'); validateOptions(options); validateOptions(opts);
  const serializer = opts.serialize ?? JSON.stringify;
  try {
    return await withReconnect(async ch => {
      await ch.assertExchange(queue, type, options);
      const payload = Buffer.from(serializer(message));
      const result = opts.messageOptions === undefined ? ch.publish(queue, queue, payload) : ch.publish(queue, queue, payload, opts.messageOptions);
      if (result === false && typeof ch.once === 'function') await new Promise(resolve => ch.once('drain', resolve));
      runtimeLogger(opts).debug(`Published message to exchange '${queue}' with routing key '${queue}'`, { message: serializer(message) });
      return true;
    }, opts, 'publish');
  } catch (error) { runtimeLogger(opts).error(`Failed to publish message to exchange '${queue}'`, { error }); throw error; }
}

export async function consume(queue, type, onMessage, options = {}, opts = {}) {
  validateName(queue, 'queue'); validateName(type, 'type');
  if (typeof onMessage !== 'function') throw new TypeError('onMessage must be a function');
  validateOptions(options); validateOptions(opts);
  const deserialize = opts.deserialize ?? (value => { try { return JSON.parse(value); } catch { return value; } });
  try {
    return await withReconnect(async ch => {
      const queueOptions = { durable: true, ...options };
      await ch.assertExchange(queue, type, options); await ch.assertQueue(queue, queueOptions); await ch.bindQueue(queue, queue, queue);
      const handleMessage = async msg => {
        if (msg === null) return;
        try {
          await onMessage(deserialize(msg.content.toString()));
          try { ch.ack(msg); } catch (ackError) { runtimeLogger(opts).debug('RabbitMQ message acknowledgement failed during shutdown', { error: ackError }); }
        } catch (error) {
          runtimeLogger(opts).error(`Message handler failed for queue '${queue}'`, { error });
          if (typeof ch.nack === 'function') {
            try { ch.nack(msg, false, opts.requeueOnError ?? false); } catch (nackError) { runtimeLogger(opts).debug('RabbitMQ message rejection failed during shutdown', { error: nackError }); }
          }
        }
      };
      const result = opts.consumeOptions === undefined
        ? await ch.consume(queue, handleMessage)
        : await ch.consume(queue, handleMessage, opts.consumeOptions);
      runtimeLogger(opts).debug(`Consuming queue '${queue}' (bound to exchange '${queue}')`);
      return result;
    }, opts, 'consume');
  } catch (error) { runtimeLogger(opts).error(`Failed to consume messages from queue '${queue}'`, { error }); throw error; }
}

export default { connect, close, isConnected, verifyConnection, publish, consume, _resetRabbitMQTestState, getRabbitUrl, RabbitMQError };
