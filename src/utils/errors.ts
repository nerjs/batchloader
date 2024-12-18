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
