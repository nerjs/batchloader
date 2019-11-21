// protected props
exports.PROP_BATCH_FN = Symbol('Batch load fn')
exports.PROP_OPTIONS = Symbol('options')
exports.PROP_CACHE = Symbol('cache')
exports.PROP_BATCH = Symbol('batch')
exports.PROP_WAIT_BATCH = Symbol('wait batch')

// default options
exports.DEFAULT_SIZE = 1000
exports.DEFAULT_BATCH_TIME = 10
exports.DEFAULT_CACHE_TIME = 10
exports.DEFAULT_PARALLEL = false
exports.DEFAULT_GET_KEY = null

// error messages
exports.MSG_BAD_BATCHLOAD_FN =
    'BatchLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>'
exports.MSG_EMPTY_LOAD_METHOD = 'The loader.load() function must be called with a value'
exports.MSG_LOAD_MANY_METHOD = 'The loader.loadMany() function must be called with Array<key> '
exports.MSG_BAD_GET_KEY_FN = 'The option.getKey() function must be return value'
exports.MSG_BAD_RESULT = `The result of batchloadFn should return an Promise<Array> corresponding to the passed one. 
    Or another result (Promise<any>) that will be returned in each promise.
    Not null or undefined.`
