import { CommonError, TimeoutError } from '../utils/errors'
import { isError } from '../utils/is'

export class TimekeeperTimeoutError extends TimeoutError {}

export class TimekeeperAbortError extends CommonError {
  constructor(readonly reason?: unknown) {
    super(isError(reason) ? reason.message : typeof reason === 'string' ? reason : 'aborted', { cause: reason })
  }
}
