import { Key } from '../interfaces'

export interface ICache<T> {
  get(key: Key): Promise<T | undefined>
  set(key: Key, data: T): Promise<void>
  delete(key: Key): Promise<void>
  clear(): Promise<void>
}

export class StubCache implements ICache<any> {
  async get(_key: Key): Promise<any> {
    return Promise.resolve(undefined)
  }
  async set(_key: Key, _data: any): Promise<void> {}
  async delete(_key: Key): Promise<void> {}
  async clear(): Promise<void> {}
}

/**
 * Simple cache implementation based on Map.
 * Designed for local in-memory usage.
 * Methods are implemented with an asynchronous interface for compatibility
 * with other cache types, such as external databases or distributed systems.
 * Note that this implementation does not support TTL and relies on external
 * mechanisms for managing data expiration.
 */
export class MapCache<T> implements ICache<T> {
  private readonly map = new Map<Key, T>()

  async get(key: Key): Promise<T | undefined> {
    return this.map.get(key)
  }

  async set(key: Key, data: T): Promise<void> {
    this.map.set(key, data)
  }

  async delete(key: Key): Promise<void> {
    this.map.delete(key)
  }

  async clear(): Promise<void> {
    this.map.clear()
  }
}

export class CacheAdapter<T> implements ICache<T> {
  private readonly cache: ICache<T>
  constructor(cache?: ICache<T>) {
    this.cache = cache || new StubCache()
  }
  get(key: Key): Promise<T | undefined> {
    return this.cache.get(key)
  }

  set(key: Key, data: T): Promise<void> {
    return this.cache.set(key, data)
  }

  delete(key: Key): Promise<void> {
    return this.cache.delete(key)
  }

  clear(): Promise<void> {
    return this.cache.clear()
  }
}
