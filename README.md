
`BatchLoader` is a tool for batching data requests with support for deduplication, caching, and parallel task management. It is designed to enhance flexibility and performance in scenarios requiring asynchronous data processing. This module was inspired by [Facebook's Dataloader](https://github.com/graphql/dataloader).

## Key Features
- **Batching Requests:** Combines multiple requests into batches, minimizing the number of calls.
- **Parallel Task Limitation:** Controls the number of concurrent tasks using the `concurrencyLimit` parameter.
- **Request Deduplication:** Eliminates duplicate requests with the same keys, redirecting them to already running tasks.
- **Flexible Caching:** Supports adapters for external storage like Redis and provides cache invalidation management.
- **Timeout Control:** Manages execution time for individual tasks and batches.
- **Delay Before Batch Execution:** Allows small delays to improve efficiency in asynchronous workflows.

## Problems Addressed by This Module

1. **Coupling Deduplication and Caching:**
   - In the original `Dataloader`, deduplication is tightly coupled with caching. Disabling caching also disables deduplication.
   - In `BatchLoader`, deduplication and caching are separate, allowing caching to be disabled without losing deduplication.

2. **Inconvenient Cache Management:**
   - In `Dataloader`, all cached data must be manually cleared, which is difficult to coordinate in distributed systems (e.g., PM2, Docker Swarm, or Kubernetes).
   - `BatchLoader` supports cache adapters and provides methods for clearing or resetting the cache, making it easier to manage in distributed systems.

3. **Synchronous Batch Formation:**
   - In `Dataloader`, batches are formed synchronously within a single event loop. While it allows custom scheduling with `batchScheduleFn`, this approach is complex and redundant.
   - `BatchLoader` supports configurable delays (`batchTimeMs`) before batch execution, enabling more efficient handling of asynchronous requests arriving at slightly different times.


---
---


# Main modules:

## BatchLoader

`BatchLoader` is a tool for grouping requests into batches and processing them efficiently with support for deduplication and caching.

---

### Key Features
- **Batching requests:** Processes multiple requests simultaneously, reducing the number of calls.
- **Parallel task limits:** Controls the number of concurrent tasks using the `concurrencyLimit` parameter.
- **Request deduplication:** Prevents duplicate requests with the same keys, redirecting them to existing tasks.
- **Caching:** Stores results in a cache for reuse.
- **Timeouts:** Manages execution time for requests and batches.

---

### Configuration Options
```typescript
interface IBatchLoaderOptions<K, R> {
  getKey?: (query: K) => Key           // Function to generate a request key (default: query => `${query}`)
  cache?: ICache<R>                   // Cache adapter (default: StubCache)
  timeoutMs?: number                  // Task execution timeout (default: 60,000 ms)
  unrefTimeouts?: boolean             // Allows timers to free the event loop (default: false)
  concurrencyLimit?: number           // Maximum number of parallel tasks (default: Infinity)
  maxBatchSize?: number               // Maximum number of requests per batch (default: 1000)
  batchTimeMs?: number                // Maximum time to form a batch (default: 50 ms)
  maxWaitingTimeMs?: number           // Maximum queue waiting time (only if concurrencyLimit > 0) (default: 60,000 ms)
}
```

---

### Example Usage
```typescript
import { BatchLoader } from '@nerjs/batchloader'

const loader = new BatchLoader(
  async (queries: number[]) => queries.map(q => q * 2),
  {
    timeoutMs: 100,
    maxBatchSize: 3,
    batchTimeMs: 50,
  }
)

const result = await loader.load(5)
console.log(result) // 10
```

---

### Cache Examples
#### Using Cache
```typescript
const loader = new BatchLoader(
  async (queries: number[]) => queries.map(q => q * 2),
  {
    cache: new MapCache<number>(),
    timeoutMs: 100,
  }
)

const result = await loader.load(5)
console.log(result) // 10
```

#### Clearing Cache
```typescript
await loader.resetCache(5) // Removes the result for the specified query
await loader.flush() // Clears the entire cache
```

---

### Methods

#### `load(query: K): Promise<R>`
Adds a request to the current batch. If the batch reaches the maximum size (`maxBatchSize`) or the timeout (`batchTimeMs`) expires, it is processed immediately. Returns a promise with the result of the request.

**Parameters:**
- **`query: K`** — The request added to the batch.

#### `resetCache(query: K): Promise<void>`
Clears the cache for the specified key.

#### `clear(): void`
Cancels all tasks and clears their state.

#### `flush(): Promise<void>`
Clears the entire cache.


---
---

## Deduplicator

`Deduplicator` is a module designed to prevent duplicate execution of identical requests. If two or more requests share the same key, they are grouped and executed as a single request. All subsequent requests receive results from the already-running request.

---

### Key Features
- **Request Deduplication**: Groups requests with the same key to avoid redundant executions.
- **Execution Timeouts**: Supports task timeouts (`timeoutMs`).
- **Task Cancellation Management**: Uses `AbortSignal` for safe task termination.
- **Flexible Timer Control**: Option `unrefTimeouts` allows timers to avoid blocking the event loop.

---

### Configuration Options
```typescript
interface IDeduplicatorOptions<T> {
  getKey: (query: T) => Key            // Function to extract the key from a query
  timeoutMs: number                   // Task execution timeout
  unrefTimeouts?: boolean             // Allows timers to avoid blocking the event loop
}
```

---

### Usage Examples

#### Basic Usage
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

#### Request Deduplication
```typescript
const results = await Promise.all([
  deduplicator.call(1),
  deduplicator.call(1), // Joins the first request
  deduplicator.call(2)
])

console.log(results) // [2, 2, 4]
```

---

#### Handling Timeouts
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

### Methods

#### `call(query: T): Promise<R>`
Adds a query to the execution queue or joins an already running request with the same key. Returns a promise with the result of the task execution.

---

#### `clear()`
Cancels all active tasks and clears their state.
```typescript
deduplicator.clear()
```

---

## Possible Errors

All errors inherit from the base class `LoaderError` and are designed to handle various situations that may arise during request execution.

### `TimeoutError`
Occurs when the specified execution time for a task or batch (`timeoutMs`) is exceeded. This error can be thrown by both the deduplicator and the batch aggregator.

### `SilentAbortError`
Occurs when a task is intentionally canceled, for example, during a call to the `clear()` method. It is used for safely terminating tasks without generating exceptions.

### `AbortError`, `RejectedAbortError`
Thrown when a task is manually aborted during execution, explicitly indicating the process termination.




---
---

# utils:


## BatchAggregator


`BatchAggregator` is a utility for grouping multiple requests into batches and processing them in bulk. It optimizes task execution by managing batch size, execution timing, and concurrency limits.

---

### Key Features

- **Request Grouping**: Groups requests into batches based on size or timeout.
- **Concurrency Control**: Limits the number of tasks that can run in parallel (`concurrencyLimit`).
- **Timeout Handling**: Supports execution timeouts (`batchTimeout`) and waiting timeouts (`maxWaitingTimeMs`).

---

### Configuration Options

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

### Usage Examples:

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

### Methods

#### `load(request: T): Promise<R>`

Adds a request to the current batch. If the batch reaches its maximum size (`maxBatchSize`) or the timeout (`batchTimeMs`) expires, it is processed immediately. Returns a promise that resolves with the result of the request.


#### `clear()`

Clears all pending and waiting tasks. Useful for resource cleanup during shutdown or restart.

```typescript
aggregator.clear()
```


---
---

## Unlimited Timekeeper


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

### Usage Example:

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

## Limited Timekeeper

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

