import './internal/polyfill.js'
import Effect from './internal/Effect'
import {
  defer,
  isIterable,
} from './internal/utils'
import { forever } from './effects'

class Seq {
  static handler(sequenceableFn) {
    const fg = new Seq(forever())
    let deferred = defer()
    const fn = (event) => {
      fg.free()
      const child = fg.spawn(sequenceableFn(event))
      child.listen('done', (err, result) => {
        if (err) {
          deferred.reject(err)
        } else {
          deferred.resolve(result)
        }
        deferred = defer()
      })
      return deferred.promise
    }
    fn.cancel = () => fg.cancel()
    return fn
  }

  constructor(input, ctx) {
    this.done = false
    this.children = []
    this.ctx = ctx
    this.deferred = defer()
    this.promise = this.deferred.promise
    this.listeners = {
      cancel: [],
      done: [],
    }
    this.run(input)
      .then(
        (result) => this.resolve(result),
        (err) => this.reject(err)
      )
  }

  run(input) {
    try {
      return Promise.resolve(this.next(input))
    } catch (err) {
      return Promise.reject(err)
    }
  }

  next(input) {
    if (input === null) {
      return input
    } else if (input instanceof Seq) {
      return input.promise
    } else if (input instanceof Effect) {
      return input.handler(this, input.payload)
    } else if (isIterable(input)) {
      return this.iterate(input)
    } else if (Array.isArray(input)) {
      return Promise.all(input.map(item => this.next(item)))
    } else if (typeof input === 'function') {
      return this.next(input(this.ctx))
    }
    return input
  }

  iterate(iterable, step = iterable.next()) {
    return this.run(step.value)
      .then(result => {
        if (step.done || this.done) return result
        return this.iterate(iterable, iterable.next(result))
      })
      .catch(err => {
        if (step.done || this.done) throw err
        return this.iterate(iterable, iterable.throw(err))
      })
  }

  free() {
    this.children.forEach(child => child.cancel())
  }

  resolve(value) {
    if (this.done) return
    return Promise.all(this.children.map(child => child.promise))
      .then(results => {
        this.done = true
        const result = value === undefined && results.length > 0
          ? results
          : value
        this.deferred.resolve(result)
        this.trigger('done', null, result)
        return result
      })
      .catch(err => {
        return this.reject(err)
      })
  }

  reject(err) {
    if (this.done) return
    this.done = true
    this.free()
    this.deferred.reject(err)
    this.trigger('done', err)
  }

  spawn(input) {
    const child = new Seq(input, this.ctx)
    this.children.push(child)
    child.promise
      .catch(err => this.reject(err))
      .finally(() =>
        this.children.splice(this.children.indexOf(child), 1)
      )
    return child
  }

  cancel() {
    if (this.done) return
    this.done = true
    this.free()
    this.trigger('cancel')
    this.deferred.resolve()
  }

  trigger(event, ...args) {
    this.listeners[event].forEach(listener => listener(...args))
  }

  listen(event, listener) {
    if (typeof listener !== 'function') return
    const listeners = this.listeners[event]
    if (!listeners) {
      throw new Error(`Seq#listen(${event}) is not a valid event`)
    }
    listeners.push(listener)
    return () => listeners.splice(listeners.indexOf(listener), 1)
  }
}

export default Seq
