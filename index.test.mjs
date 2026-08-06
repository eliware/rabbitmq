import { jest } from '@jest/globals';
import * as rabbitmq from './index.mjs';

const DUMMY_URL = 'amqp://user:pass@host/vhost';

describe('rabbitmq.mjs', () => {
    let mockChannel, mockConnection, mockAmqplib, mockLogger;

    beforeEach(() => {
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
});

test('covers connection and consumer edge failures', async () => {
  const logger = { debug: jest.fn(), error: jest.fn() };
  const channel = { assertExchange: jest.fn().mockResolvedValue({}), assertQueue: jest.fn().mockResolvedValue({}), bindQueue: jest.fn().mockResolvedValue({}), consume: jest.fn(), publish: jest.fn(), ack: jest.fn() };
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
  const channel = { assertExchange: jest.fn().mockResolvedValue({}), assertQueue: jest.fn().mockResolvedValue({}), bindQueue: jest.fn().mockResolvedValue({}), consume: jest.fn() };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue() };
  await rabbitmq.consume('default-log', 'direct', jest.fn(), {}, { amqplibLib: { connect: jest.fn().mockResolvedValue(connection) }, rabbitUrl: DUMMY_URL, logger: null });
});

test('consume error path supports the default logger', async () => {
  await rabbitmq._resetRabbitMQTestState();
  const channel = { assertExchange: jest.fn().mockRejectedValue(new Error('exchange down')) };
  const connection = { createChannel: jest.fn().mockResolvedValue(channel), close: jest.fn().mockResolvedValue() };
  await expect(rabbitmq.consume('error-log', 'direct', jest.fn(), {}, { amqplibLib: { connect: jest.fn().mockResolvedValue(connection) }, rabbitUrl: DUMMY_URL, logger: null })).rejects.toThrow('exchange down');
});
