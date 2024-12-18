import { TimekeeperTimeoutError } from './errors'
import { ITask, ITimekeeper } from './interfaces'
import { Task } from './task'
import { IUnlimitedTimekeeperMetrics, UnlimitedTimekeeper, UnlimitedTimekeeperOptions } from './unlimited.timekeeper'

interface LimitedOptions {
  concurrencyLimit: number
  maxWaitingTimeMs: number
}

export interface ILimitedTimekeeperMetrics {
  waitTask?: (waitListSize: number) => void
}

export type LimitedTimekeeperOptions<D> = UnlimitedTimekeeperOptions<D> & LimitedOptions

export class LimitedTimekeeper<D> extends UnlimitedTimekeeper<D> implements ITimekeeper<D> {
  private readonly limitedOptions: LimitedOptions

  private waitingTasks: Task<D>[] = []

  constructor(
    { concurrencyLimit, maxWaitingTimeMs, ...options }: LimitedTimekeeperOptions<D>,
    private readonly limitedMetrics?: ILimitedTimekeeperMetrics & IUnlimitedTimekeeperMetrics,
  ) {
    super(options, limitedMetrics)
    this.limitedOptions = { concurrencyLimit, maxWaitingTimeMs }
  }

  waiting(): ITask<D>[] {
    return this.waitingTasks.map(task => task.inner)
  }

  private runNextWaitingTask() {
    const next = this.waitingTasks.shift()
    if (next) {
      if (next.tid) clearTimeout(next.tid)
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
    task.tid = setTimeout(
      () => this.abort(task.id, new TimekeeperTimeoutError(Date.now() - runnedTime)),
      this.limitedOptions.maxWaitingTimeMs,
    )?.unref()
    this.waitingTasks.push(task)
    this.limitedMetrics?.waitTask?.(this.waitingTasks.length)
  }

  protected findTaskById(id: string): Task<D> | null {
    return super.findTaskById(id) || this.waitingTasks.find(task => task.id === id) || null
  }

  protected rejectPendingTask(task: Task<D>, error: unknown): void {
    if (this.currentTask?.id === task.id) return super.rejectPendingTask(task, error)
    this.waitingTasks = this.waitingTasks.filter(({ id }) => id !== task.id)
    if (task.tid) clearTimeout(task.tid)
    this.limitedMetrics?.rejectTask?.(error, task.status, task.createdAt, task.runnedAt || task.createdAt)
    this.callAbortedRunner(task, error)
  }

  clear(): void {
    super.clear()
    this.waitingTasks.forEach(task => this.abort(task.inner))
  }
}
