import { sleep } from '../../utils/sleep'
import {
  ILimitedTimekeeperMetrics,
  ITask,
  ITimekeeper,
  IUnlimitedTimekeeperMetrics,
  LimitedTimekeeperOptions,
  UnlimitedTimekeeperOptions,
} from '../interfaces'
import { LimitedTimekeeper } from '../limited.timekeeper'
import { UnlimitedTimekeeper } from '../unlimited.timekeeper'

class UnlimitedMetrics implements IUnlimitedTimekeeperMetrics {
  private created: number = 0
  private runned: number = 0
  private maxRunnedSize = 0
  private resolved = 0
  private rejected = 0
  private maxRunnedTime = 0
  create() {
    this.created++
  }

  runTask(runnedSize: number, _task: ITask<any>) {
    this.runned++
    if (this.maxRunnedSize < runnedSize) this.maxRunnedSize = runnedSize
  }

  resolveTask(task: ITask<any>) {
    this.resolved++
    const runnedTime = Date.now() - (task.runnedAt || task.createdAt)
    if (this.maxRunnedTime < runnedTime) this.maxRunnedTime = runnedTime
  }

  rejectTask(error: unknown, task: ITask<any>) {
    this.rejected++
    const runnedTime = Date.now() - (task.runnedAt || task.createdAt)
    if (this.maxRunnedTime < runnedTime) this.maxRunnedTime = runnedTime
  }

  toJSON() {
    const { created, runned, maxRunnedSize, resolved, rejected, maxRunnedTime } = this
    return { created, runned, maxRunnedSize, resolved, rejected, maxRunnedTime }
  }
}

class LimitedMetrics extends UnlimitedMetrics implements ILimitedTimekeeperMetrics {
  private maxWaitingSize = 0
  private maxWaitingTime = 0
  waitTask(waitListSize: number) {
    if (this.maxWaitingSize < waitListSize) this.maxWaitingSize = waitListSize
  }

  runTask(runnedSize: number, task: ITask<any>): void {
    super.runTask(runnedSize, task)
    const waitingTime = Date.now() - (task.runnedAt || task.createdAt)
    if (this.maxWaitingTime < waitingTime) this.maxWaitingTime = waitingTime
  }

  toJSON() {
    const { maxWaitingSize, maxWaitingTime } = this
    return {
      ...super.toJSON(),
      maxWaitingTime,
      maxWaitingSize,
    } as const
  }
}

describe('Timekeepers with metrics.', () => {
  const runMs = 100
  const timeoutMs = 1000
  const runnerFn = jest.fn()
  const options: UnlimitedTimekeeperOptions<any> = {
    initialDataFactory: () => ({}),
    runMs,
    runner: runnerFn,
    timeoutMs,
  }

  let timekeeper: ITimekeeper<any>

  beforeEach(() => {
    jest.clearAllMocks()
    runnerFn.mockImplementation(() => sleep(100, true))
  })

  afterEach(() => {
    timekeeper.clear()
  })

  describe('Unlimited', () => {
    let metrics: LimitedMetrics
    beforeEach(() => {
      metrics = new LimitedMetrics()
      timekeeper = new UnlimitedTimekeeper(options, metrics)
    })

    it('runned size', () => {
      for (let i = 0; i < 3; i++) {
        timekeeper.current()
        timekeeper.run()
      }
      timekeeper.current()

      expect(metrics.toJSON().runned).toEqual(3)
      expect(metrics.toJSON().maxRunnedSize).toEqual(3)
      expect(metrics.toJSON().created).toEqual(4)
    })

    it('resolved & rejected', async () => {
      for (let i = 0; i < 3; i++) {
        timekeeper.current()
        timekeeper.run()
      }
      for (let i = 0; i < 2; i++) {
        const task = timekeeper.current()
        timekeeper.run()
        await sleep(10)
        timekeeper.abort(task)
      }

      await sleep(100)

      expect(metrics.toJSON().resolved).toEqual(3)
      expect(metrics.toJSON().rejected).toEqual(2)
    })

    it('max run time', async () => {
      runnerFn.mockImplementation(() => sleep(800, true))
      const task = timekeeper.current()
      timekeeper.run()
      runnerFn.mockImplementation(() => sleep(500, true))
      timekeeper.current()
      timekeeper.run()

      await timekeeper.wait(task)

      expect(metrics.toJSON().maxRunnedTime).toBeGreaterThanOrEqual(800)
      expect(metrics.toJSON().maxRunnedTime).toBeLessThan(900)
    })
  })

  describe('Limited', () => {
    const unlimitedOptions: LimitedTimekeeperOptions<any> = {
      ...options,
      concurrencyLimit: 10,
      maxWaitingTimeMs: 2000,
    }
    let metrics: LimitedMetrics

    beforeEach(() => {
      metrics = new LimitedMetrics()
      timekeeper = new LimitedTimekeeper(unlimitedOptions, metrics)
    })

    it('waiting size', () => {
      for (let i = 0; i < unlimitedOptions.concurrencyLimit; i++) {
        timekeeper.current()
        timekeeper.run()
      }
      for (let i = 0; i < 3; i++) {
        timekeeper.current()
        timekeeper.run()
      }

      expect(metrics.toJSON().runned).toEqual(unlimitedOptions.concurrencyLimit)
      expect(metrics.toJSON().maxRunnedSize).toEqual(unlimitedOptions.concurrencyLimit)
      expect(metrics.toJSON().created).toEqual(unlimitedOptions.concurrencyLimit + 3)
      expect(metrics.toJSON().maxWaitingSize).toEqual(3)
    })
  })
})
