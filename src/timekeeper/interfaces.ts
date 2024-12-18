export type TaskStatus = 'pending' | 'runned' | 'resolved' | 'rejected'

export interface ITask<D> {
  readonly id: string
  status: TaskStatus
  data: D
}

export type RunnerCallback<D> = (task: ITask<D>, signal: AbortSignal) => Promise<void> | void
export type InitiateDataFactory<D> = () => D

export interface ITimekeeper<D> {
  current(): ITask<D>
  run(): void
  abort(task: string | ITask<D>, reason?: unknown): void
  wait(task: string | ITask<D>): Promise<void>
  clear(): void
}
