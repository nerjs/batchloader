import { Defer } from '../utils/defer'
import { randomString } from '../utils/string'
import { ITask, TaskStatus } from './interfaces'

export class InnerTask<D> implements ITask<D> {
  #data: D

  get data() {
    return this.#data
  }

  constructor(
    data: D,
    private readonly task: Task<D>,
  ) {
    this.#data = data
  }

  get id() {
    return this.task.id
  }

  get status() {
    return this.task.status
  }
}

export class Task<D> {
  readonly id: string
  public status: TaskStatus = 'pending'
  public readonly createdAt: number = Date.now()
  public runnedAt: number | null = null
  readonly inner: InnerTask<D>
  readonly defer = new Defer<D>()
  controller?: AbortController
  tid?: NodeJS.Timeout | null = null

  constructor(data: D) {
    this.id = randomString()
    this.inner = new InnerTask(data, this)
  }
}
