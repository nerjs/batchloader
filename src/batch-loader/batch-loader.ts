import { BatchAggregator, validateAggregatorOptions } from '../batch-aggregator/batch-aggregator'
import { BatchLoaderFn, DEFAULT_MAX_WAITING_TIME_MS } from '../batch-aggregator/interfaces'
import { Deduplicator } from '../deduplicator/deduplicator'
import { Key } from '../utils/interfaces'
import { CacheAdapter } from './cache-adapter'
import { IBatchLoaderOptions } from './interfaces'

// Node's setTimeout silently caps delays here and warns - clamp upstream to avoid TimeoutOverflowWarning + firing in 1ms.
const TIMEOUT_MAX = 2_147_483_647

const prepareOptions = <K, R>(options: IBatchLoaderOptions<K, R>) => {
  const merged = {
    getKey: (query: K) => `${query}`,
    timeoutMs: 60_000,
    unrefTimeouts: true,
    concurrencyLimit: Infinity,
    maxBatchSize: 1000,
    batchTimeMs: 50,
    maxWaitingTimeMs: DEFAULT_MAX_WAITING_TIME_MS,
    ...options,
  }
  validateAggregatorOptions(merged)
  return merged
}

export class BatchLoader<K, R> {
  private readonly cache: CacheAdapter<R>
  private readonly deduplicator: Deduplicator<K, R>
  private readonly aggregator: BatchAggregator<K, R>
  private readonly getKey: (query: K) => Key

  constructor(batchLoaderFn: BatchLoaderFn<K, R>, options: IBatchLoaderOptions<K, R>) {
    const { cache, getKey, timeoutMs, unrefTimeouts, batchTimeMs, concurrencyLimit, maxBatchSize, maxWaitingTimeMs, metrics } =
      prepareOptions(options)

    const limited = concurrencyLimit !== Infinity
    const deduplicatorTimeoutMs = Math.min(timeoutMs + batchTimeMs + (limited ? maxWaitingTimeMs : 0), TIMEOUT_MAX)

    this.getKey = getKey
    this.cache = new CacheAdapter(cache)
    this.deduplicator = new Deduplicator<K, R>(this.deduplicatorRunner, {
      getKey,
      timeoutMs: deduplicatorTimeoutMs,
      unrefTimeouts,
    })
    this.aggregator = new BatchAggregator(
      batchLoaderFn,
      { timeoutMs, batchTimeMs, concurrencyLimit, maxBatchSize, maxWaitingTimeMs, unrefTimeouts },
      metrics,
    )
  }

  private readonly deduplicatorRunner = async (query: K, signal: AbortSignal): Promise<R> => {
    const key = this.getKey(query)
    const cached = await this.cache.get(key)

    if (signal.aborted) throw signal.reason
    if (cached !== undefined) return cached

    this.deduplicator.restartTimeout(query)

    const loaded = await this.aggregator.load(query)

    if (signal.aborted) throw signal.reason

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
