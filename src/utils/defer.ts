export class Defer<T = any> {
  #resolveFn?: (value: T | PromiseLike<T>) => void
  #rejectFn?: (reason: any) => void

  readonly promise = new Promise<T>((resolve, reject) => {
    this.#resolveFn = resolve
    this.#rejectFn = reject
  })

  constructor() {
    this.promise.catch(() => {})
  }

  resolve(value: T | PromiseLike<T>) {
    this.#resolveFn?.(value)
  }

  reject(reason: any) {
    this.#rejectFn?.(reason)
  }
}
