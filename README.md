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


---

### utils

#### Unlimited Timekeeper
A class for managing tasks without restrictions on parallel execution.


Key Features:

 - Supports tasks with various statuses: pending, runned, resolved, rejected.
 - Only one task can remain in the pending state at a time.
 - Manages automatic task execution based on a specified timeout (timeoutMs).
 - Handles errors during task execution.
 - Supports cancellation of tasks using AbortSignal.


How to interact with data:

 - Data is created using initialDataFactory.
 - You can modify task data fields:
    ```ts
    const task = timekeeper.current();
    task.data.field = 'other example';
    ```
> Direct assignment of new data is not allowed: `task.data = {}; // Error`

 - In the runner, you can access data via task.data.

---
Usage Example:

```typescript
import { UnlimitedTimekeeper } from '@nerjs/batchloader'

const timekeeper = new UnlimitedTimekeeper<{ field: string }>({
    initialDataFactory: () => ({ field: 'example' }),
    runMs: 100,
    timeoutMs: 1000,
    runner: async (task, signal) => {
    if (signal.aborted) throw new Error('Aborted');
    console.log(task.data.field); // Accessing data (log: "other")
    await someAsyncFunction();
    },
});

const task = timekeeper.current();
task.data.field = 'other'
timekeeper.run();
await timekeeper.wait(task);
```
---

#### Limited Timekeeper

A class for managing tasks with restrictions on parallel execution. Inherits functionality from UnlimitedTimekeeper.


Key Features:
 - Controls parallel execution using concurrencyLimit. Tasks exceeding the limit are placed in a waiting queue.
 - Manages tasks in the waiting queue (waiting).
 - Handles timeouts for tasks in the waiting state (maxWaitingTimeMs).
 - Supports cancellation of both active and waiting tasks.

---

Usage Example:
```typescript
import { LimitedTimekeeper } from '@nerjs/batchloader'

const timekeeper = new LimitedTimekeeper({
    initialDataFactory: () => ({ field: 'example' }),
    runMs: 100,
    timeoutMs: 1000,
    concurrencyLimit: 2,
    maxWaitingTimeMs: 500,
    runner: async (task, signal) => {
    if (signal.aborted) throw new Error('Aborted');
    console.log(task.data.field); // Accessing data
    await someAsyncFunction();
    },
});

const task = timekeeper.current();
timekeeper.run();
await timekeeper.wait(task);
```

