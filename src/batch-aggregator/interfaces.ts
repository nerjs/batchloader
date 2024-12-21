export interface IBatchAggregatorOptions {
  /**
   * @description Maximum number of parallel tasks (default: unlimited)
   */
  concurrencyLimit?: number

  /**
   * @description Maximum number of requests per batch
   */
  maxBatchSize: number

  /**
   * @description Maximum time to form a batch
   */
  batchTimeMs: number

  /**
   * @description Maximum waiting time for tasks in the queue (only if concurrencyLimit > 0)
   */
  maxWaitingTimeMs?: number

  /**
   * @description Maximum execution time for batchFn (the function passed as the first argument)
   */
  batchTimeout: number
}

export type BatchLoaderFn<T, R> = (batchArray: T[], signal: AbortSignal) => Promise<R[]> | R[]

export interface IBatchAggregatorMetrics {
  loadBatchItem?: () => void
  runBatch?: (batchSize: number) => void
  resolveBatch?: (batchSize: number) => void
  rejectBatch?: (batchSize: number) => void
  parallelBatches?: (batchesCount: number) => void
  waitingBatches?: (batchesCount: number) => void
}
