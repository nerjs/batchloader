import { BatchLoader } from '../batch-loader'
import { MapCache, StubCache } from '../cache-adapter'
import { LoaderError, TimeoutError } from '../../utils/errors'
import { sleep } from '../../utils/sleep'
import { IBatchLoaderOptions, ICache } from '../interfaces'

const defaultOptions: IBatchLoaderOptions<number, number> = {
  timeoutMs: 100,
  maxBatchSize: 3,
  batchTimeMs: 50,
}

describe('BatchLoader', () => {
  let loader: BatchLoader<number, number>

  const batchLoaderFn = jest.fn(async (queries: number[]) => {
    await sleep(50, true)
    return queries.map(q => q * 2)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    loader = new BatchLoader(batchLoaderFn, defaultOptions)
  })

  afterEach(() => {
    loader.clear()
  })

  /** Negative Cases */
  describe('Negative Cases', () => {
    let cache: ICache<number>
    const timeoutMs = 100

    beforeEach(() => {
      cache = new StubCache()
      loader = new BatchLoader(batchLoaderFn, { ...defaultOptions, timeoutMs, cache })
    })

    it('throws TimeoutError when batch execution exceeds timeoutMs', async () => {
      batchLoaderFn.mockImplementationOnce(async (raw: number[]) => {
        await sleep(timeoutMs * 2, true)
        return raw.map(n => n * 2)
      })
      await expect(loader.load(1)).rejects.toThrow(TimeoutError)
      expect(batchLoaderFn).toHaveBeenCalled()
    })

    it('Throws a TimeoutError if the cache fetch has exceeded timeoutMs', async () => {
      cache.get = () => sleep(timeoutMs * 2, true)
      await expect(loader.load(1)).rejects.toThrow(TimeoutError)
      expect(batchLoaderFn).not.toHaveBeenCalled()
    })

    it('Throws a TimeoutError if the cache retention has exceeded timeoutMs', async () => {
      cache.set = () => sleep(timeoutMs * 2, true)
      await expect(loader.load(1)).rejects.toThrow(TimeoutError)
      expect(batchLoaderFn).toHaveBeenCalled()
    })

    it('throws error if batchLoaderFn returns non-array response', async () => {
      batchLoaderFn.mockImplementationOnce(async () => 'some value' as any)
      await expect(loader.load(1)).rejects.toThrow(LoaderError)
    })

    it('throws error if batchLoaderFn response length does not match requests', async () => {
      batchLoaderFn.mockImplementationOnce(async () => [1, 2])
      await expect(loader.load(1)).rejects.toThrow(LoaderError)
    })

    it('throws error when batchLoaderFn fails', async () => {
      const error = new Error('Some error')
      batchLoaderFn.mockImplementationOnce(async () => {
        throw error
      })
      await expect(loader.load(1)).rejects.toThrow(error)
    })
  })

  /** Positive Cases */
  describe('Positive Cases', () => {
    const batchTimeMs = 50
    const maxBatchSize = 3

    beforeEach(() => {
      loader = new BatchLoader(batchLoaderFn, { ...defaultOptions, batchTimeMs, maxBatchSize })
    })

    it('processes queries and returns results', async () => {
      const result = await loader.load(5)
      expect(result).toBe(10)
    })

    it('batches requests up to maxBatchSize', async () => {
      const results = await Promise.all([loader.load(1), loader.load(2), loader.load(3)])
      expect(batchLoaderFn).toHaveBeenCalledTimes(1)
      expect(results).toEqual([2, 4, 6])
    })

    it('Splits requests into groups when maxBatchSize is exceeded', async () => {
      const results = await Promise.all([loader.load(1), loader.load(2), loader.load(3), loader.load(4)])
      expect(batchLoaderFn).toHaveBeenCalledTimes(2)
      expect(results).toEqual([2, 4, 6, 8])
    })

    it('handles requests arriving within batchTimeMs', async () => {
      const promises = [loader.load(1), sleep(batchTimeMs - 5).then(() => loader.load(2))]
      const results = await Promise.all(promises)
      expect(results).toEqual([2, 4])
      expect(batchLoaderFn).toHaveBeenCalledTimes(1)
    })

    it('Requests that did not get to the batches after batchTimeMs expiration are added to the next batches.', async () => {
      const promises = [loader.load(1), sleep(batchTimeMs + 5).then(() => loader.load(2))]
      const results = await Promise.all(promises)
      expect(results).toEqual([2, 4])
      expect(batchLoaderFn).toHaveBeenCalledTimes(2)
    })
  })

  /** Cache Handling */
  describe('Cache Handling', () => {
    let cache: ICache<number>

    beforeEach(() => {
      cache = new MapCache()
      jest.spyOn(cache, 'get').mockResolvedValue(undefined)
      jest.spyOn(cache, 'set').mockResolvedValue(undefined)
      jest.spyOn(cache, 'delete').mockResolvedValue(undefined)
      jest.spyOn(cache, 'clear').mockResolvedValue(undefined)
      loader = new BatchLoader(batchLoaderFn, { ...defaultOptions, cache: cache })
    })

    it('uses cache to retrieve stored results', async () => {
      jest.spyOn(cache, 'get').mockResolvedValue(42)
      const result = await loader.load(1)
      expect(result).toBe(42)
      expect(cache.get).toHaveBeenCalledWith('1')
      expect(batchLoaderFn).not.toHaveBeenCalled()
    })

    it('writes results to cache after batch execution', async () => {
      await loader.load(1)
      expect(cache.set).toHaveBeenCalledWith('1', 2)
    })

    it('resets cache for a specific query', async () => {
      await loader.resetCache(1)
      expect(cache.delete).toHaveBeenCalledWith('1')
    })

    it('clears all cache entries', async () => {
      await loader.flush()
      expect(cache.clear).toHaveBeenCalled()
    })
  })
})
