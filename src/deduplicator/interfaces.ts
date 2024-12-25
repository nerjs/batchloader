import { Key } from '../utils/interfaces'

export type DeduplicatorRunnerCallback<T, R> = (query: T, signal: AbortSignal) => Promise<R> | R

export interface IDeduplicatorOptions<T> {
  /**
   * @description Function to extract the key from a query
   */
  getKey: (query: T) => Key

  /**
   * @description Task execution timeout
   */
  timeoutMs: number

  /**
   * @description Allows timers to avoid blocking the event loop
   */
  unrefTimeouts?: boolean
}
