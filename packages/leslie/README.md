# leslie

A tool that allows you to define logic with the power of iterables, promises and observables alike using the syntax of javascript generators

It solves the following common issues:

* Orchestrate the execution of asynchronous processes as well as spawning and cancelling them.
* Define cancellable asynchronous logic
* Observe external events and define behaviors that don't collide with each other out of the box

## Example

```js
function* main() {
  // this call returns a promise, the job will wait for it to finish
  const user = yield getUser();
  while (true) {
    const data = yield fetchData();
    yield delay(1000);
  }
}

const job = immediate(main());
```

In this example two things stand out:

* `while(true)`: Wouldn't this cause an infinite loop that can't be stopped? not necessarily, you can always _cancel_ job, preventing them from going forever, this is
something that you can't do using async/await.
* `delay(1000)`: This is an effect, the API provides a list of effects you can use to control the flow of the application, this one will block the job for 1000 ms.

## API

### `latest(generatorFn): Function`

Creates a job factory that will trigger the generator function every time its called and return a promise that resolves to the return value of the job.
Its important to note `latest` only allows for one thread to run, and will cancel any ongoing executions every time its called again.

Example:

```js
// any subsequent call made to handle click will cancel the execution and start a new one
const handleClick = latest(function* (event) {
  yield delay(1000);
  alert('clicked');
})

// if a user clicks the button several times under a second only the latest one will register
document.addEventListener(btn, 'click', handleClick)
```

### `channel(generatorFn): Function`

Creates a job factory that will place the job at the end of the execution queue and will trigger once all previous calls are finished.
Its important to note `latest` only allows for one thread to run and all queued jobs will be blocked.

### `yield <expression>: Iterable|Promise|Array`

Within jobs you can yield many kinds of expressions, depending on the type of the expression the job will handle it differently:

* Iterables: the job will start iterating over the given iterable.
* Promises: the job will wait for the promise to resolve or reject.
* Arrays: the job will handle every item of the array at the same time, useful for concurrency.

### `yield fork(input: Iterable|Promise|Array): Job`

Creates a new non-blocking job from the given input and appends it to the job that spawns it. Useful when you need to keep track of child job execution.

### `yield race(...inputs: Iterable|Promise|Array): Promise`

Creates a job for each different input and races them, the first one to finish will return and
cancels the rest.

### `yield delay(ms: number, [val]): Promise`

A promise that resolves after the given ms, if `val` is specified, it will resolve to that value.

### `yield latest(observable: observable, listener: (value) => Iterable|Promise|Array): Job`

Same as `yield observable` but if the observable emits a value before the latest job started
by the previous value is still running, it will cancel it and start again with the new value.

### `yield cancel(job: Job)`

Cancels the given job, same as `job.cancel()`.

### `yield forever()`

Stops the job forever.

### `yield teardown(input: Iterable|Promise|Array, handler: Function): Promise`

Allows you to define custom cancellation logic for your blocking calls. When your job is cancelled the cancellation propagates to all of its children but this doesn't prevent external logic from cancelling as well. This effect allows you to "subscribe" to the cancellation event and fire up the `handler` when it happens, this is useful to tell external logic that the job is no longer paying attention to its result and that it may stop what its doing.

Example:

```js
// `request` adds an `.abort` method to its returned promise
function* upload() {
  const result = yield teardown(
    // this value is "thenable" and blocks the job
    request(url, file),
    // will called if this job is cancelled at any time
    req => req.abort()
  )
  // if the job is cancelled at this point the `.abort` method
  // wont be called
  return result
}
```

## Advanced API

### `class Job`

* `Job#promise: Promise`: a promise that resolves when the job (and all its children) finishes
succesfully (no errors emitted), it will resolve if the job is cancelled, but with no result
value.
* `Job#cancel()`: cancels the job (and all of its children).
* `Job#spawn(input)`: creates a child job from the input
* `Job#free()`: cancel all the children
* `Job#running: Boolean`: is the job still running.
* `Job#cancelled: Boolean`: was the job cancelled.
* `Job#resolved: Boolean`: was the job resolved.
* `Job#rejected: Boolean`: was the job rejected.

### `effect(payloadCreator, handler): (...args) => effect`

Allows you to define your own effects

* `payloadCreator: (...args)`: A function that will transform `...args` passed to the effect into a
single payload, you should define your effect's function signature using this function.
* `handler: (job: Job, payload: any)`: The handler function will be invoked when the effect is
yielded by a job, the `job` is the one yielding the effect and the `payload` is the
result of calling `payloadCreator` with the arguments passed to the effect when yielded. The handler
can return a promise as well.

Example:

```js
const race = effect(
  // payloadCreator: concats all parameters into an array
  (...inputs) => inputs,
  // handler: invoked with the result of the payloadCreator
  (job, inputs) => {
  const children = inputs
    .map(item => new Job(item))
  return Promise.race(children.map(child => child.promise))
    .then(result => {
      children.forEach(child => child.cancel())
      return result
    })
  }
)
```

## Concepts

### Child job

Jobs can have children, these will affect how your job behaves. They can be created by effects such as `fork`, `race` or `latest`.

The following rules apply:

* When a child job throws, so will the parent.
* When a parent job cancels it will also cancel all of its children.
* When a parent job finishes, it wont be resolved until all of its children finish as well.
* Cancelling a job means it will never resolve or reject.

### Error handling

Jobs can throw errors as well as handle them, for most use cases the handling of errors should be exactly like async/await functions do. However if a child job throws an error to its parent there's no try/catch to stop it, make sure to catch errors within the job, otherwise they would just propagate indefinetly.

## Examples

### Concurrent jobs

Wait for an amount of job to complete

```js
function* main() {
  try {
    // resolves when the 3 are done
    const [user, news, notifications] = yield [
      getUser(),
      getNewsfeed(),
      getNotifications()
    ]
  } catch (err) {
    // if any of the 3 above emit an error will be handled here
  }
}
```

### Forking jobs

```js
function* pollNewsfeed() {
  while (true) {
    const news = yield getNewsfeed()
    // ...
    yield delay(1000)
  }
}

function* main() {
  // start non-blocking job
  const job = yield fork(pollNewsfeed())
  yield delay(8000)
  // cancel the job after 8 seconds
  yield cancel(job)
}
```
