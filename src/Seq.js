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
    const fn = function (event) {
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
    this.next(input)
      .then(
        (result) => this.resolve(result),
        (err) => this.reject(err)
      )
  }

  async next(input) {
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

  async iterate(iterable) {
    let prev
    let error
    let step = iterable.next()
    while (true) {
      try {
        prev = await this.next(step.value)
        error = null
      } catch (err) {
        error = err
      }
      if (step.done || this.done) return prev
      if (error) {
        step = iterable.throw(error)
      } else {
        step = iterable.next(prev)
      }
    }
  }

  free() {
    this.children.forEach(child => child.cancel())
  }

  async resolve(value) {
    if (this.done) return
    try {
      const results = await Promise.all(this.children.map(child => child.promise))
      this.done = true
      const result = value === undefined && results.length > 0
        ? results
        : value
      this.deferred.resolve(result)
      this.trigger('done', null, result)
    } catch (err) {
      this.reject(err)
    }
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
