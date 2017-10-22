import effect from './effect'

export const delay = (ms, val) => new Promise(resolve => setTimeout(() => resolve(val), ms))

export const forever = effect(
  () => {},
  (seq) => seq.promise
)

export const cancel = effect(
  (seq) => seq,
  (seq, child) => child.cancel()
)

export const reduce = effect(
  (reducer = ctx => ctx) => reducer,
  (seq, reducer) => {
    seq.ctx = Object.assign({}, seq.ctx, reducer(seq.ctx))
    return seq.ctx
  }
)

export const select = effect(
  (selector = state => state) => selector,
  (seq, selector) => selector(seq.ctx)
)

export const fork = effect(
  (iterable) => iterable,
  (seq, iterable) => seq.spawn(iterable)
)

export const race = effect(
  (...inputs) => inputs,
  (seq, inputs) => {
    const children = inputs
      .map(item => seq.spawn(item))
    return Promise.race(children.map(child => child.promise))
      .then(result => {
        children.forEach(child => child.cancel())
        return result
      })
  }
)

export const observe = effect(
  (observable, listener, opts = {}) => ({ observable, listener, opts }),
  (seq, { observable, listener, opts }) => {
    const fg = seq.spawn(forever())
    let child
    const onNext = value => {
      if (opts.latest && child) {
        child.cancel()
      }
      if (typeof listener === 'function') {
        child = fg.spawn(listener(value))
      } else {
        fg.resolve(value)
      }
    }
    const onError = err => fg.reject(err)
    const onDone = () => fg.cancel()
    const subscribe = typeof observable === 'function'
      ? observable
      : observable.subscribe
    fg.promise.finally(() => {
      if (typeof subscription === 'function') {
        subscription()
      } else {
        subscription.unsubscribe()
      }
    })
    const subscription = subscribe.call(observable, onNext, onError, onDone)
    return fg
  }
)

export const latest = (observable, listener) =>
  observe(observable, listener, { latest: true })

export const once = effect(
  (fn) => fn,
  (seq, fn) => {
    return seq.run(observe(fn)).then(child => child.promise)
  }
)

export const teardown = effect(
  (input, fn) => ({ input, fn }),
  (seq, { input, fn }) => {
    const unsub = seq.listen('cancel', () => fn(input))
    return seq.run(input).finally(unsub)
  }
)
