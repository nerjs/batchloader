const DeferPromise = require('helpers-promise/defer')

const parseOptions = require('./parse_options')
const promiseFns = require('./promise_fns')
const {
    PROP_BATCH_FN,
    PROP_OPTIONS,
    PROP_CACHE,
    PROP_BATCH,
    PROP_WAIT_BATCH,
    MSG_EMPTY_LOAD_METHOD,
    MSG_BAD_GET_KEY_FN,
    MSG_BAD_RESULT,
} = require('./constants')

class BatchLoader {
    constructor(batchLoadFn, options) {
        const {
            batchFn,
            maxSize,
            cacheTime,
            batchTime,
            parallel, // feature
            getKey,
        } = parseOptions(batchLoadFn, options)

        this.timer = null

        this[PROP_BATCH_FN] = batchFn
        this[PROP_OPTIONS] = { maxSize, cacheTime, batchTime, parallel, getKey }
        this[PROP_CACHE] = new Map()
        this[PROP_BATCH] = new Map()
        this[PROP_WAIT_BATCH] = new Map()
    }

    get batchLoadFn() {
        return this[PROP_BATCH_FN]
    }

    get options() {
        return { ...this[PROP_OPTIONS] }
    }

    get size() {
        return this[PROP_BATCH].size
    }

    testRun() {
        const { maxSize, batchTime } = this.options

        if (this.size >= maxSize) return this.run()

        if (!this.timer) {
            this.timer = setTimeout(this.run.bind(this), batchTime)
        }
    }

    async run() {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }

        const { cacheTime } = this.options

        const batchCache = new Map(this[PROP_BATCH])
        this[PROP_BATCH].clear()

        const keys = [...batchCache.keys()]

        batchCache.forEach((data, key) => {
            this[PROP_WAIT_BATCH].set(key, data)
        })

        let results, error

        try {
            results = await this.batchLoadFn(keys.map(key => batchCache.get(key).data))
        } catch (err) {
            results = keys
            error = err
        }

        if (
            results === null ||
            results === undefined ||
            (Array.isArray(results) && results.length !== keys.length)
        )
            throw new Error(MSG_BAD_RESULT)

        keys.forEach((key, index) => {
            const batch = batchCache.get(key)
            if (error) return batch.promise.reject(error)
            const result = Array.isArray(results) ? results[index] : results
            batch.promise.resolve(result)
            if (cacheTime) {
                this[PROP_CACHE].set(key, { result })
                setTimeout(() => this[PROP_CACHE].delete(key), cacheTime)
            }
        })
    }

    load(data) {
        if (data === undefined || data === null) throw new TypeError(MSG_EMPTY_LOAD_METHOD)
        const { getKey } = this.options
        const key = getKey ? getKey(data) : data
        if (key === undefined || key === null) throw new TypeError(MSG_BAD_GET_KEY_FN)

        if (this[PROP_CACHE].has(key))
            return Promise.resolve().then(() => this[PROP_CACHE].get(key).result)
        if (this[PROP_BATCH].has(key)) return this[PROP_BATCH].get(key).promise
        if (this[PROP_WAIT_BATCH].has(key)) return this[PROP_WAIT_BATCH].get(key).promise

        const promise = new DeferPromise()

        this[PROP_BATCH].set(key, {
            data,
            promise,
        })

        this.testRun()

        return promise
    }

    loadMany(arr) {
        return Promise.all(arr.map(data => this.load(data)))
    }

    clear(key) {
        this[PROP_CACHE].delete(key)
        this[PROP_BATCH].delete(key)
    }

    clearAll() {
        this[PROP_CACHE].clear(key)
        this[PROP_BATCH].clear(key)
    }

    resolve(key, result) {
        return promiseFns(this, 'resolve', keyData, result)
    }

    reject(key, error) {
        return promiseFns(this, 'reject', keyData, error)
    }
}

module.exports = BatchLoader
