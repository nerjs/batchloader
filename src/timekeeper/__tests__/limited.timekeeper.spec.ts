import { AbortError, TimeoutError } from '../../utils/errors'
import { sleep } from '../../utils/sleep'
import { ITask, LimitedTimekeeperOptions } from '../interfaces'
import { LimitedTimekeeper } from '../limited.timekeeper'

type Data = { field: string }

describe('Unlimited Timekeeper', () => {
  const runMs = 100
  const timeoutMs = 1000
  const concurrencyLimit = 1
  const maxWaitingTimeMs = 500
  const runnerFn = jest.fn()
  const options: LimitedTimekeeperOptions<Data> = {
    initialDataFactory: () => ({ field: 'qwerty' }),
    runMs,
    runner: runnerFn,
    timeoutMs,
    concurrencyLimit,
    maxWaitingTimeMs,
  }
  let timekeeper: LimitedTimekeeper<Data>

  beforeEach(() => {
    timekeeper = new LimitedTimekeeper(options)
    jest.clearAllMocks()
    jest.resetAllMocks()
    runnerFn.mockImplementation(() => sleep(100, true))
  })

  afterEach(() => {
    timekeeper.clear()
  })

  const skipTasks = () => {
    const tasks: ITask<Data>[] = []

    for (let i = 0; i < concurrencyLimit; i++) {
      tasks.push(timekeeper.current())
      timekeeper.run()
    }

    return tasks
  }

  it('When tasks are activated, only the first {concurrencyLimit} transition to runned, others remain pending', async () => {
    for (const task of skipTasks()) expect(task.status).toEqual('runned')

    const nextTask = timekeeper.current()
    timekeeper.run()

    expect(timekeeper.waiting()).toEqual([nextTask])
    expect(nextTask.status).toEqual('pending')
    expect(runnerFn).toHaveBeenCalledTimes(concurrencyLimit)
  })

  it('After a running task completes, a task from the waiting list starts', async () => {
    skipTasks()

    const task = timekeeper.current()
    timekeeper.run()

    await sleep(runMs)
    expect(task.status).toEqual('runned')
    expect(runnerFn).toHaveBeenCalledTimes(concurrencyLimit + 1)
    expect(timekeeper.waiting().length).toEqual(0)
  })

  describe('If a task remains in the waiting list longer than {maxWaitingTimeMs}', () => {
    it('With {callRejectedTask = true}, the runner is called with an aborted signal', async () => {
      timekeeper = new LimitedTimekeeper({
        ...options,
        callRejectedTask: true,
      })
      runnerFn.mockImplementation(async () => sleep(maxWaitingTimeMs + 100, true))
      skipTasks()

      runnerFn.mockClear()

      const task = timekeeper.current()
      timekeeper.run()
      await expect(() => timekeeper.wait(task)).rejects.toThrow(TimeoutError)
      expect(runnerFn).toHaveBeenCalledWith(task, expect.objectContaining({ aborted: true, reason: expect.any(TimeoutError) }))
      expect(task.status).toEqual('rejected')
    })

    it('With {callRejectedTask = false}, the task simply changes status to rejected', async () => {
      timekeeper = new LimitedTimekeeper({
        ...options,
        callRejectedTask: false,
      })
      runnerFn.mockImplementation(async () => sleep(maxWaitingTimeMs + 100, true))
      skipTasks()

      runnerFn.mockClear()

      const task = timekeeper.current()
      timekeeper.run()
      await expect(() => timekeeper.wait(task)).rejects.toThrow(TimeoutError)
      expect(runnerFn).not.toHaveBeenCalled()
      expect(task.status).toEqual('rejected')
    })
  })

  describe('Calling abort on a pending task', () => {
    describe('With {callRejectedTask = true}', () => {
      beforeEach(() => {
        timekeeper = new LimitedTimekeeper({
          ...options,
          callRejectedTask: true,
        })
      })

      it('For the current task, starts the runner with an aborted signal and changes its status to rejected', async () => {
        const task = timekeeper.current()
        setTimeout(() => timekeeper.abort(task), 10)

        await expect(() => timekeeper.wait(task)).rejects.toThrow(AbortError)
        expect(runnerFn).toHaveBeenCalledWith(task, expect.objectContaining({ aborted: true, reason: expect.any(AbortError) }))
        expect(task.status).toEqual('rejected')
      })

      it('For a task in the waiting list, starts the runner with an aborted signal and changes its status to rejected', async () => {
        skipTasks()
        runnerFn.mockClear()

        const task = timekeeper.current()
        timekeeper.run()
        setTimeout(() => timekeeper.abort(task), 10)

        await expect(() => timekeeper.wait(task)).rejects.toThrow(AbortError)
        expect(runnerFn).toHaveBeenCalledWith(task, expect.objectContaining({ aborted: true, reason: expect.any(AbortError) }))
        expect(task.status).toEqual('rejected')
      })
    })

    describe('With {callRejectedTask = false}', () => {
      beforeEach(() => {
        timekeeper = new LimitedTimekeeper({
          ...options,
          callRejectedTask: false,
        })
      })
      it('For the current task, simply changes its status to rejected', async () => {
        const task = timekeeper.current()
        setTimeout(() => timekeeper.abort(task), 10)

        await expect(() => timekeeper.wait(task)).rejects.toThrow(AbortError)
        expect(runnerFn).not.toHaveBeenCalled()
        expect(task.status).toEqual('rejected')
      })

      it('For a task in the waiting list, simply changes its status to rejected', async () => {
        skipTasks()
        runnerFn.mockClear()

        const task = timekeeper.current()
        timekeeper.run()
        setTimeout(() => timekeeper.abort(task), 10)

        await expect(() => timekeeper.wait(task)).rejects.toThrow(AbortError)
        expect(runnerFn).not.toHaveBeenCalled()
        expect(task.status).toEqual('rejected')
      })
    })
  })
})
