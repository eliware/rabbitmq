export class RabbitMQError extends Error { operation?: string; }
export type PublishOptions = Record<string, unknown>;
export type ConsumeOptions = Record<string, unknown>;
export type Logger = { debug: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
export interface RabbitMQOpts { amqplibLib?: { connect(url: string): Promise<unknown> }; logger?: Logger; rabbitUrl?: string; }
export function getRabbitUrl(options?: { rabbitUrl?: string }): string | null;
export function publish(queue: string, type: string, message: unknown, options?: PublishOptions, opts?: RabbitMQOpts): Promise<void>;
export function consume(queue: string, type: string, onMessage: (msg: unknown) => Promise<void> | void, options?: ConsumeOptions, opts?: RabbitMQOpts): Promise<void>;
export function _resetRabbitMQTestState(): Promise<void>;
declare const _default: { publish: typeof publish; consume: typeof consume; _resetRabbitMQTestState: typeof _resetRabbitMQTestState; getRabbitUrl: typeof getRabbitUrl; RabbitMQError: typeof RabbitMQError };
export default _default;
