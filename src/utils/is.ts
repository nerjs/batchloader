import { LoaderError } from './errors'

const isObject = (value: any): value is Record<string, any> => value && typeof value === 'object'
export const isError = (value: any): value is Error => isObject(value) && value instanceof Error
export const isLoaderError = (value: any): value is LoaderError => isError(value) && value instanceof LoaderError
