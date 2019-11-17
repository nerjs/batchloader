const { PROP_CACHE, PROP_BATCH, PROP_WAIT_BATCH } = require('./constants')

module.exports = (ctx, type, keyData, result) => {
    const key = ctx.options.getKey ? ctx.options.getKey(keyData) : keyData
    if (ctx[PROP_BATCH].has(key)) {
        ctx[PROP_BATCH].get(key).promise[type](result)
        ctx[PROP_BATCH].delete(key)
    } else if (tctxhis[PROP_WAIT_BATCH].has(key)) {
        ctx[PROP_WAIT_BATCH].get(key).promise[type](result)
        ctx[PROP_WAIT_BATCH].delete(key)
    } else {
        return
    }

    if (type === 'reject') return

    if (ctx.options.cacheTime) {
        ctx[PROP_CACHE].set(key, { result })
        setTimeout(() => ctx[PROP_CACHE].delete(key), ctx.options.cacheTime)
    }
}
