import { AbortError, TimeoutError } from '../../utils/errors'
import { sleep } from '../../utils/sleep'
import { ITask, UnlimitedTimekeeperOptions } from '../interfaces'
import { UnlimitedTimekeeper } from '../unlimited.timekeeper'

type Data = { field: string }

describe('Unlimited Timekeeper', () => {
  const runMs = 100
  const timeoutMs = 1000
  const runnerFn = jest.fn()
  const options: UnlimitedTimekeeperOptions<Data> = {
    initialDataFactory: () => ({ field: 'qwerty' }),
    runMs,
    runner: runnerFn,
    timeoutMs,
  }

  let timekeeper: UnlimitedTimekeeper<Data>

  beforeEach(() => {
    timekeeper = new UnlimitedTimekeeper(options)
    jest.clearAllMocks()
    runnerFn.mockImplementation(() => sleep(100, true))
  })

  afterEach(() => {
    timekeeper.clear()
  })

  it('Before activation, current() returns a single task with status pending', () => {
    expect(timekeeper.current().id).toEqual(timekeeper.current().id)
  })

  it('After the specified time, the runner is executed, and the status changes to runned', async () => {
    const task = timekeeper.current()
    await sleep(runMs)
    expect(task.status).toEqual('runned')
    expect(runnerFn).toHaveBeenCalledWith(task, expect.any(AbortSignal))
  })

  it('Calling run() triggers the runner and changes the status to runned', () => {
    const task = timekeeper.current()
    timekeeper.run()

    expect(task.status).toEqual('runned')
    expect(runnerFn).toHaveBeenCalledWith(task, expect.any(AbortSignal))
  })

  it('Repeated calls to run() have no effect', () => {
    timekeeper.current()

    timekeeper.run()
    timekeeper.run()

    expect(runnerFn).toHaveBeenCalledTimes(1)
  })

  it('After calling run(), the next call to current() creates a new task', () => {
    const task1 = timekeeper.current()
    timekeeper.run()
    const task2 = timekeeper.current()

    expect(task1.id).not.toEqual(task2.id)
    expect(task2.status).toEqual('pending')
  })

  it('A task successfully completed (synchronously) changes status to resolved', async () => {
    runnerFn.mockImplementation(() => {})
    const task = timekeeper.current()
    timekeeper.run()

    await timekeeper.wait(task)
    expect(task.status).toEqual('resolved')
  })

  it('A task successfully completed (asynchronously) changes status to resolved', async () => {
    runnerFn.mockImplementation(async () => sleep(100, true))
    const task = timekeeper.current()
    timekeeper.run()

    await timekeeper.wait(task)
    expect(task.status).toEqual('resolved')
  })

  it('A task that ends with an error (synchronously) changes status to rejected', async () => {
    const error = new Error('qwerty')
    runnerFn.mockImplementation(() => {
      throw error
    })
    const task = timekeeper.current()
    timekeeper.run()

    await expect(() => timekeeper.wait(task)).rejects.toThrow(error)
    expect(task.status).toEqual('rejected')
  })

  it('A task that ends with an error (asynchronously) changes status to rejected', async () => {
    const error = new Error('qwerty')
    runnerFn.mockImplementation(async () => {
      await sleep(100, true)
      throw error
    })
    const task = timekeeper.current()
    timekeeper.run()

    await expect(() => timekeeper.wait(task)).rejects.toThrow(error)
    expect(task.status).toEqual('rejected')
  })

  it('If the runner does not complete before {timeoutMs}, abort is triggered', async () => {
    const callAbort = jest.fn()
    runnerFn.mockImplementation(async (_task: ITask<Data>, signal: AbortSignal) => {
      signal.addEventListener('abort', () => callAbort(signal.reason))
      await sleep(timeoutMs + 100, true)
    })

    const task = timekeeper.current()
    timekeeper.run()

    await expect(() => timekeeper.wait(task)).rejects.toThrow(TimeoutError)
    expect(callAbort).toHaveBeenCalledWith(expect.any(TimeoutError))
  })

  describe('Calling abort on a pending task', () => {
    it('With {callRejectedTask = true}, starts the runner with an aborted signal and changes the task status to rejected', async () => {
      timekeeper = new UnlimitedTimekeeper({
        ...options,
        callRejectedTask: true,
      })
      const task = timekeeper.current()
      setTimeout(() => timekeeper.abort(task), 10)

      await expect(() => timekeeper.wait(task)).rejects.toThrow(AbortError)
      expect(runnerFn).toHaveBeenCalledWith(task, expect.objectContaining({ aborted: true, reason: expect.any(AbortError) }))
      expect(task.status).toEqual('rejected')
    })

    it('With {callRejectedTask = false}, simply changes the task status to rejected', async () => {
      timekeeper = new UnlimitedTimekeeper({
        ...options,
        callRejectedTask: false,
      })
      const task = timekeeper.current()
      setTimeout(() => timekeeper.abort(task), 10)

      await expect(() => timekeeper.wait(task)).rejects.toThrow(AbortError)
      expect(runnerFn).not.toHaveBeenCalled()
      expect(task.status).toEqual('rejected')
    })
  })

  it('Calling abort on a runned task changes its status to rejected and triggers abort on the signal', async () => {
    const callAbort = jest.fn()
    runnerFn.mockImplementation(async (_task: ITask<Data>, signal: AbortSignal) => {
      signal.addEventListener('abort', () => callAbort(signal.reason))
      await sleep(timeoutMs + 100, true)
    })

    const task = timekeeper.current()
    timekeeper.run()
    setTimeout(() => timekeeper.abort(task), 10)

    await expect(() => timekeeper.wait(task)).rejects.toThrow(AbortError)
    expect(callAbort).toHaveBeenCalledWith(expect.any(AbortError))
    expect(task.status).toEqual('rejected')
  })
})
