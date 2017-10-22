# iterffect

Short for "iterable with effects" is a tool that allows you to define logic using the power of
iterables, promises and observables alike.

It solves the following common issues:

* I want to check if an asynchronous task should keep going given external events have occurred,
should I be checking for this constantly after every single call?
* I want to be able to effortlessly stop asynchronous tasks from blocking other tasks.
* I want to keep track of what is happening in my app without necessarily storing data in a global
state.

## Use case

You're given the `Seq` class to instantiate sequences, these will be where you define business logic
using `generator` functions.

```js
function* main() {
  // this call returns a promise, the sequence will wait for it to finish
  const user = yield getUser()
  while (true) {
    const data = yield fetchData()
    yield delay(1000)
  }
}

const seq = new Seq(main())
```

In this example two things stand out:

* `while(true)`: Wouldn't this cause an infinite loop that can't be stopped? **No**, well at least
not necessarily, you can always _cancel_ sequences, preventing them from going forever, this is
something that you can't do using async/await.
* `delay(1000)`: This is an effect, the API provides a list of effects you can use to control the
flow of the application, this one will block the sequence for 1000 ms.

## API

### `new Seq(input: Sequenceable, ctx: object)`

Creates a new sequence from the given `input` and starts running it immediately. The `ctx` is an
object that can be accessed by the sequence and by all child sequences of itself as well.

* `Seq#promise: Promise`: a promise that resolves when the sequence (and all its children) finishes
succesfully (no errors emitted), it will resolve if the sequence is cancelled, but with no result
value.
* `Seq#done: Boolean`: false if the sequence is still running.
* `Seq#cancel()`: cancels the sequence (and all of its children).
* `Seq#resolve(result)`: resolves the sequence and waits for its children to finish
* `Seq#reject(err)`: rejects the sequence and cancels all of its children
* `Seq#spawn(input)`: creates a child sequence from the input
* `Seq#free()`: cancel all the child sequences

### `Seq.handler(listener: (value) => Sequenceable): Function`

Creates a handler function that will run a new sequence from the result of calling `gen` with the
given parameter. This sequence will be cancelled if the handler function is called again while its
still running, making it so there can only be one running sequence at once.

The handler function will return a Promise that resolves to the last emitted value of the underlying
sequences.

Example:

```js
const handleClick = Seq.handler(function* (event) {
  //...
})

document.addEventListener(btn, 'click', handleClick)
```

### `yield <expression>: Sequenceable`

Within sequences you can yield many kinds of sequenceable expressions, depending on the type of the
expression the sequence will handle it differently:

* Iterables: the sequence will start iterating over the given iterable.
* Promises: the sequence will wait for the promise to resolve or reject.
* Arrays: the sequence will handle every item of the array at the same time, useful for concurrency.

### `yield fork(input: Sequenceable): Seq`

Creates a new non-blocking sequence from the given input and appends it to the sequence that spawns
it. Useful when you need to keep track of child sequence execution.

### `yield race(...inputs: Sequenceable): Promise`

Creates a sequence for each different input and races them, the first one to finish will return and
cancels the rest.

### `yield delay(ms: number, [val]): Promise`

A promise that resolves after the given ms, if `val` is specified, it will resolve to that value.

### `yield observe(observable: observable, [listener]: (value) => Sequenceable): Seq`

Creates a sequence that subscribes to an observable object, observables must have the
`subscribe(onNext, onErr, onDone)`. Every time the observable emits a value a sequence will be
spawned with the value passed as a parameter, when the observable emits an error it will throw, and
when closes it will cancel the sequence.

If the listener param is omitted the sequence will resolve after the first value emitted

### `yield latest(observable: observable, listener: (value) => Sequenceable): Seq`

Same as `yield observable` but if the observable emits a value before the latest sequence started
by the previous value is still running, it will cancel it and start again with the new value.

### `yield cancel(seq: Seq)`

Cancels the given sequence, same as `seq.cancel()`.

### `yield forever()`

Hangs the sequence forever.

### `yield teardown(input: Sequenceable, handler: Function): Promise`

Allows you to define custom cancellation logic for your blocking calls. When your sequence is
cancelled the cancellation propagates to all of its children but this doesn't prevent external
logic from cancelling as well. This effect allows you to "subscribe" to the cancellation event and
fire up the `handler` when it happens, this is useful to tell external logic that the sequence is no
longer paying attention to its result and that it may stop what its doing.

Example:

```js
// `request` adds an `.abort` method to its returned promise
function* upload() {
  const result = yield teardown(
    // this value is "thenable" and blocks the sequence
    request(url, file),
    // will called if this sequence is cancelled at any time
    req => req.abort()
  )
  // if the sequence is cancelled at this point the `.abort` method
  // wont be called
  return result
}
```

### `effect(payloadCreator, handler): (...args) => effect`

Allows you to define your own effects

* `payloadCreator: (...args)`: A function that will transform `...args` passed to the effect into a
single payload, you should define your effect's function signature using this function.
* `handler: (sequence: Seq, payload: any)`: The handler function will be invoked when the effect is
yielded by a sequence, the `sequence` is the sequence yielding the effect and the `payload` is the
result of calling `payloadCreator` with the arguments passed to the effect when yielded. The handler
can return a promise as well.

Example:

```js
const race = effect(
  // payloadCreator: concats all parameters into an array
  (...inputs) => inputs,
  // handler: invoked with the result of the payloadCreator
  (seq, inputs) => {
  const children = inputs
    .map(item => new Seq(item, seq.ctx, seq))
  return Promise.race(children.map(child => child.promise))
    .then(result => {
      children.forEach(child => child.cancel())
      return result
    })
  }
)
```

## Experimental API

### `yield select(selector: ctx => ctx)`

Selects part or all of the context object, the `selector` function will be called with the current
context and return the result back to the sequence.

### `yield reduce(reducer: ctx => ctx)`

Calls the `reducer` function with the state, the result of that function will be `Object.assign`'d
to the current context, modifying it.

## Importing/requiring

```js
import { Seq, effect } from 'iterffect'
import { fork, race, delay } from 'iterffect/effects'
```

## Concepts

### Child sequences

Sequences can have child sequences, these will affect how your sequence behaves. They can be created
by effects such as `fork`, `race`, `observe` or `latest`.

The following rules apply:

* When a child sequence throws, so will the parent
* When a parent sequence cancels it will also cancel all of its children
* When a parent sequence finishes, it wont be resolved until all of its children finish as well.

### Error handling

Sequences can throw errors as well as handle them, for most use cases the handling of errors should
be exactly like async/await functions do. However if a child sequence throws an error to its parent
there's no try/catch to stop it, make sure to catch errors within the sequence, otherwise they would
just propagate indefinetly.

## Examples

### Concurrent sequences

Wait for an amount of sequences to complete

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

### Forking sequences

```js
function* pollNewsfeed() {
  while (true) {
    const news = yield getNewsfeed()
    // ...
    yield delay(1000)
  }
}

function* main() {
  // start non-blocking sequence
  const seq = yield fork(pollNewsfeed())
  yield delay(8000)
  // cancel the sequence after 8 seconds
  yield cancel(seq)
}
```

### Using observables

```js
function* onAction() {
  /**
   * will be called every time something is dispatched
   * to the redux state
   */
}

function* main() {
  // redux's store is observable
  const store = createStore()
  yield observe(store, onAction)
}
```
