import { isCommonError } from '../utils/is'
import { TimekeeperAbortError, TimekeeperTimeoutError } from './errors'
import { ITask, ITimekeeper, IUnlimitedTimekeeperMetrics, UnlimitedTimekeeperOptions } from './interfaces'
import { Task } from './task'
import createDebug from 'debug'
const debug = createDebug('batchloader:timekeeper')

export class UnlimitedTimekeeper<D, M extends IUnlimitedTimekeeperMetrics = IUnlimitedTimekeeperMetrics> implements ITimekeeper<D> {
  protected currentTask: Task<D> | null = null
  protected runnedTasks = new Map<string, Task<D>>()

  constructor(
    protected readonly options: UnlimitedTimekeeperOptions<D>,
    protected readonly metrics?: M,
  ) {}

  current(): ITask<D> {
    if (this.currentTask) return this.currentTask.inner
    const task = new Task(this.options.initialDataFactory())
    debug(`Create new task. id="${task.id}"`)
    this.currentTask = task
    this.startRunnerTimeout()
    this.metrics?.create?.()
    return task.inner
  }

  run(): void {
    if (!this.currentTask) return
    this.clearRunnerTimeout()
    this.metrics?.forcedRun?.()
    debug(`The current task is started manually. id="${this.currentTask.id}"`)
    this.runCurrentTask()
  }

  abort(task: string | ITask<D>, reason?: unknown): void {
    const target = this.findTask(task)
    if (target) {
      debug(`Abort task. id="${target.id}"`)
      const error = isCommonError(reason) ? reason : new TimekeeperAbortError(reason)
      this.metrics?.abort?.(target.inner, error)
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

    this.tidRunner = setTimeout(() => {
      debug(`The current task is started by a timer. id=${this.currentTask?.id}`)
      this.runCurrentTask()
    }, this.options.runMs)?.unref()
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

  private async callRunner(task: Task<D>, signal: AbortSignal, toThrow?: boolean) {
    try {
      await this.options.runner(task.inner, signal)
    } catch (error) {
      debug(`Aborted runner terminated with an error. id="${task.id}"`)
      if (toThrow) throw error
    }
  }

  protected runTask(task: Task<D>) {
    task.status = 'runned'
    task.controller = task.controller || new AbortController()
    const runnedTime = Date.now()
    task.tid = setTimeout(() => this.abort(task.id, new TimekeeperTimeoutError(Date.now() - runnedTime)), this.options.timeoutMs)?.unref()

    this.runnedTasks.set(task.id, task)
    this.metrics?.runTask?.(this.runnedTasks.size, task.inner)

    this.callRunner(task, task.controller.signal, true)
      .then(() => this.resolveTask(task))
      .catch(error => this.rejectRunnedTask(task, error))
  }

  private resolveTask(task: Task<D>) {
    if (task.tid) clearTimeout(task.tid)
    this.runnedTasks.delete(task.id)
    if (task.status !== 'runned') return
    task.status = 'resolved'
    debug(`The task was resolved. id="${task.id}"`)
    task.defer.resolve(task.inner.data)
    this.metrics?.resolveTask?.(task.inner)
  }

  private rejectRunnedTask(task: Task<D>, error: unknown) {
    if (task.tid) clearTimeout(task.tid)
    task.status = 'rejected'
    this.runnedTasks.delete(task.id)
    task.controller?.abort(error)
    task.defer.reject(error)
    this.metrics?.rejectTask?.(error, task.inner)
    debug(`The task was rejected. id="${task.id}"`)
  }

  protected rejectPendingTask(task: Task<D>, error: unknown) {
    this.clearRunnerTimeout()
    this.currentTask = null
    this.metrics?.rejectTask?.(error, task.inner)
    this.callAbortedRunner(task, error)
    debug(`The task was rejected. id="${task.id}"`)
  }

  protected callAbortedRunner(task: Task<D>, error: unknown) {
    task.status = 'rejected'

    if (this.options.callRejectedTask) this.callRunner(task, AbortSignal.abort(error), false)
    task.defer.reject(error)
  }
}
