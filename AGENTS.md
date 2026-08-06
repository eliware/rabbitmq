# AGENTS.md

## Project

`@eliware/rabbitmq` is a small ESM RabbitMQ client for Node.js. The public implementation is `index.mjs`, with declarations in `index.d.ts`.

## Development

- Use Node.js with ESM support.
- Install dependencies with `npm install`.
- Run tests with `npm test`.
- Run lint with `npm run lint`.
- Maintain 100% test coverage across statements, branches, functions, and lines.
- Do not use Istanbul/nyc ignore directives to hide uncovered code. Remove genuinely unnecessary code or add meaningful tests.

## API and compatibility

- Preserve the public exports and default export shape unless intentionally changing the API.
- Keep `index.d.ts`, README usage, and examples synchronized with implementation changes.
- Support environment configuration through `RABBITMQ_URL` or `RABBITMQ_HOST`, `RABBITMQ_USER`, `RABBITMQ_PASS`, and `RABBITMQ_VHOST`.
- Keep connection lifecycle, reconnect, TLS, serialization, publish, consume, and graceful shutdown behavior covered by tests.
- Avoid logging credentials, URLs containing credentials, message contents, or TLS material.

## Examples and documentation

- Put runnable usage examples under `examples/`.
- Use environment variables for credentials and certificates.
- Update README documentation when public behavior, options, or examples change.

## Testing guidance

Tests should cover both successful and failure paths, including:

- connection and health checks;
- publish and consume round trips;
- reconnect behavior;
- TLS option forwarding;
- serialization/deserialization;
- backpressure and message options;
- handler failures and requeue behavior;
- safe acknowledgement/rejection during shutdown;
- cleanup with `close()`.

Real RabbitMQ smoke tests are optional and should use the configured test vhost, unique exchange/queue names, and always close the connection in a `finally` block.

## Release workflow

Do not change the package version or release notes unless explicitly requested. Before a release, run `npm test`, `npm run lint`, and preferably `npm pack --dry-run`.
