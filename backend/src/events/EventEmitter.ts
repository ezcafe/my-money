/**
 * Type-safe Event Emitter
 * Wraps Node's EventEmitter with TypeScript type safety
 */

import { EventEmitter } from 'node:events';

/**
 * Type-safe Event Emitter Class
 * Uses composition to provide type safety while maintaining compatibility with Node's EventEmitter
 */
export class TypedEventEmitter<TEventMap extends Record<string, unknown[]>> {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  /**
   * Emit a typed event
   * @param eventName - Event name (must be a key of TEventMap)
   * @param args - Event arguments (must match TEventMap[eventName])
   * @returns True if event had listeners, false otherwise
   */
  emit<K extends keyof TEventMap>(eventName: K, ...args: TEventMap[K]): boolean {
    return this.emitter.emit(eventName as string, ...args);
  }

  /**
   * Add a typed event listener
   * @param eventName - Event name (must be a key of TEventMap)
   * @param listener - Event listener function
   * @returns This emitter instance
   */
  on<K extends keyof TEventMap>(
    eventName: K,
    listener: (...args: TEventMap[K]) => void,
  ): this {
    this.emitter.on(eventName as string, listener as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Add a one-time typed event listener
   * @param eventName - Event name (must be a key of TEventMap)
   * @param listener - Event listener function
   * @returns This emitter instance
   */
  once<K extends keyof TEventMap>(
    eventName: K,
    listener: (...args: TEventMap[K]) => void,
  ): this {
    this.emitter.once(eventName as string, listener as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Remove a typed event listener
   * @param eventName - Event name (must be a key of TEventMap)
   * @param listener - Event listener function
   * @returns This emitter instance
   */
  off<K extends keyof TEventMap>(
    eventName: K,
    listener: (...args: TEventMap[K]) => void,
  ): this {
    this.emitter.off(eventName as string, listener as (...args: unknown[]) => void);
    return this;
  }

  /**
   * Remove all listeners for an event or all events
   * @param eventName - Optional event name
   * @returns This emitter instance
   */
  removeAllListeners<K extends keyof TEventMap>(eventName?: K): this {
    if (eventName) {
      this.emitter.removeAllListeners(eventName as string);
    } else {
      this.emitter.removeAllListeners();
    }
    return this;
  }
}
