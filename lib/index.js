const parseOptions = require('./parse_options')
const { PROP_BATCH_FN, PROP_OPTIONS, PROP_CACHE } = require('./constants')

class BatchLoader {
    constructor(batchLoadFn, options) {
        const { batchFn, maxSize, time, parallel, getKey } = parseOptions(batchLoadFn, options)

        this[PROP_BATCH_FN] = batchFn
        this[PROP_OPTIONS] = { maxSize, time, parallel, getKey }
        this[PROP_CACHE] = new Map()
    }

    get batchLoadFn() {
        return this[PROP_BATCH_FN]
    }

    get options() {
        return { ...this[PROP_OPTIONS] }
    }

    get cache() {
        return this[PROP_CACHE]
    }

    load(data) {
        return Promise.resolve()
    }

    loadMany(arr) {
        return Promise.all(arr.map(data => this.load(data)))
    }
}

module.exports = BatchLoader
