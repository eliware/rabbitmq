const rabbitmq = require('@eliware/rabbitmq');

const DUMMY_URL = 'amqp://user:pass@host/vhost';

describe('rabbitmq.cjs', () => {
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
