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
---

### Deduplicator

`Deduplicator` is a module designed to prevent duplicate execution of identical requests. If two or more requests share the same key, they are grouped and executed as a single request. All subsequent requests receive results from the already-running request.

---

#### Key Features
- **Request Deduplication**: Groups requests with the same key to avoid redundant executions.
- **Execution Timeouts**: Supports task timeouts (`timeoutMs`).
- **Task Cancellation Management**: Uses `AbortSignal` for safe task termination.
- **Flexible Timer Control**: Option `unrefTimeouts` allows timers to avoid blocking the event loop.

---

#### Configuration Options
```typescript
interface IDeduplicatorOptions<T> {
  getKey: (query: T) => Key            // Function to extract the key from a query
  timeoutMs: number                   // Task execution timeout
  unrefTimeouts?: boolean             // Allows timers to avoid blocking the event loop
}
```

---

#### Usage Examples

##### Basic Usage
```typescript
import { Deduplicator } from '@nerjs/batchloader'

const deduplicator = new Deduplicator<number, number>(
  async (query: number, signal: AbortSignal) => {
    if (signal.aborted) throw new Error('Aborted')
    return query * 2
  },
  {
    getKey: query => query,
    timeoutMs: 500,
  }
)

const result = await deduplicator.call(5)
console.log(result) // 10
```

---

##### Request Deduplication
```typescript
const results = await Promise.all([
  deduplicator.call(1),
  deduplicator.call(1), // Joins the first request
  deduplicator.call(2)
])

console.log(results) // [2, 2, 4]
```

---

##### Handling Timeouts
```typescript
const deduplicator = new Deduplicator<number, number>(
  async () => {
    await new Promise(res => setTimeout(res, 1000))
    return 42
  },
  {
    getKey: query => query,
    timeoutMs: 500, // Specified timeout
  }
)

await deduplicator.call(1).catch(err => console.error(err.message)) // TimeoutError
```

---

#### Methods

##### `call(query: T): Promise<R>`
Adds a query to the execution queue or joins an already running request with the same key. Returns a promise with the result of the task execution.

---

##### `clear()`
Cancels all active tasks and clears their state.
```typescript
deduplicator.clear()
```

---

#### Error Handling

 - `TimeoutError` Thrown if the task execution exceeds the specified time limit (`timeoutMs`).
 - `RejectedAbortError` Thrown if the request is forcefully aborted during execution.
 - `SilentAbortError` Thrown if the task is canceled during clearing (`clear()`).

---
---

### utils

---
---


### BatchAggregator


`BatchAggregator` is a utility for grouping multiple requests into batches and processing them in bulk. It optimizes task execution by managing batch size, execution timing, and concurrency limits.

---

#### Key Features

- **Request Grouping**: Groups requests into batches based on size or timeout.
- **Concurrency Control**: Limits the number of tasks that can run in parallel (`concurrencyLimit`).
- **Timeout Handling**: Supports execution timeouts (`batchTimeout`) and waiting timeouts (`maxWaitingTimeMs`).

---

#### Configuration Options

```typescript
interface IBatchAggregatorOptions {
  concurrencyLimit?: number;     // Maximum number of parallel tasks (default: unlimited)
  maxBatchSize: number;          // Maximum number of requests per batch
  batchTimeMs: number;           // Maximum time to form a batch
  maxWaitingTimeMs?: number;     // Maximum waiting time for tasks in the queue (only if concurrencyLimit > 0)
  batchTimeout?: number;         // Maximum execution time for batchFn (the function passed as the first argument)
}
```

---

#### Usage Examples:

#### Basic Example

```typescript
import { BatchAggregator } from '@nerjs/batchloader'

const aggregator = new BatchAggregator<number, number>(
  async (batch, signal) => {
    if (signal.aborted) throw new Error('Aborted')
    return batch.map(item => item * 2) // Example: double each number
  },
  {
    maxBatchSize: 3,
    batchTimeMs: 100,
    batchTimeout: 500,
  }
)

const results = await Promise.all([
  aggregator.load(1),
  aggregator.load(2),
  aggregator.load(3),
])

console.log(results) // Output: [2, 4, 6]
```


#### Concurrency Limiting

```typescript
import { BatchAggregator } from '@nerjs/batchloader'

const aggregator = new BatchAggregator<number, number>(
  async (batch, signal) => {
    if (signal.aborted) throw new Error('Aborted')
    return batch.map(item => item * 2)
  },
  {
    maxBatchSize: 2,
    batchTimeMs: 100,
    batchTimeout: 500,
    concurrencyLimit: 2, // Limit to 2 parallel tasks
  }
)

const results = await Promise.all([
  aggregator.load(1),
  aggregator.load(2),
  aggregator.load(3),
  aggregator.load(4),
])

console.log(results) // Output: [2, 4, 6, 8]
```


#### Timeout Handling

```typescript
import { BatchAggregator } from '@nerjs/batchloader'

const aggregator = new BatchAggregator<number, number>(
  async (batch, signal) => {
    await new Promise(res => setTimeout(res, 200)) // Simulate delay
    return batch.map(item => item * 2)
  },
  {
    maxBatchSize: 1,
    batchTimeMs: 100,
    batchTimeout: 500,
    concurrencyLimit: 1,
    maxWaitingTimeMs: 100, // Timeout for tasks in the queue
  }
)

await Promise.all([
  aggregator.load(1), // Completes successfully
  aggregator.load(2).catch(err => console.error(err.message)), // Fails due to timeout
])
```

---

#### Methods

#### `load(request: T): Promise<R>`

Adds a request to the current batch. If the batch reaches its maximum size (`maxBatchSize`) or the timeout (`batchTimeMs`) expires, it is processed immediately. Returns a promise that resolves with the result of the request.


#### `clear()`

Clears all pending and waiting tasks. Useful for resource cleanup during shutdown or restart.

```typescript
aggregator.clear()
```


---
---

### Unlimited Timekeeper
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
---

### Limited Timekeeper

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

