const BatchLoader = require('../lib/index')
const {
    MSG_BAD_BATCHLOAD_FN,
    MSG_EMPTY_LOAD_METHOD,
    MSG_BAD_GET_KEY_FN,
    MSG_BAD_RESULT,
    MSG_LOAD_MANY_METHOD,
} = require('../lib/constants')

describe('BatchLoader', () => {
    it('init', () => {
        const batchLoaderFn = () => {}
        const getKeyFn = () => {}
        const loader = new BatchLoader(batchLoaderFn, {
            maxSize: 1,
            cacheTime: 2,
            batchTime: 3,
            getKey: getKeyFn,
        })

        expect(loader.batchLoadFn).toEqual(batchLoaderFn)
        expect(loader.options.maxSize).toEqual(1)
        expect(loader.options.cacheTime).toEqual(2)
        expect(loader.options.batchTime).toEqual(3)
        expect(loader.options.getKey).toEqual(getKeyFn)
        expect(loader.size).toEqual(0)
    })

    it('errors', async () => {
        expect(() => {
            new BatchLoader()
        }).toThrow(MSG_BAD_BATCHLOAD_FN)

        const batchLoaderFn = async () => {}

        let loader = new BatchLoader(batchLoaderFn, { getKey: () => null })

        await expect(() => loader.load()).toThrow(MSG_EMPTY_LOAD_METHOD)
        await expect(() => loader.load(1)).toThrow(MSG_BAD_GET_KEY_FN)

        loader = new BatchLoader(batchLoaderFn)
        await expect(loader.load(3)).rejects.toThrow(MSG_BAD_RESULT)
        expect(() => loader.loadMany()).toThrow(MSG_LOAD_MANY_METHOD)
        expect(() => loader.loadMany(null)).toThrow(MSG_LOAD_MANY_METHOD)
        expect(() => loader.loadMany(1)).toThrow(MSG_LOAD_MANY_METHOD)
        expect(() => loader.loadMany('1')).toThrow(MSG_LOAD_MANY_METHOD)
        expect(() => loader.loadMany({ a: 1 })).toThrow(MSG_LOAD_MANY_METHOD)

        loader = new BatchLoader(() => {
            throw new Error('Test Error')
        })
        await expect(loader.load(3)).rejects.toThrow('Test Error')

        await expect(
            Promise.all([loader.load(1), loader.load(2), loader.load(3), loader.load(4)]),
        ).rejects.toThrow('Test Error')

        await Promise.all([
            expect(loader.load(5)).rejects.toThrow('Test Error'),
            expect(loader.load(6)).rejects.toThrow('Test Error'),
            expect(loader.load(7)).rejects.toThrow('Test Error'),
            expect(loader.load(8)).rejects.toThrow('Test Error'),
        ])

        const badBatchLoaderFn = arr => {
            arr.shift()
            return arr
        }

        loader = new BatchLoader(badBatchLoaderFn)

        await Promise.all([
            expect(loader.load(5)).rejects.toThrow(MSG_BAD_RESULT),
            expect(loader.load(6)).rejects.toThrow(MSG_BAD_RESULT),
            expect(loader.load(7)).rejects.toThrow(MSG_BAD_RESULT),
        ])
    })

    it('load() batch', async () => {
        let batchLoaderFn, loader
        jest.useFakeTimers()

        batchLoaderFn = jest.fn(async arr => arr)

        loader = new BatchLoader(batchLoaderFn, { batchTime: 20, cacheTime: 3 })

        const promise1 = loader.load(1)
        const promise11 = loader.load(1)

        expect(setTimeout).toHaveBeenCalledTimes(1)
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 20)
        expect(promise1).toEqual(promise11)

        expect(batchLoaderFn).toHaveBeenCalledTimes(0)

        jest.advanceTimersByTime(10)
        const promise2 = loader.load(2)
        jest.advanceTimersByTime(10)

        expect(batchLoaderFn).toHaveBeenCalledTimes(1)
        expect(batchLoaderFn).toHaveBeenLastCalledWith([1, 2])

        jest.advanceTimersByTime(10)
        const promise3 = loader.load(3)
        jest.advanceTimersByTime(20)

        expect(batchLoaderFn).toHaveBeenCalledTimes(2)
        expect(batchLoaderFn).toHaveBeenLastCalledWith([3])

        const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3])

        expect(result1).toEqual(1)
        expect(result2).toEqual(2)
        expect(result3).toEqual(3)
        jest.useRealTimers()
    })

    it('load() cache', async () => {
        let batchLoaderFn, loader
        jest.useFakeTimers()
        batchLoaderFn = jest.fn(async arr => arr)
        loader = new BatchLoader(batchLoaderFn, { batchTime: 20, cacheTime: 20 })

        loader.load(1)
        jest.advanceTimersByTime(20)
        const result1 = await loader.load(1)
        jest.advanceTimersByTime(10)
        const result2 = await loader.load(1)

        expect(result1).toEqual(1)
        expect(result2).toEqual(1)
        expect(batchLoaderFn).toHaveBeenCalledTimes(1)

        jest.advanceTimersByTime(10)
        loader.load(1)
        jest.advanceTimersByTime(20)
        expect(batchLoaderFn).toHaveBeenCalledTimes(2)
    })

    it('.loadMany()', async () => {
        const batchLoaderFn = jest.fn(async arr => arr)
        const loader = new BatchLoader(batchLoaderFn, { batchTime: 10, cacheTime: 20 })
        jest.useFakeTimers()

        const promise = loader.loadMany([3, 4, 5])
        jest.runOnlyPendingTimers()

        const [result1, result2, result3] = await promise

        expect(result1).toEqual(3)
        expect(result2).toEqual(4)
        expect(result3).toEqual(5)

        const result4 = await loader.load(4)

        expect(result4).toEqual(4)
        expect(batchLoaderFn).toHaveBeenCalledTimes(1)
        jest.useRealTimers()
    })

    it('.clear()', async () => {
        const batchLoaderFn = jest.fn(async arr => arr)
        const loader = new BatchLoader(batchLoaderFn, { batchTime: 5, cacheTime: 30 })

        let result = await loader.load(1)

        expect(batchLoaderFn).toHaveBeenCalledTimes(1)
        expect(result).toEqual(1)

        result = await loader.load(1)
        expect(batchLoaderFn).toHaveBeenCalledTimes(1)
        expect(result).toEqual(1)

        loader.clear(1)
        result = await loader.load(1)
        expect(batchLoaderFn).toHaveBeenCalledTimes(2)
    })

    it('.resolve(), .reject()', async () => {
        const batchLoaderFn = jest.fn(async arr => arr)
        const loader = new BatchLoader(batchLoaderFn, { batchTime: 2, cacheTime: 3 })

        const promise1 = loader.load(1)
        const promise2 = loader.load(2)
        const promise3 = loader.load(3)

        loader.resolve(1, 4)
        loader.reject(2, new Error('Test error'))

        await expect(promise1).resolves.toEqual(4)
        await expect(promise2).rejects.toThrow('Test error')
        await expect(promise3).resolves.toEqual(3)

        expect(batchLoaderFn).toHaveBeenCalledTimes(1)
        expect(batchLoaderFn).toHaveBeenLastCalledWith([3])
    })
})
