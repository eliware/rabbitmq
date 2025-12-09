export type PublishOptions = Record<string, any>;
export type ConsumeOptions = Record<string, any>;
export type Logger = { debug: (...args: any[]) => void; error: (...args: any[]) => void };

export interface RabbitMQOpts {
  amqplibLib?: any;
  logger?: Logger;
  rabbitUrl?: string;
}

export function publish(
  queue: string,
  type: string,
  message: any,
  options?: PublishOptions,
  opts?: RabbitMQOpts
): Promise<void>;

export function consume(
  queue: string,
  type: string,
  onMessage: (msg: any) => Promise<void> | void,
  options?: ConsumeOptions,
  opts?: RabbitMQOpts
): Promise<void>;

export function _resetRabbitMQTestState(): Promise<void>;

declare const _default: {
  publish: typeof publish;
  consume: typeof consume;
  _resetRabbitMQTestState: typeof _resetRabbitMQTestState;
};
export default _default;
