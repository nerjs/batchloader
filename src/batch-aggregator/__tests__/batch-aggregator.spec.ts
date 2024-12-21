import { TimekeeperTimeoutError } from '../../timekeeper/errors'
import { sleep } from '../../utils/sleep'
import { BatchAggregator } from '../batch-aggregator'
import { BatchError } from '../errors'
import { IBatchAggregatorOptions } from '../interfaces'

/** Mock implementations */

describe('BatchAggregator', () => {
  let aggregator: BatchAggregator<number, number>

  const defaultOptions: IBatchAggregatorOptions = {
    maxBatchSize: 3,
    batchTimeMs: 10,
    batchTimeout: 500,
  }
  const mockLoader = jest.fn(async (batch: number[], signal: AbortSignal) => {
    if (signal.aborted) throw new Error('Aborted')
    return batch.map(item => item * 2) // Example: doubling numbers
  })

  beforeEach(() => {
    mockLoader.mockClear()
  })

  afterEach(() => {
    aggregator?.clear()
  })

  /** Negative Test Cases */
  describe('Negative Cases', () => {
    it('throws error if batchLoaderFn returns non-array response', async () => {
      aggregator = new BatchAggregator(async () => 42 as any, defaultOptions)
      await expect(aggregator.load(1)).rejects.toThrow(BatchError)
    })

    it('throws error if batchLoaderFn response length does not match requests', async () => {
      aggregator = new BatchAggregator(async () => [1, 2], defaultOptions)
      await expect(aggregator.load(1)).rejects.toThrow(BatchError)
    })

    it('throws error when batchLoaderFn fails', async () => {
      const error = new Error('Some error')
      aggregator = new BatchAggregator(async () => {
        throw error
      }, defaultOptions)
      await expect(aggregator.load(1)).rejects.toThrow(error)
    })
  })

  /** Positive Test Cases (No concurrency limit) */
  describe('Positive Cases (Unlimited Concurrency)', () => {
    beforeEach(() => {
      aggregator = new BatchAggregator(mockLoader, defaultOptions)
    })

    it('processes batch when maxBatchSize is reached', async () => {
      const results = await Promise.all([aggregator.load(1), aggregator.load(2), aggregator.load(3)])
      expect(results).toEqual([2, 4, 6])
      expect(mockLoader).toHaveBeenCalledTimes(1)
    })

    it('processes batch based on batchTimeMs', async () => {
      const resultPromise = aggregator.load(1)
      await sleep(150)
      expect(await resultPromise).toBe(2)
      expect(mockLoader).toHaveBeenCalledTimes(1)
    })

    it('returns results in the same order as requests', async () => {
      const results = await Promise.all([aggregator.load(3), aggregator.load(1), aggregator.load(2)])
      expect(results).toEqual([6, 2, 4])
    })

    it('splits requests into multiple batches if maxBatchSize is exceeded', async () => {
      const results = await Promise.all([
        aggregator.load(1),
        aggregator.load(2),
        aggregator.load(3),
        aggregator.load(4),
        aggregator.load(5),
      ])

      expect(results).toEqual([2, 4, 6, 8, 10])
      expect(mockLoader).toHaveBeenCalledTimes(2)
      expect(mockLoader).toHaveBeenCalledWith([1, 2, 3], expect.any(AbortSignal))
      expect(mockLoader).toHaveBeenCalledWith([4, 5], expect.any(AbortSignal))
    })
  })

  /** Specific Test Cases (Concurrency Limit) */
  describe('Specific Cases (Concurrency Limit)', () => {
    beforeEach(() => {
      aggregator = new BatchAggregator(mockLoader, {
        ...defaultOptions,
        concurrencyLimit: 2,
      })
    })

    it('limits parallel execution to concurrencyLimit', async () => {
      const results = Promise.all([aggregator.load(1), aggregator.load(2), aggregator.load(3), aggregator.load(4)])

      await sleep(200)
      expect(mockLoader).toHaveBeenCalledTimes(2)

      await results
      expect(mockLoader).toHaveBeenCalledTimes(2)
    })

    it('processes tasks from the waiting queue when active tasks complete', async () => {
      const promise1 = aggregator.load(1)
      const promise2 = aggregator.load(2)
      const promise3 = aggregator.load(3)
      const promise4 = aggregator.load(4)

      await sleep(200)
      expect(mockLoader).toHaveBeenCalledTimes(2)

      await Promise.all([promise1, promise2, promise3, promise4])
      expect(mockLoader).toHaveBeenCalledTimes(2)
    })

    it('handles waiting timeouts properly', async () => {
      mockLoader.mockImplementation(async (arr: number[]) => {
        await sleep(200)
        return arr.map(n => n * 2)
      })
      aggregator = new BatchAggregator(mockLoader, {
        ...defaultOptions,
        concurrencyLimit: 1,
        maxBatchSize: 1,
        maxWaitingTimeMs: 100,
      })

      await Promise.all([
        expect(aggregator.load(1)).resolves.toEqual(2),
        expect(aggregator.load(3)).rejects.toThrow(TimekeeperTimeoutError),
      ])
    })
  })
})
