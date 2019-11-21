# BatchLoader

utility for batch data processing. The [DataLoader](https://github.com/graphql/dataloader) is taken as an example.

Collects data over a specified time or within a specified amount

---

## install 
```
npm i @nerjs/batchloader
// or:
yarn add @nerjs/batchloader
```

## usage

```js
const BatchLoader = require('@nerjs/batchloader')
// or:
import BatchLoader from '@nerjs/batchloader'

const batchLoadFn = arr => {
    return arr.map(n => n * 2)
}

const loader = new BatchLoader(batchLoadFn)

loader.load(1).then(result => {
    console.log(result) // console: 2
})

```

## API 

api is maximally repeated from the [DataLoader API](https://github.com/graphql/dataloader#api) with small additions.

### class DataLoader(batchLoadFn, [, options])

* ***batchLoadFn***: A function which accepts an Array of keys, and returns a Promise which resolves to an Array of values.
* ***options***:
    | key | type | default |
    |:--|:--:|:--:|
    | maxSize   | Number   | 1000 | 
    | cacheTime | Number   | 10   | 
    | batchTime | Number   | 10   |
    | getKey    | Function | null |

### loader.load(any)
### loader.loadMany(Array)
### loader.clear()
clear cache
### loader.clearMany()
### loader.resolve(keyData, result)
### loader.reject(keyData, Error)