export { Key } from './utils/interfaces'

export { IBatchLoaderOptions, ICache } from './batch-loader/interfaces'
export { BatchLoader } from './batch-loader/batch-loader'
export { CacheAdapter, MapCache } from './batch-loader/cache-adapter'

export { DeduplicatorRunnerCallback, IDeduplicatorOptions } from './deduplicator/interfaces'
export { Deduplicator } from './deduplicator/deduplicator'

export { BatchLoaderFn, IBatchAggregatorOptions } from './batch-aggregator/interfaces'
export { BatchAggregator } from './batch-aggregator/batch-aggregator'

export {
  ITask,
  ITimekeeper,
  InitiateDataFactory,
  LimitedTimekeeperOptions,
  UnlimitedTimekeeperOptions,
  TaskStatus,
  TimekeeperRunnerCallback,
} from './timekeeper/interfaces'
export { UnlimitedTimekeeper } from './timekeeper/unlimited.timekeeper'
export { LimitedTimekeeper } from './timekeeper/limited.timekeeper'
