import { LoaderError } from './errors'

export const isError = (value: any): value is Error => value instanceof Error
export const isLoaderError = (value: any): value is LoaderError => value instanceof LoaderError
