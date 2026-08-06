# Release notes

## 1.1.2 — August 6, 2026

### Changed

- Modernized the RabbitMQ client around a shared ESM implementation.
- Added explicit connection lifecycle APIs: `connect`, `close`, `isConnected`, and `verifyConnection`.
- Added environment-based and explicit URL configuration with encoded credentials and virtual hosts.
- Added TLS option forwarding through `amqplib`.
- Added reconnect handling with configurable delay and an opt-out switch.
- Added connection event logging for errors, blocked, unblocked, and close events.
- Added custom serialization and deserialization hooks.
- Added publish message options and backpressure handling.
- Added consume options, durable queue defaults, and configurable requeue behavior.
- Added safe acknowledgement/rejection handling during connection shutdown.
- Expanded TypeScript declarations and README documentation.
- Replaced root examples with focused examples under `examples/` for publishing, consuming, TLS, reconnects, serialization, and graceful shutdown.
- Added `AGENTS.md` development guidance.
- Updated dependencies and lockfiles, including the latest `@eliware/log`.
- Standardized linting, CI workflow support, and coverage/test configuration.
- Silenced expected error-path logging in tests while retaining full coverage.

### Verification

- 18 tests passing.
- 100% statements, branches, functions, and lines covered.
- Lint passes with zero warnings and errors.
- RabbitMQ integration smoke test passed for connection, consume, publish, round-trip delivery, and shutdown cleanup.

## 1.1.1 — December 9, 2025

- Initial tagged release of the RabbitMQ client.
