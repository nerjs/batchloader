export class LoaderError extends Error {
  get name() {
    return this.constructor.name
  }
}

export class TimeoutError extends LoaderError {
  constructor(readonly delay: number) {
    super(`Operation exceeded the maximum timeout of ${delay} ms.`)
  }
}

export class AbortError extends LoaderError {
  constructor(
    readonly operation: string,
    reason?: unknown,
  ) {
    super(`Operation "${operation}" was aborted${reason && typeof reason === 'string' ? `. ${reason}` : ''}`, { cause: reason })
  }
}

export class SilentAbortError extends AbortError {}

export class RejectedAbortError extends AbortError {
  constructor(operation: string) {
    super(operation, 'Operation runner was rejected')
  }
}
