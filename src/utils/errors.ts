export class CommonError extends Error {
  get name() {
    return this.constructor.name
  }

  toJSON() {
    const { name, message, ...value } = this
    return {
      message,
      name,
      ...value,
    }
  }
}

export class TimeoutError extends CommonError {
  constructor(readonly delay: number) {
    super(`Operation exceeded the maximum timeout of ${delay} ms.`)
  }
}

export class AbortError extends CommonError {
  constructor(
    readonly operation: string,
    reason?: string,
  ) {
    super(`Operation "${operation}" was aborted${reason ? `. ${reason}` : ''}`, { cause: reason })
  }
}

export class SilentAbortError extends AbortError {}

export class RejectedAbortError extends AbortError {
  constructor(operation: string) {
    super(operation, 'Operation runner was rejected')
  }
}
