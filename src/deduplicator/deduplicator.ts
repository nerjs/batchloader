import { Defer } from '../utils/defer'
import createDebug from 'debug'
import { RejectedAbortError, SilentAbortError, TimeoutError } from '../utils/errors'
import { DeduplicatorRunnerCallback, IDeduplicatorOptions, Key } from './interfaces'
const debug = createDebug('batchloader:deduplicator')

interface Runner<T> {
  defer: Defer<T>
  controller: AbortController
  tid: NodeJS.Timeout | null
}

export class Deduplicator<T, R> {
  private readonly runners = new Map<Key, Runner<R>>()

  constructor(
    private readonly runnerFn: DeduplicatorRunnerCallback<T, R>,
    private readonly options: IDeduplicatorOptions<T>,
  ) {}

  private async run(query: T, signal: AbortSignal): Promise<R> {
    try {
      debug('run next runner')
      return await this.runnerFn(query, signal)
    } catch (error) {
      debug(`Aborted runner terminated with an error`)
      throw error
    }
  }

  private callError(key: Key, error: unknown) {
    const runner = this.runners.get(key)
    if (runner) {
      runner.defer.reject(error)
      runner.controller.abort(error)
      this.clearRunner(key)
    }
  }

  private clearRunner(key: Key) {
    const runner = this.runners.get(key)
    if (runner) {
      if (runner.tid) {
        clearTimeout(runner.tid)
        runner.tid = null
      }
      this.runners.delete(key)
    }
  }

  private createRunner(key: Key, query: T): Defer<R> {
    const defer = new Defer<R>()

    const controller = new AbortController()

    const tid = setTimeout(() => this.callError(key, new TimeoutError(this.options.timeoutMs)), this.options.timeoutMs)
    if (this.options.unrefTimeouts) tid?.unref?.()

    this.run(query, controller.signal)
      .then(result => defer.resolve(result))
      .catch(error => defer.reject(error))

    defer.promise
      .catch(() => {
        if (!controller.signal.aborted) controller.abort(new RejectedAbortError('deduplicate'))
      })
      .finally(() => this.clearRunner(key))

    this.runners.set(key, { defer, controller, tid })

    return defer
  }

  private getOrCreateRunner(query: T): Defer<R> {
    const key = this.options.getKey(query)
    const current = this.runners.get(key)
    if (current) return current.defer
    return this.createRunner(key, query)
  }

  /**
   * @description Adds a query to the execution queue or joins an already running request with the same key. Returns a promise with the result of the task execution.
   */
  async call(query: T): Promise<R> {
    debug('Call next runner')
    const current = this.getOrCreateRunner(query)
    return await current.promise
  }

  /**
   * @description Cancels all active tasks and clears their state.
   */
  clear() {
    this.runners.forEach((_, key) => this.callError(key, new SilentAbortError('deduplicate')))
    this.runners.clear()
  }
}
