import rabbitmq from '@eliware/rabbitmq';

// Configure RABBITMQ_HOST, RABBITMQ_USER, RABBITMQ_PASS, and RABBITMQ_VHOST
// in the environment, or pass rabbitUrl in the final options argument.
await rabbitmq.publish('events', 'topic', { event: 'created', id: 42 });

await rabbitmq.consume('events', 'topic', async (message) => {
  console.log('Received:', message);
});
