import { BatchAggregator } from '../batch-aggregator/batch-aggregator'
import { BatchLoaderFn, IBatchAggregatorMetrics } from '../batch-aggregator/interfaces'
import { Deduplicator } from '../deduplicator/deduplicator'
import { Key } from '../utils/interfaces'
import { CacheAdapter } from './cache-adapter'
import { IBatchLoaderOptions } from './interfaces'

const prepareOptions = <K, R>(options: IBatchLoaderOptions<K, R>) => {
  const merged = {
    getKey: (query: K) => `${query}`,
    timeoutMs: 60_000,
    unrefTimeouts: false,
    concurrencyLimit: Infinity,
    maxBatchSize: 1000,
    batchTimeMs: 50,
    maxWaitingTimeMs: 60_000,
    ...options,
  }

  if (!Number.isFinite(merged.timeoutMs) || merged.timeoutMs <= 0)
    throw new RangeError(`timeoutMs must be a positive finite number, got ${merged.timeoutMs}`)
  if (!Number.isFinite(merged.batchTimeMs) || merged.batchTimeMs < 0)
    throw new RangeError(`batchTimeMs must be a non-negative finite number, got ${merged.batchTimeMs}`)
  if (!Number.isInteger(merged.maxBatchSize) || merged.maxBatchSize < 1)
    throw new RangeError(`maxBatchSize must be a positive integer, got ${merged.maxBatchSize}`)
  if (merged.concurrencyLimit !== Infinity && (!Number.isInteger(merged.concurrencyLimit) || merged.concurrencyLimit < 1))
    throw new RangeError(`concurrencyLimit must be a positive integer or Infinity, got ${merged.concurrencyLimit}`)
  if (!Number.isFinite(merged.maxWaitingTimeMs) || merged.maxWaitingTimeMs <= 0)
    throw new RangeError(`maxWaitingTimeMs must be a positive finite number, got ${merged.maxWaitingTimeMs}`)

  return merged
}

export class BatchLoader<K, R> {
  private readonly cache: CacheAdapter<R>
  private readonly deduplicator: Deduplicator<K, R>
  private readonly aggregator: BatchAggregator<K, R>
  private readonly getKey: (query: K) => Key

  constructor(batchLoaderFn: BatchLoaderFn<K, R>, options: IBatchLoaderOptions<K, R>, metrics?: IBatchAggregatorMetrics) {
    const { cache, getKey, timeoutMs, unrefTimeouts, batchTimeMs, concurrencyLimit, maxBatchSize, maxWaitingTimeMs } =
      prepareOptions(options)

    const limited = concurrencyLimit !== Infinity
    const deduplicatorTimeoutMs = timeoutMs + batchTimeMs + (limited ? maxWaitingTimeMs : 0)

    this.getKey = getKey
    this.cache = new CacheAdapter(cache)
    this.deduplicator = new Deduplicator<K, R>(this.deduplicatorRunner, {
      getKey,
      timeoutMs: deduplicatorTimeoutMs,
      unrefTimeouts: !!unrefTimeouts,
    })
    this.aggregator = new BatchAggregator(
      batchLoaderFn,
      { timeoutMs, batchTimeMs, concurrencyLimit, maxBatchSize, maxWaitingTimeMs, unrefTimeouts: !!unrefTimeouts },
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
