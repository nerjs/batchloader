// protected props
exports.PROP_BATCH_FN = Symbol('Batch load fn')
exports.PROP_OPTIONS = Symbol('options')
exports.PROP_CACHE = Symbol('cache')

// default options
exports.DEFAULT_SIZE = 100
exports.DEFAULT_TIME = 10
exports.DEFAULT_PARALLEL = false
exports.DEFAULT_GET_KEY = data => `${data}`

// error messages
exports.MSG_LOAD_FN =
    'BatchLoader must be constructed with a function which accepts Array<key> and returns Promise<Array<value>>'
