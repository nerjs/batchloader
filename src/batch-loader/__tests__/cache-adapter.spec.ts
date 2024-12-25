import { CacheAdapter, MapCache } from '../cache-adapter'
import { Key } from '../../utils/interfaces'
import { ICache } from '../interfaces'

/** Общие тестовые параметры */
const testKey: Key = 'testKey'
const testValue = 'testValue'

describe('Cache module', () => {
  /** Тесты для StubCache */
  describe('CacheAdapter without cache instance (use StubCache)', () => {
    let adapter: ICache<any>

    beforeEach(() => {
      adapter = new CacheAdapter()
    })

    it('get() always resolves to undefined', async () => {
      await adapter.set(testKey, testValue)
      await expect(adapter.get(testKey)).resolves.toBeUndefined()
    })

    it('set() resolves without errors', async () => {
      await expect(adapter.set(testKey, testValue)).resolves.toBeUndefined()
    })

    it('delete() resolves without errors', async () => {
      await expect(adapter.delete(testKey)).resolves.toBeUndefined()
    })

    it('clear() resolves without errors', async () => {
      await expect(adapter.clear()).resolves.toBeUndefined()
    })
  })

  describe('CacheAdapter with cache instance', () => {
    let cache: ICache<string>
    let adapter: CacheAdapter<string>

    beforeEach(() => {
      cache = new MapCache<string>()
      adapter = new CacheAdapter<string>(cache)
    })

    it('delegates get() calls to the underlying cache', async () => {
      await cache.set(testKey, testValue)
      await expect(adapter.get(testKey)).resolves.toBe(testValue)
    })

    it('delegates set() calls to the underlying cache', async () => {
      await adapter.set(testKey, testValue)
      await expect(cache.get(testKey)).resolves.toBe(testValue)
    })

    it('delegates delete() calls to the underlying cache', async () => {
      await adapter.set(testKey, testValue)
      await adapter.delete(testKey)
      await expect(cache.get(testKey)).resolves.toBeUndefined()
    })

    it('delegates clear() calls to the underlying cache', async () => {
      await adapter.set(testKey, testValue)
      await adapter.clear()
      await expect(cache.get(testKey)).resolves.toBeUndefined()
    })
  })
})
