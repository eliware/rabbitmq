const log = require('@eliware/log');
const amqplib = require('amqplib');

function getRabbitUrl(opts) {
    if (opts && opts.rabbitUrl) return opts.rabbitUrl;
    if (process.env.RABBITMQ_HOST)
        return `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASS}@${process.env.RABBITMQ_HOST}/${process.env.RABBITMQ_VHOST || ''}`;
    return null;
}

let connection;
let channel;

// Allow injection of amqplib and log for testability
async function _resetRabbitMQTestState() {
    if (connection) {
        try { await connection.close(); } catch { }
        connection = undefined;
        channel = undefined;
    }
}

async function connect({ amqplibLib = amqplib, rabbitUrl } = {}) {
    const url = getRabbitUrl({ rabbitUrl });
    if (!url) {
        throw new Error('RabbitMQ environment variables are not set.');
    }
    if (!connection) {
        connection = await amqplibLib.connect(url);
        channel = await connection.createChannel();
    }
    return channel;
}

async function publish(queue, type, message, options = {}, opts = {}) {
    try {
        const ch = await connect({ amqplibLib: opts.amqplibLib, rabbitUrl: opts.rabbitUrl });
        await ch.assertExchange(queue, type, { ...options });
        ch.publish(queue, queue, Buffer.from(JSON.stringify(message)));
        (opts.logger || log).debug(`Published message to exchange '${queue}' with routing key '${queue}'`, { message: JSON.stringify(message) });
    } catch (error) {
        (opts.logger || log).error(`Failed to publish message to exchange '${queue}'`, { error });
        throw error;
    }
}

async function consume(queue, type, onMessage, options = {}, opts = {}) {
    try {
        const ch = await connect({ amqplibLib: opts.amqplibLib, rabbitUrl: opts.rabbitUrl });
        await ch.assertExchange(queue, type, { ...options });
        await ch.assertQueue(queue, { ...options });
        await ch.bindQueue(queue, queue, queue);
        ch.consume(queue, async (msg) => {
            if (msg !== null) {
                let content;
                try {
                    content = JSON.parse(msg.content.toString());
                } catch (e) {
                    content = msg.content.toString();
                }
                await onMessage(content);
                ch.ack(msg);
            }
        });
        (opts.logger || log).debug(`Consuming queue '${queue}' (bound to exchange '${queue}')`);
    } catch (error) {
        (opts.logger || log).error(`Failed to consume messages from queue '${queue}'`, { error });
        throw error;
    }
}

module.exports = { publish, consume, _resetRabbitMQTestState };
