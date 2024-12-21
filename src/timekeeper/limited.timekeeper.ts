import { TimekeeperTimeoutError } from './errors'
import { ILimitedTimekeeperMetrics, ITask, ITimekeeper, LimitedOptions, LimitedTimekeeperOptions } from './interfaces'
import { Task } from './task'
import { UnlimitedTimekeeper } from './unlimited.timekeeper'

import createDebug from 'debug'
const debug = createDebug('batchloader:timekeeper')

export class LimitedTimekeeper<D> extends UnlimitedTimekeeper<D, ILimitedTimekeeperMetrics> implements ITimekeeper<D> {
  private readonly limitedOptions: LimitedOptions

  private waitingTasks: Task<D>[] = []

  constructor({ concurrencyLimit, maxWaitingTimeMs, ...options }: LimitedTimekeeperOptions<D>, metrics?: ILimitedTimekeeperMetrics) {
    super(options, metrics)
    this.limitedOptions = { concurrencyLimit, maxWaitingTimeMs }
  }

  waiting(): ITask<D>[] {
    return this.waitingTasks.map(task => task.inner)
  }

  private runNextWaitingTask() {
    const next = this.waitingTasks.shift()
    if (next) {
      if (next.tid) clearTimeout(next.tid)
      debug(`Attempting to run a task from the waiting list. id="${next.id}"`)
      this.runTask(next)
    }
  }

  protected runTask(task: Task<D>): void {
    if (this.runnedTasks.size < this.limitedOptions.concurrencyLimit) {
      super.runTask(task)
      task.defer.promise.finally(() => this.runNextWaitingTask()).catch(() => {})
      return
    }
    const runnedTime = Date.now()
    task.tid = setTimeout(() => {
      debug(
        `A task on the waiting list is waiting longer than it should. id="${task.id}"; time="${Date.now() - runnedTime}"; maxWaitingTimeMs="${this.limitedOptions.maxWaitingTimeMs}"`,
      )
      this.abort(task.id, new TimekeeperTimeoutError(Date.now() - runnedTime))
    }, this.limitedOptions.maxWaitingTimeMs)?.unref()
    this.waitingTasks.push(task)
    this.metrics?.waitTask?.(this.waitingTasks.length)
    debug(`The task has been added to the waiting list. id="${task.id}"`)
  }

  protected findTaskById(id: string): Task<D> | null {
    return super.findTaskById(id) || this.waitingTasks.find(task => task.id === id) || null
  }

  protected rejectPendingTask(task: Task<D>, error: unknown): void {
    if (this.currentTask?.id === task.id) return super.rejectPendingTask(task, error)
    this.waitingTasks = this.waitingTasks.filter(({ id }) => id !== task.id)
    if (task.tid) clearTimeout(task.tid)
    this.metrics?.rejectTask?.(error, task.inner)
    this.callAbortedRunner(task, error)
    debug(`The task was rejected. id="${task.id}"`)
  }

  clear(): void {
    super.clear()
    this.waitingTasks.forEach(task => this.abort(task.inner))
  }
}
