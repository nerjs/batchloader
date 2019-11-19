const parseOptions = require('../lib/parse_options')
const {
    MSG_BAD_BATCHLOAD_FN,
    DEFAULT_BATCH_TIME,
    DEFAULT_CACHE_TIME,
    DEFAULT_GET_KEY,
    DEFAULT_SIZE,
} = require('../lib/constants')

describe('parseOptions', () => {
    test('bad batchLoaderFn', () => {
        expect(() => parseOptions()).toThrow(MSG_BAD_BATCHLOAD_FN)
    })

    test('empty object', () => {
        const batchLoadFn = () => {}

        const { batchFn, maxSize, cacheTime, batchTime, getKey } = parseOptions(batchLoadFn)

        expect(batchFn).toEqual(batchLoadFn)
        expect(maxSize).toEqual(DEFAULT_SIZE)
        expect(cacheTime).toEqual(DEFAULT_CACHE_TIME)
        expect(batchTime).toEqual(DEFAULT_BATCH_TIME)
        expect(getKey).toEqual(DEFAULT_GET_KEY)
    })

    test('correct parameters', () => {
        const batchLoadFn = () => {}
        const getKeyFn = () => {}

        const { maxSize, cacheTime, batchTime, getKey } = parseOptions(batchLoadFn, {
            maxSize: 1,
            cacheTime: 2,
            batchTime: 3,
            getKey: getKeyFn,
        })

        expect(maxSize).toEqual(1)
        expect(cacheTime).toEqual(2)
        expect(batchTime).toEqual(3)
        expect(getKey).toEqual(getKeyFn)
    })
})
