export class RabbitMQError extends Error { operation?: string; }
export type PublishOptions = Record<string, unknown>;
export type ConsumeOptions = Record<string, unknown>;
export type Logger = { debug: (...args: unknown[]) => void; error: (...args: unknown[]) => void; warn?: (...args: unknown[]) => void; info?: (...args: unknown[]) => void };
export interface RabbitMQOpts { amqplibLib?: { connect(url: string, tls?: unknown): Promise<any> }; logger?: Logger; rabbitUrl?: string; tls?: Record<string, unknown>; reconnect?: boolean; reconnectDelay?: number; serialize?: (message: unknown) => string; deserialize?: (message: string) => unknown; messageOptions?: Record<string, unknown>; consumeOptions?: Record<string, unknown>; requeueOnError?: boolean; }
export function getRabbitUrl(options?: { rabbitUrl?: string }): string | null;
export function connect(options?: RabbitMQOpts): Promise<{ connection: any; channel: any }>;
export function close(): Promise<void>;
export function isConnected(): boolean;
export function verifyConnection(options?: RabbitMQOpts): Promise<boolean>;
export function publish(queue: string, type: string, message: unknown, options?: PublishOptions, opts?: RabbitMQOpts): Promise<boolean>;
export function consume(queue: string, type: string, onMessage: (msg: unknown) => Promise<void> | void, options?: ConsumeOptions, opts?: RabbitMQOpts): Promise<{ consumerTag?: string }>;
export function _resetRabbitMQTestState(): Promise<void>;
declare const _default: { connect: typeof connect; close: typeof close; isConnected: typeof isConnected; verifyConnection: typeof verifyConnection; publish: typeof publish; consume: typeof consume; _resetRabbitMQTestState: typeof _resetRabbitMQTestState; getRabbitUrl: typeof getRabbitUrl; RabbitMQError: typeof RabbitMQError };
export default _default;
