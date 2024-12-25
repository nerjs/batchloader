import { Deduplicator } from '../deduplicator'
import { Defer } from '../../utils/defer'
import { RejectedAbortError, SilentAbortError, TimeoutError } from '../../utils/errors'
import { sleep } from '../../utils/sleep'
import { IDeduplicatorOptions } from '../interfaces'

/** Mock runner function */
const mockRunner = jest.fn(async (query: number, signal: AbortSignal) => {
  if (signal.aborted) throw new Error('Aborted')
  await sleep(50, true) // Simulate async work
  return query * 2
})

/** Test options */
const defaultOptions: IDeduplicatorOptions<number> = {
  getKey: (query: number) => query,
  timeoutMs: 100,
  unrefTimeouts: false,
}

describe('Deduplicator', () => {
  let deduplicator: Deduplicator<number, number>

  beforeEach(() => {
    jest.clearAllMocks()
    deduplicator = new Deduplicator(mockRunner, defaultOptions)
  })

  afterEach(() => {
    deduplicator.clear()
  })

  /** Negative Cases */
  describe('Negative Cases', () => {
    it('throws TimeoutError when execution exceeds timeoutMs', async () => {
      const slowRunner = jest.fn(async () => {
        await sleep(200, true)
        return 42
      })

      deduplicator = new Deduplicator(slowRunner, defaultOptions)

      await expect(deduplicator.call(1)).rejects.toThrow(TimeoutError)
    })

    it('throws SilentAbortError when task is aborted manually', async () => {
      const call = deduplicator.call(1)
      deduplicator.clear()
      await expect(call).rejects.toThrow(SilentAbortError)
    })

    it('throws RejectedAbortError when runner fails and is aborted', async () => {
      const defer = new Defer()
      const failingRunner = jest.fn(async (_, signal) => {
        signal.addEventListener('abort', () => defer.reject(signal.reason))
        throw new Error('Failure')
      })

      deduplicator = new Deduplicator<any, any>(failingRunner, defaultOptions)

      await expect(deduplicator.call(1)).rejects.toThrow('Failure')
      await expect(defer.promise).rejects.toThrow(RejectedAbortError)
    })
  })

  /** Positive Cases */
  describe('Positive Cases', () => {
    it('processes query and returns result', async () => {
      const result = await deduplicator.call(5)
      expect(result).toBe(10)
    })

    it('deduplicates calls with the same key', async () => {
      const calls = await Promise.all([deduplicator.call(2), deduplicator.call(2)])
      expect(mockRunner).toHaveBeenCalledTimes(1)
      expect(calls).toEqual([4, 4])
    })

    it('processes multiple distinct queries', async () => {
      const results = await Promise.all([deduplicator.call(1), deduplicator.call(2)])
      expect(results).toEqual([2, 4])
      expect(mockRunner).toHaveBeenCalledTimes(2)
    })
  })

  /** Cleanup and Edge Cases */
  describe('Cleanup and Edge Cases', () => {
    it('clears all tasks on manual clear()', async () => {
      const call1 = deduplicator.call(1)
      const call2 = deduplicator.call(2)

      deduplicator.clear()

      await expect(call1).rejects.toThrow(SilentAbortError)
      await expect(call2).rejects.toThrow(SilentAbortError)
    })

    it('handles abort during processing', async () => {
      const defer = new Defer()
      const runner = jest.fn(async (_, signal) => {
        signal.addEventListener('abort', () => defer.reject(new Error('Aborted')))
        return defer.promise
      })

      deduplicator = new Deduplicator(runner, defaultOptions)
      const call = deduplicator.call(1)

      deduplicator.clear()
      await expect(defer.promise).rejects.toThrow('Aborted')
      await expect(call).rejects.toThrow(SilentAbortError)
    })

    it('restarts timeout with restartTimeout()', async () => {
      const runner = jest.fn(async () => {
        await sleep(150, true)
        return 42
      })

      deduplicator = new Deduplicator(runner, { ...defaultOptions, timeoutMs: 100 })
      const result = deduplicator.call(1)
      await sleep(75)
      deduplicator.restartTimeout(1) // Restart timeout before expiration

      await expect(result).resolves.toBe(42)
    })
  })
})
