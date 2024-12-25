import { Key } from '../utils/interfaces'

export interface ICache<T> {
  get(key: Key): Promise<T | undefined>
  set(key: Key, data: T): Promise<void>
  delete(key: Key): Promise<void>
  clear(): Promise<void>
}

export interface IBatchLoaderOptions<K, R> {
  /**
   * @description Function to extract the key from a query
   * @default query => `${query}`
   */
  getKey?: (query: K) => Key

  cache?: ICache<R>

  /**
   * @description Task execution timeout in milliseconds
   * @default 60_000
   */
  timeoutMs?: number

  /**
   * @description Allows timers to avoid blocking the event loop
   * @default false
   */
  unrefTimeouts?: boolean

  /**
   * @description Maximum number of parallel tasks (default: unlimited)
   * @default Infinity
   */
  concurrencyLimit?: number

  /**
   * @description Maximum number of requests per batch
   * @default 1000
   */
  maxBatchSize?: number

  /**
   * @description Maximum time in milliseconds to form a batch
   * @default 50
   */
  batchTimeMs?: number

  /**
   * @description Maximum waiting time in milliseconds for tasks in the queue (only if concurrencyLimit > 0)
   * @default 60_000
   */
  maxWaitingTimeMs?: number
}
