import { jest } from '@jest/globals';
import * as rabbitmq from '../index.mjs';

const DUMMY_URL = 'amqp://user:pass@host/vhost';

describe('rabbitmq.mjs', () => {
    let mockChannel, mockConnection, mockAmqplib, mockLogger;

    beforeEach(() => {
        delete process.env.RABBITMQ_URL;
        delete process.env.RABBITMQ_HOST;
        delete process.env.RABBITMQ_USER;
        delete process.env.RABBITMQ_PASS;
        delete process.env.RABBITMQ_VHOST;
        mockChannel = {
            assertQueue: jest.fn().mockResolvedValue({}),
            assertExchange: jest.fn().mockResolvedValue({}),
            bindQueue: jest.fn().mockResolvedValue({}),
            publish: jest.fn(),
            consume: jest.fn((queue, cb) => { mockChannel._consumeCb = cb; }),
            ack: jest.fn()
        };
        mockConnection = {
            createChannel: jest.fn().mockResolvedValue(mockChannel),
            close: jest.fn().mockResolvedValue()
        };
        mockAmqplib = {
            connect: jest.fn().mockResolvedValue(mockConnection)
        };
        mockLogger = {
            debug: jest.fn(),
            error: jest.fn()
        };
    });

    afterEach(async () => {
        await rabbitmq._resetRabbitMQTestState();
        jest.clearAllMocks();
    });

    it('publish calls assertExchange and publish with correct args', async () => {
        await rabbitmq.publish('testq', 'direct', { foo: 'bar' }, {}, { amqplibLib: mockAmqplib, logger: mockLogger, rabbitUrl: DUMMY_URL });
        expect(mockChannel.assertExchange).toHaveBeenCalledWith('testq', 'direct', expect.any(Object));
        expect(mockChannel.publish).toHaveBeenCalledWith('testq', 'testq', Buffer.from(JSON.stringify({ foo: 'bar' })));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Published message'), expect.any(Object));
    });

    it('consume calls assertExchange, assertQueue, bindQueue, sets up consumer, calls onMessage and ack', async () => {
        const onMessage = jest.fn();
        await rabbitmq.consume('testq', 'direct', onMessage, {}, { amqplibLib: mockAmqplib, logger: mockLogger, rabbitUrl: DUMMY_URL });
        expect(mockChannel.assertExchange).toHaveBeenCalledWith('testq', 'direct', expect.any(Object));
        expect(mockChannel.assertQueue).toHaveBeenCalledWith('testq', expect.any(Object));
        expect(mockChannel.bindQueue).toHaveBeenCalledWith('testq', 'testq', 'testq');
        expect(mockChannel.consume).toHaveBeenCalledWith('testq', expect.any(Function));
        // Simulate a message
        const msg = { content: Buffer.from(JSON.stringify({ hello: 'world' })) };
        await mockChannel._consumeCb(msg);
        expect(onMessage).toHaveBeenCalledWith({ hello: 'world' });
        expect(mockChannel.ack).toHaveBeenCalledWith(msg);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Consuming queue'),);
    });

    it('consume handles invalid JSON gracefully', async () => {
        const onMessage = jest.fn();
        await rabbitmq.consume('testq', 'direct', onMessage, {}, { amqplibLib: mockAmqplib, logger: mockLogger, rabbitUrl: DUMMY_URL });
        const msg = { content: Buffer.from('notjson') };
        await mockChannel._consumeCb(msg);
        expect(onMessage).toHaveBeenCalledWith('notjson');
        expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });
});

test('builds URLs and validates inputs', async () => {
  const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
  expect(rabbitmq.getRabbitUrl({ rabbitUrl: DUMMY_URL })).toBe(DUMMY_URL);
  const saved = { ...process.env };
  process.env.RABBITMQ_HOST = 'rabbit host'; process.env.RABBITMQ_USER = 'u@'; process.env.RABBITMQ_PASS = 'p&'; process.env.RABBITMQ_VHOST = 'v/h';
  expect(rabbitmq.getRabbitUrl()).toContain('@rabbit host/');
  delete process.env.RABBITMQ_HOST;
  expect(rabbitmq.getRabbitUrl()).toBeNull(); Object.assign(process.env, saved);
  await expect(rabbitmq.publish('', 'direct', {})).rejects.toThrow('queue');
  await expect(rabbitmq.publish('q', '', {})).rejects.toThrow('type');
  await expect(rabbitmq.publish('q', 'direct', {}, [], {})).rejects.toThrow('options');
  await expect(rabbitmq.publish('q', 'direct', {}, {}, [])).rejects.toThrow('options');
  await expect(rabbitmq.publish('q', 'direct', {})).rejects.toBeInstanceOf(rabbitmq.RabbitMQError);
  await expect(rabbitmq.consume('q', 'direct', null)).rejects.toThrow('onMessage');
  expect(new rabbitmq.RabbitMQError('x', { operation: 'test' }).operation).toBe('test');
  } finally { stderr.mockRestore(); stdout.mockRestore(); }
});

test('covers connection and consumer edge failures', async () => {
  const logger = { debug: jest.fn(), error: jest.fn() };
  const channel = { publish: jest.fn(), assertExchange: jest.fn().mockResolvedValue({}), assertQueue: jest.fn().mockResolvedValue({}), bindQueue: jest.fn().mockResolvedValue({}), consume: jest.fn(), ack: jest.fn() };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockRejectedValue(new Error('closed')) };
  const lib = { connect: jest.fn().mockResolvedValue(connection) };
  await rabbitmq.consume('edge', 'direct', jest.fn(), {}, { amqplibLib: lib, logger, rabbitUrl: DUMMY_URL });
  const cb = channel.consume.mock.calls[0][1]; await cb(null); expect(channel.ack).not.toHaveBeenCalled();
  await rabbitmq._resetRabbitMQTestState();
  const failing = { connect: jest.fn().mockRejectedValue(new Error('down')) };
  await expect(rabbitmq.publish('q', 'direct', {}, {}, { amqplibLib: failing, logger, rabbitUrl: DUMMY_URL })).rejects.toThrow('down');
  await expect(rabbitmq.consume('q', 'direct', jest.fn(), {}, { amqplibLib: failing, logger, rabbitUrl: DUMMY_URL })).rejects.toThrow('down');
  expect(logger.error).toHaveBeenCalled();
});

test('covers defaults, connection reuse, environment fallbacks, and logger fallback', async () => {
  await rabbitmq._resetRabbitMQTestState();
  expect(new rabbitmq.RabbitMQError('default')).toBeInstanceOf(Error);
  const saved = { ...process.env };
  process.env.RABBITMQ_HOST = 'rabbit';
  delete process.env.RABBITMQ_USER; delete process.env.RABBITMQ_PASS; delete process.env.RABBITMQ_VHOST;
  expect(rabbitmq.getRabbitUrl()).toBe('amqp://:@rabbit/');
  Object.assign(process.env, saved);
  const channel = { assertExchange: jest.fn().mockResolvedValue({}), publish: jest.fn() };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue() };
  const lib = { connect: jest.fn().mockResolvedValue(connection) };
  await rabbitmq.publish('q', 'direct', { a: 1 }, {}, { amqplibLib: lib, rabbitUrl: DUMMY_URL, logger: null });
  await rabbitmq.publish('q', 'direct', { a: 2 }, {}, { amqplibLib: lib, rabbitUrl: DUMMY_URL, logger: null });
  expect(lib.connect).toHaveBeenCalledTimes(1);
});

test('consume supports the default logger path', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const channel = { publish: jest.fn(), assertExchange: jest.fn().mockResolvedValue({}), assertQueue: jest.fn().mockResolvedValue({}), bindQueue: jest.fn().mockResolvedValue({}), consume: jest.fn() };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue() };
  await rabbitmq.consume('default-log', 'direct', jest.fn(), {}, { amqplibLib: { connect: jest.fn().mockResolvedValue(connection) }, rabbitUrl: DUMMY_URL, logger: null });
});

test('consume error path supports the default logger', async () => {
  const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  try {
  await rabbitmq._resetRabbitMQTestState();
  const channel = { assertExchange: jest.fn().mockRejectedValue(new Error('exchange down')) };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue() };
  await expect(rabbitmq.consume('error-log', 'direct', jest.fn(), {}, { amqplibLib: { connect: jest.fn().mockResolvedValue(connection) }, rabbitUrl: DUMMY_URL, logger: null })).rejects.toThrow('exchange down');
  } finally { stderr.mockRestore(); stdout.mockRestore(); }
});

test('supports lifecycle, health checks, connection events, TLS, and backpressure', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const listeners = {};
  const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() };
  const channel = { checkExchange: jest.fn().mockResolvedValue({}), assertExchange: jest.fn().mockResolvedValue({}), publish: jest.fn(() => false), once: jest.fn((event, cb) => { if (event === 'drain') cb(); }) };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue(), on: jest.fn((event, cb) => { listeners[event] = cb; }) };
  const lib = { connect: jest.fn().mockResolvedValue(connection) };
  expect(rabbitmq.isConnected()).toBe(false);
  await rabbitmq.connect({ amqplibLib: lib, rabbitUrl: DUMMY_URL, tls: { ca: 'ca' }, logger });
  expect(await rabbitmq.verifyConnection({ amqplibLib: lib, rabbitUrl: DUMMY_URL, logger })).toBe(true);
  await rabbitmq.publish('q', 'direct', { ok: true }, {}, { amqplibLib: lib, rabbitUrl: DUMMY_URL, logger });
  listeners.error(new Error('x')); listeners.blocked('busy'); listeners.unblocked(); listeners.close();
  expect(logger.error).toHaveBeenCalled();
  await rabbitmq.close();
  expect(rabbitmq.isConnected()).toBe(false);
});

test('supports custom message options and nack on handler failure', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const channel = { publish: jest.fn(), assertExchange: jest.fn().mockResolvedValue({}), assertQueue: jest.fn().mockResolvedValue({}), bindQueue: jest.fn().mockResolvedValue({}), consume: jest.fn((q, cb) => { channel.cb = cb; return { consumerTag: 'tag' }; }), ack: jest.fn(), nack: jest.fn() };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue() };
  const lib = { connect: jest.fn().mockResolvedValue(connection) };
  const logger = { debug: jest.fn(), error: jest.fn() };
  await rabbitmq.publish('q', 'direct', { x: 1 }, {}, { amqplibLib: lib, rabbitUrl: DUMMY_URL, logger, messageOptions: { persistent: true } });
  const fail = jest.fn(() => { throw new Error('handler'); });
  await rabbitmq.consume('q-default', 'direct', fail, {}, { amqplibLib: lib, rabbitUrl: DUMMY_URL, logger });
  await channel.cb({ content: Buffer.from('x') });
  const result = await rabbitmq.consume('q', 'direct', fail, {}, { amqplibLib: lib, rabbitUrl: DUMMY_URL, logger, consumeOptions: { noAck: false }, requeueOnError: true, deserialize: value => ({ raw: value }) });
  await channel.cb({ content: Buffer.from('x') });
  expect(result.consumerTag).toBe('tag');
  expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
});

test('reconnects once after an operation failure', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const first = { assertExchange: jest.fn().mockRejectedValue(new Error('stale')), publish: jest.fn() };
  const second = { assertExchange: jest.fn().mockResolvedValue({}), publish: jest.fn() };
  const connections = [
    { createChannel: jest.fn().mockResolvedValue(first) },
    { createChannel: jest.fn().mockResolvedValue(second) },
  ];
  const lib = { connect: jest.fn().mockImplementation(() => Promise.resolve(connections.shift())) };
  await rabbitmq.publish('q', 'direct', {}, {}, { amqplibLib: lib, rabbitUrl: DUMMY_URL, reconnectDelay: 0, logger: { debug: jest.fn(), error: jest.fn() } });
  expect(lib.connect).toHaveBeenCalledTimes(2);
});


test('covers URL environment, connection reuse, and optional branches', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const saved = process.env.RABBITMQ_URL;
  process.env.RABBITMQ_URL = 'amqps://rabbit.example/v';
  expect(rabbitmq.getRabbitUrl()).toBe(process.env.RABBITMQ_URL);
  const channel = { create: true };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel) };
  const lib = { connect: jest.fn().mockResolvedValue(connection) };
  const first = rabbitmq.connect({ amqplibLib: lib });
  const second = rabbitmq.connect({ amqplibLib: lib });
  expect(await first).toEqual(await second);
  expect(lib.connect).toHaveBeenCalledWith(process.env.RABBITMQ_URL, undefined);
  if (saved === undefined) delete process.env.RABBITMQ_URL; else process.env.RABBITMQ_URL = saved;
  await rabbitmq._resetRabbitMQTestState();
});

test('handles reconnect disabled, missing connection events, and health without checkExchange', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const channel = { assertExchange: jest.fn().mockRejectedValue(new Error('closed')), publish: jest.fn() };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel) };
  const logger = { debug: jest.fn(), error: jest.fn() };
  const lib = { connect: jest.fn().mockResolvedValue(connection) };
  await expect(rabbitmq.publish('q', 'direct', {}, {}, { amqplibLib: lib, rabbitUrl: DUMMY_URL, logger, reconnect: false })).rejects.toThrow('closed');
  await rabbitmq._resetRabbitMQTestState();
  const plain = { createChannel: jest.fn().mockResolvedValue({}), close: jest.fn().mockResolvedValue() };
  await expect(rabbitmq.connect({ amqplibLib: { connect: jest.fn().mockResolvedValue(plain) }, rabbitUrl: DUMMY_URL, logger })).resolves.toEqual({ connection: expect.anything(), channel: {} });
  await expect(rabbitmq.verifyConnection({ amqplibLib: lib, rabbitUrl: DUMMY_URL, logger })).resolves.toBe(true);
  await rabbitmq.close();
});

test('wraps RabbitMQError causes and validates connect options', async () => {
  await expect(rabbitmq.connect([])).rejects.toThrow('options');
  await rabbitmq._resetRabbitMQTestState();
  const cause = new rabbitmq.RabbitMQError('inner', { operation: 'inner' });
  const lib = { connect: jest.fn().mockRejectedValue(cause) };
  await expect(rabbitmq.connect({ amqplibLib: lib, rabbitUrl: DUMMY_URL })).rejects.toBe(cause);
});

test('covers defensive cleanup and optional failure branches', async () => {
  for (const key of ['RABBITMQ_URL', 'RABBITMQ_HOST', 'RABBITMQ_USER', 'RABBITMQ_PASS', 'RABBITMQ_VHOST']) delete process.env[key];
  await rabbitmq.close();
  expect(rabbitmq.isConnected()).toBe(false);
  await expect(rabbitmq.connect()).rejects.toThrow('Failed to connect');
  await rabbitmq._resetRabbitMQTestState();
  const oldListeners = {};
  const old = { on: jest.fn((event, cb) => { oldListeners[event] = cb; }), createChannel: jest.fn().mockResolvedValue({}) };
  const next = { createChannel: jest.fn().mockResolvedValue({}), close: jest.fn().mockResolvedValue() };
  const lib = { connect: jest.fn().mockResolvedValueOnce(old).mockResolvedValueOnce(next) };
  await rabbitmq.connect({ amqplibLib: lib, rabbitUrl: DUMMY_URL });
  await rabbitmq.close();
  await rabbitmq.connect({ amqplibLib: lib, rabbitUrl: DUMMY_URL });
  oldListeners.close?.();
  await rabbitmq.close();
});

test('covers non-Error connection failures and nack-unavailable handler failures', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const lib = { connect: jest.fn().mockRejectedValue('offline') };
  await expect(rabbitmq.connect({ amqplibLib: lib, rabbitUrl: DUMMY_URL })).rejects.toThrow('Failed to connect');
  await rabbitmq._resetRabbitMQTestState();
  const channel = { assertExchange: jest.fn().mockResolvedValue({}), assertQueue: jest.fn().mockResolvedValue({}), bindQueue: jest.fn().mockResolvedValue({}), consume: jest.fn((q, cb) => { channel.cb = cb; }) };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue() };
  const logger = { debug: jest.fn(), error: jest.fn() };
  await rabbitmq.consume('no-nack', 'direct', () => { throw new Error('bad'); }, {}, { amqplibLib: { connect: jest.fn().mockResolvedValue(connection) }, rabbitUrl: DUMMY_URL, logger });
  await channel.cb({ content: Buffer.from('{}') });
  expect(logger.error).toHaveBeenCalled();
});

test('covers close without a close method and verify defaults', async () => {
  for (const key of ['RABBITMQ_URL', 'RABBITMQ_HOST', 'RABBITMQ_USER', 'RABBITMQ_PASS', 'RABBITMQ_VHOST']) delete process.env[key];
  await rabbitmq._resetRabbitMQTestState();
  const connection = { createChannel: jest.fn().mockResolvedValue({}) };
  await rabbitmq.connect({ amqplibLib: { connect: jest.fn().mockResolvedValue(connection) }, rabbitUrl: DUMMY_URL });
  await expect(rabbitmq.close()).resolves.toBeUndefined();
  await expect(rabbitmq.close()).resolves.toBeUndefined();
  const saved = process.env.RABBITMQ_URL;
  delete process.env.RABBITMQ_URL;
  await expect(rabbitmq.verifyConnection()).rejects.toThrow('Failed to connect');
  if (saved === undefined) delete process.env.RABBITMQ_URL; else process.env.RABBITMQ_URL = saved;
});

test('ignores acknowledgement failures during connection shutdown', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const channel = {
    assertExchange: jest.fn().mockResolvedValue({}),
    assertQueue: jest.fn().mockResolvedValue({}),
    bindQueue: jest.fn().mockResolvedValue({}),
    consume: jest.fn((q, cb) => { channel.cb = cb; }),
    ack: jest.fn(() => { throw new Error('closing'); }),
    nack: jest.fn(() => { throw new Error('closing'); }),
  };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue() };
  const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() };
  const lib = { connect: jest.fn().mockResolvedValue(connection) };
  await rabbitmq.consume('ack-close', 'direct', jest.fn(), {}, { amqplibLib: lib, rabbitUrl: DUMMY_URL, logger });
  await channel.cb({ content: Buffer.from('{}') });
  expect(logger.debug).toHaveBeenCalledWith('RabbitMQ message acknowledgement failed during shutdown', expect.anything());
  await rabbitmq._resetRabbitMQTestState();
  const failing = { ...channel, consume: jest.fn((q, cb) => { failing.cb = cb; }), ack: jest.fn(), nack: jest.fn(() => { throw new Error('closing'); }) };
  const failingConnection = { createChannel: jest.fn().mockResolvedValue(failing), close: jest.fn().mockResolvedValue() };
  await rabbitmq.consume('nack-close', 'direct', () => { throw new Error('handler'); }, {}, { amqplibLib: { connect: jest.fn().mockResolvedValue(failingConnection) }, rabbitUrl: DUMMY_URL, logger });
  await failing.cb({ content: Buffer.from('{}') });
  expect(logger.debug).toHaveBeenCalledWith('RabbitMQ message rejection failed during shutdown', expect.anything());
});

test('confirmed exchange and queue publishing use isolated confirm channels', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const confirm = {
    assertExchange: jest.fn().mockResolvedValue({}),
    assertQueue: jest.fn().mockResolvedValue({}),
    publish: jest.fn(() => true),
    sendToQueue: jest.fn(() => true),
    waitForConfirms: jest.fn().mockResolvedValue(),
    close: jest.fn().mockResolvedValue(),
  };
  const regular = {};
  const connection = { createChannel: jest.fn().mockResolvedValue(regular), createConfirmChannel: jest.fn().mockResolvedValue(confirm), close: jest.fn().mockResolvedValue() };
  const lib = { connect: jest.fn().mockResolvedValue(connection) };
  const opts = { amqplibLib: lib, rabbitUrl: DUMMY_URL, messageOptions: { persistent: true } };
  await expect(rabbitmq.createChannel(opts)).resolves.toBe(confirm);
  await expect(rabbitmq.createChannel({ ...opts, confirm: false })).resolves.toBe(regular);
  await rabbitmq.publishExchange('mail.direct', 'mail.outbound.submit', { id: 1 }, {}, opts);
  await rabbitmq.publishQueue('mailbot', { id: 2 }, opts);
  expect(confirm.publish).toHaveBeenCalledWith('mail.direct', 'mail.outbound.submit', Buffer.from('{"id":1}'), { persistent: true });
  expect(confirm.sendToQueue).toHaveBeenCalledWith('mailbot', Buffer.from('{"id":2}'), { persistent: true });
  expect(confirm.waitForConfirms).toHaveBeenCalledTimes(2);
  expect(confirm.close).toHaveBeenCalledTimes(2);
});

test('topology helper declares exchanges, queues, bindings and rejects unknown types', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const channel = { assertExchange: jest.fn().mockResolvedValue({}), assertQueue: jest.fn().mockResolvedValue({}), bindQueue: jest.fn().mockResolvedValue({}), close: jest.fn().mockResolvedValue(), waitForConfirms: jest.fn() };
  const connection = { createChannel: jest.fn().mockResolvedValue({}), createConfirmChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue() };
  const opts = { amqplibLib: { connect: jest.fn().mockResolvedValue(connection) }, rabbitUrl: DUMMY_URL };
  await rabbitmq.ensureTopology([{ type: 'exchange', name: 'mail.direct', exchangeType: 'direct' }, { type: 'queue', name: 'mail.outbound.submit', options: { arguments: { 'x-queue-type': 'quorum' } } }, { type: 'binding', exchange: 'mail.direct', queue: 'mail.outbound.submit', routingKey: 'mail.outbound.submit' }], opts);
  expect(channel.assertExchange).toHaveBeenCalled(); expect(channel.assertQueue).toHaveBeenCalled(); expect(channel.bindQueue).toHaveBeenCalled();
  await expect(rabbitmq.ensureTopology([{ type: 'invalid' }], opts)).rejects.toThrow('unknown topology');
});

test('confirmed operations wrap channel failures', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const connection = { createChannel: jest.fn().mockResolvedValue({}), createConfirmChannel: jest.fn().mockRejectedValue(new Error('channel down')), close: jest.fn() };
  const opts = { amqplibLib: { connect: jest.fn().mockResolvedValue(connection) }, rabbitUrl: DUMMY_URL };
  await expect(rabbitmq.createChannel(opts)).rejects.toThrow('Failed to create RabbitMQ channel');
  await expect(rabbitmq.publishExchange('x', 'y', {}, {}, opts)).rejects.toThrow('Failed to create RabbitMQ channel');
});

test('confirmed operations wrap declaration and publish failures', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const exchangeChannel = { assertExchange: jest.fn().mockRejectedValue(new Error('exchange down')), close: jest.fn().mockResolvedValue() };
  const queueChannel = { assertQueue: jest.fn().mockRejectedValue(new Error('queue down')), close: jest.fn().mockResolvedValue() };
  const connection = { createChannel: jest.fn().mockResolvedValue({}), createConfirmChannel: jest.fn().mockResolvedValueOnce(exchangeChannel).mockResolvedValueOnce(queueChannel), close: jest.fn().mockResolvedValue() };
  const opts = { amqplibLib: { connect: jest.fn().mockResolvedValue(connection) }, rabbitUrl: DUMMY_URL };
  await expect(rabbitmq.publishExchange('x', 'y', {}, {}, opts)).rejects.toThrow("Failed to publish to exchange 'x'");
  await expect(rabbitmq.publishQueue('q', {}, opts)).rejects.toThrow("Failed to publish to queue 'q'");
});
