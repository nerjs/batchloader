export type TaskStatus = 'pending' | 'runned' | 'resolved' | 'rejected'

export interface ITask<D> {
  readonly id: string
  status: TaskStatus
  data: D
  runnedAt: number | null
  createdAt: number
}

export type TimekeeperRunnerCallback<D> = (task: ITask<D>, signal: AbortSignal) => Promise<void> | void
export type InitiateDataFactory<D> = () => D

export interface ITimekeeper<D> {
  current(): ITask<D>
  run(): void
  abort(task: string | ITask<D>, reason?: unknown): void
  wait(task: string | ITask<D>): Promise<void>
  clear(): void
}

export interface UnlimitedTimekeeperOptions<D> {
  initialDataFactory: InitiateDataFactory<D>
  runMs: number
  runner: TimekeeperRunnerCallback<D>
  timeoutMs: number
  callRejectedTask?: boolean
}

export interface LimitedOptions {
  concurrencyLimit: number
  maxWaitingTimeMs: number
}

export type LimitedTimekeeperOptions<D> = UnlimitedTimekeeperOptions<D> & LimitedOptions

export interface IUnlimitedTimekeeperMetrics<D = any> {
  create?: () => void
  forcedRun?: () => void
  abort?: (task: ITask<D>, error: unknown) => void
  runTask?: (runnedSize: number, task: ITask<D>) => void
  resolveTask?: (task: ITask<D>) => void
  rejectTask?: (error: unknown, task: ITask<D>) => void
}
export interface ILimitedTimekeeperMetrics<D = any> extends IUnlimitedTimekeeperMetrics<D> {
  waitTask?: (waitListSize: number) => void
}
