# Release notes

## 1.1.7 — 2026-08-10

- Fixed examples to close RabbitMQ connections after finite operations.
- Isolated the custom serialization example exchange from the topic example.

### Verification

- 18 tests passing with 100% coverage.
- Lint, TypeScript checks, and package dry-run pass.

## 1.1.6 — 2026-08-10

- Bumped package and lockfile metadata to 1.1.6 for the release.

### Verification

- 18 tests passing with 100% coverage.
- Lint, package audit, and API smoke test pass.

## 1.1.5 — 2026-08-10

- Fixed RabbitMQ connection test-state isolation and stale environment handling.
- Standardized missing-configuration errors as `RabbitMQError` connection failures.
- Updated `@eliware/log` to 1.1.12.

### Verification

- 18 tests passing with 100% coverage.
- Lint and TypeScript checks pass.
- Production dependency audit passes.


## 1.1.4 — 2026-08-07

- Standardized package layout, validation scripts, TypeScript checking, CI, and package contents.
- Updated `@eliware/log` to 1.1.11.
- Expanded operational, troubleshooting, development, and security documentation.

## 1.1.3 — August 7, 2026

### Changed

- Updated `@eliware/log` to 1.1.10 and refreshed the lockfile.
- Fixed coverage-gap filtering for the release validation workflow.

### Verification

- 18 tests passing.
- 100% statements, branches, functions, and lines covered.
- Lint passes with zero warnings and errors.
- Import/API smoke test passed.

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
