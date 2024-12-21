import { ILimitedTimekeeperMetrics, ITask, ITimekeeper } from '../timekeeper/interfaces'
import { LimitedTimekeeper } from '../timekeeper/limited.timekeeper'
import { UnlimitedTimekeeper } from '../timekeeper/unlimited.timekeeper'
import { BatchError } from './errors'
import createDebug from 'debug'
import { BatchLoaderFn, IBatchAggregatorMetrics, IBatchAggregatorOptions } from './interfaces'
const debug = createDebug('batchloader:aggregator')

interface TaskData<T, R> {
  requests: T[]
  responses: R[]
}

const createTimekeeperMetrics = (metrics?: IBatchAggregatorMetrics): ILimitedTimekeeperMetrics | undefined => {
  if (!metrics) return undefined

  const tkMetrics: ILimitedTimekeeperMetrics<TaskData<any, any>> = {}

  if (metrics.resolveBatch) tkMetrics.resolveTask = task => metrics.resolveBatch?.(task.data.requests.length)
  if (metrics.rejectBatch) tkMetrics.rejectTask = (_, task) => metrics.rejectBatch?.(task.data.requests.length)
  if (metrics.parallelBatches) tkMetrics.runTask = runnedSize => metrics.parallelBatches?.(runnedSize)
  if (metrics.waitingBatches) tkMetrics.waitTask = runnedSize => metrics.waitingBatches?.(runnedSize)

  return tkMetrics
}

export class BatchAggregator<T, R> {
  private readonly timekeeper: ITimekeeper<TaskData<T, R>>

  private readonly batchRunner = async (task: ITask<TaskData<T, R>>, signal: AbortSignal) => {
    this.metrics?.rejectBatch?.(task.data.requests.length)
    debug(`Running batchRunner with a query array of length ${task.data.requests.length}. task id="${task.id}"`)
    const response = await this.batchLoaderFn([...task.data.requests], signal)
    if (!Array.isArray(response) || response.length !== task.data.requests.length)
      throw new BatchError(`The result of batchLoadFn must be an array equal in length to the query array `)

    task.data.responses = response
  }

  constructor(
    private readonly batchLoaderFn: BatchLoaderFn<T, R>,
    private readonly options: IBatchAggregatorOptions,
    private readonly metrics?: IBatchAggregatorMetrics,
  ) {
    const { concurrencyLimit, maxWaitingTimeMs, batchTimeMs: runMs, batchTimeout: timeoutMs } = options
    const initialDataFactory = () => ({ requests: [], responses: [] })
    this.timekeeper =
      concurrencyLimit && concurrencyLimit > 0 && concurrencyLimit < Infinity
        ? new LimitedTimekeeper(
            {
              concurrencyLimit,
              initialDataFactory,
              maxWaitingTimeMs: maxWaitingTimeMs || 60_000,
              runMs,
              runner: this.batchRunner,
              timeoutMs,
              callRejectedTask: false,
            },
            createTimekeeperMetrics(metrics),
          )
        : new UnlimitedTimekeeper(
            {
              initialDataFactory,
              runMs,
              runner: this.batchRunner,
              timeoutMs,
              callRejectedTask: false,
            },
            createTimekeeperMetrics(metrics),
          )

    debug(`Create BatchAggregator with ${this.timekeeper.constructor.name}`)
  }

  private getCurrentTask(): ITask<TaskData<T, R>> {
    const task = this.timekeeper.current()
    if (task.data.requests.length >= this.options.maxBatchSize) {
      debug(`The size of the current batch has reached the maximum. size=${task.data.requests.length}`)
      this.timekeeper.run()
      return this.getCurrentTask()
    }
    return task
  }

  async load(request: T): Promise<R> {
    const task = this.getCurrentTask()
    const index = task.data.requests.length
    this.metrics?.loadBatchItem?.()
    debug(`Load data. task id="${task.id}"; curent index="${index}"`)
    task.data.requests.push(request)
    await this.timekeeper.wait(task)

    return task.data.responses[index]
  }

  clear() {
    this.timekeeper.clear()
  }
}
