import { isCommonError, isPromise } from '../utils/is'
import { TimekeeperAbortError, TimekeeperTimeoutError } from './errors'
import { InitiateDataFactory, ITask, ITimekeeper, RunnerCallback, TaskStatus } from './interfaces'
import { Task } from './task'

export interface IUnlimitedTimekeeperMetrics {
  create?: () => void
  forcedRun?: () => void
  abort?: (status: TaskStatus, error: unknown) => void
  runTask?: (runnedSize: number, createdAt: number) => void
  resolveTask?: (runnedAt: number) => void
  rejectTask?: (error: unknown, status: TaskStatus, createdAt: number, runnedAt: number) => void
}

export interface UnlimitedTimekeeperOptions<D> {
  initialDataFactory: InitiateDataFactory<D>
  runMs: number
  runner: RunnerCallback<D>
  timeoutMs: number
  callRejectedTask?: boolean
}

export class UnlimitedTimekeeper<D> implements ITimekeeper<D> {
  protected currentTask: Task<D> | null = null
  protected runnedTasks = new Map<string, Task<D>>()

  constructor(
    protected readonly options: UnlimitedTimekeeperOptions<D>,
    private readonly unlimitedMetrics?: IUnlimitedTimekeeperMetrics,
  ) {}

  current(): ITask<D> {
    if (this.currentTask) return this.currentTask.inner

    const task = new Task(this.options.initialDataFactory())
    this.currentTask = task
    this.startRunnerTimeout()
    this.unlimitedMetrics?.create?.()
    return task.inner
  }

  run(): void {
    if (!this.currentTask) return
    this.clearRunnerTimeout()
    this.unlimitedMetrics?.forcedRun?.()
    this.runCurrentTask()
  }

  abort(task: string | ITask<D>, reason?: unknown): void {
    const target = this.findTask(task)
    if (target) {
      const error = isCommonError(reason) ? reason : new TimekeeperAbortError(reason)
      this.unlimitedMetrics?.abort?.(target.status, error)
      switch (target.status) {
        case 'runned':
          this.rejectRunnedTask(target, error)
          break
        case 'pending':
          this.rejectPendingTask(target, error)
          break
      }
    }
  }

  async wait(task: string | ITask<D>): Promise<void> {
    await this.findTask(task)?.defer.promise
  }

  clear(): void {
    this.clearRunnerTimeout()
    this.runnedTasks.forEach(task => this.abort(task.inner))
  }

  private findTask(taskId: string | Pick<ITask<any>, 'id'>): Task<D> | null {
    if (typeof taskId === 'object') return this.findTask(taskId.id)
    return this.findTaskById(taskId)
  }

  protected findTaskById(id: string): Task<D> | null {
    if (this.currentTask && this.currentTask.id === id) return this.currentTask
    return this.runnedTasks.get(id) || null
  }

  private tidRunner: NodeJS.Timeout | null = null
  private startRunnerTimeout() {
    this.clearRunnerTimeout()

    this.tidRunner = setTimeout(() => this.runCurrentTask(), this.options.runMs)?.unref()
  }

  private clearRunnerTimeout() {
    if (this.tidRunner) {
      clearTimeout(this.tidRunner)
      this.tidRunner = null
    }
  }

  private runCurrentTask() {
    if (this.currentTask) {
      this.runTask(this.currentTask)
      this.currentTask = null
    }
  }

  protected runTask(task: Task<D>) {
    task.status = 'runned'
    task.controller = task.controller || new AbortController()
    const runnedTime = Date.now()
    task.tid = setTimeout(() => this.abort(task.id, new TimekeeperTimeoutError(Date.now() - runnedTime)), this.options.timeoutMs)?.unref()

    this.runnedTasks.set(task.id, task)
    this.unlimitedMetrics?.runTask?.(this.runnedTasks.size, task.createdAt)

    try {
      const result = this.options.runner(task.inner, task.controller.signal)
      if (isPromise(result)) result.then(() => this.resolveTask(task)).catch(error => this.rejectRunnedTask(task, error))
      else setTimeout(() => this.resolveTask(task), 1)?.unref()
    } catch (error) {
      setTimeout(() => this.rejectRunnedTask(task, error), 1)?.unref()
    }
  }

  private resolveTask(task: Task<D>) {
    if (task.tid) clearTimeout(task.tid)
    this.runnedTasks.delete(task.id)
    if (task.status !== 'runned') return
    task.status = 'resolved'
    task.defer.resolve(task.inner.data)
    this.unlimitedMetrics?.resolveTask?.(task.runnedAt || task.createdAt)
  }

  private rejectRunnedTask(task: Task<D>, error: unknown) {
    if (task.tid) clearTimeout(task.tid)
    task.status = 'rejected'
    this.runnedTasks.delete(task.id)
    task.controller?.abort(error)
    task.defer.reject(error)
    this.unlimitedMetrics?.rejectTask?.(error, task.status, task.createdAt, task.runnedAt || task.createdAt)
  }

  protected rejectPendingTask(task: Task<D>, error: unknown) {
    this.clearRunnerTimeout()
    this.currentTask = null
    this.unlimitedMetrics?.rejectTask?.(error, task.status, task.createdAt, task.runnedAt || task.createdAt)
    this.callAbortedRunner(task, error)
  }

  protected callAbortedRunner(task: Task<D>, error: unknown) {
    task.status = 'rejected'

    if (this.options.callRejectedTask) {
      try {
        this.options.runner(task.inner, AbortSignal.abort(error))?.catch(() => {})
      } catch {
        // ...
      }
    }
    task.defer.reject(error)
  }
}
