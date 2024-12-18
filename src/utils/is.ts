import { CommonError } from './errors'

const isObject = (value: any): value is Record<string, any> => value && typeof value === 'object'
export const isPromise = (value: any): value is Promise<unknown> => isObject(value) && value instanceof Promise
export const isError = (value: any): value is Error => isObject(value) && value instanceof Error
export const isCommonError = (value: any): value is CommonError => isError(value) && value instanceof CommonError
