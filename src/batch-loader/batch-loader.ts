import { BatchAggregator } from '../batch-aggregator/batch-aggregator'
import { BatchLoaderFn } from '../batch-aggregator/interfaces'
import { Deduplicator } from '../deduplicator/deduplicator'
import { Key } from '../interfaces'
import { CacheAdapter, ICache } from './cache-adapter'

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

const prepareOptions = <K, R>(options: IBatchLoaderOptions<K, R>) => ({
  getKey: (query: K) => `${query}`,
  timeoutMs: 60_000,
  unrefTimeouts: false,
  concurrencyLimit: Infinity,
  maxBatchSize: 1000,
  batchTimeMs: 50,
  maxWaitingTimeMs: 60,
  ...options,
})

export class BatchLoader<K, R> {
  private readonly cache: CacheAdapter<R>
  private readonly deduplicator: Deduplicator<K, R>
  private readonly aggregator: BatchAggregator<K, R>
  private readonly getKey: (query: K) => Key

  constructor(batchLoaderFn: BatchLoaderFn<K, R>, options: IBatchLoaderOptions<K, R>) {
    const { cache, getKey, timeoutMs, unrefTimeouts, batchTimeMs, concurrencyLimit, maxBatchSize, maxWaitingTimeMs } =
      prepareOptions(options)

    this.getKey = getKey
    this.cache = new CacheAdapter(cache)
    this.deduplicator = new Deduplicator<K, R>(this.deduplicatorRunner, {
      getKey,
      timeoutMs: timeoutMs + batchTimeMs,
      unrefTimeouts: !!unrefTimeouts,
    })
    this.aggregator = new BatchAggregator(batchLoaderFn, { timeoutMs, batchTimeMs, concurrencyLimit, maxBatchSize, maxWaitingTimeMs })
  }

  private readonly deduplicatorRunner = async (query: K, signal: AbortSignal): Promise<R> => {
    const key = this.getKey(query)
    const cached = await this.cache.get(key)

    if (signal.aborted) throw signal.reason
    if (cached !== undefined) return cached

    this.deduplicator.restartTimeout(query)

    const loaded = await this.aggregator.load(query)

    this.deduplicator.restartTimeout(query)
    await this.cache.set(key, loaded)

    return loaded
  }

  load(query: K) {
    return this.deduplicator.call(query)
  }

  async resetCache(query: K) {
    await this.cache.delete(this.getKey(query))
  }

  clear() {
    this.deduplicator.clear()
    this.aggregator.clear()
  }

  async flush() {
    await this.cache.clear()
  }
}
