const {
    DEFAULT_SIZE,
    DEFAULT_BATCH_TIME,
    DEFAULT_CACHE_TIME,
    DEFAULT_PARALLEL,
    DEFAULT_GET_KEY,
    MSG_BAD_BATCHLOAD_FN,
} = require('./constants')

const prepareOption = (value, defaultValue, filter) =>
    value === undefined || !filter(value) ? defaultValue : value

module.exports = (batchFn, options) => {
    const { maxSize, batchTime, cacheTime, parallel, getKey } =
        options && typeof options == 'object' ? options : {}
    if (typeof batchFn !== 'function') throw new TypeError(MSG_BAD_BATCHLOAD_FN)

    return {
        batchFn,
        maxSize: prepareOption(maxSize, DEFAULT_SIZE, n => typeof n === 'number' && n >= 0),
        parallel: prepareOption(parallel, DEFAULT_PARALLEL, n => typeof n === 'boolean'),
        getKey: prepareOption(getKey, DEFAULT_GET_KEY, n => typeof n === 'function'),
        cacheTime: prepareOption(
            cacheTime,
            DEFAULT_CACHE_TIME,
            n => typeof n === 'number' && n >= 0,
        ),
        batchTime: prepareOption(
            batchTime,
            DEFAULT_BATCH_TIME,
            n => typeof n === 'number' && n >= 0,
        ),
    }
}
