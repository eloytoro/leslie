import Effect from './Effect'
import {
  defer,
  isIterable,
} from './utils'

export default class Job {
  constructor(input, opts) {
    this.status = 'pending';
    this.children = [];
    this.done = false;
    this.deferred = defer();
    this.opts = opts;
    this.handlers = {
      // Job: (job, cb) => this.next(job.promise, cb),
      Effect: (effect, cb) => this.next(effect.handler(this, effect.payload), cb),
      Iterable: (it, cb) => this.iterate(it, it.next(), cb),
      Array: (arr, cb) => {
        let results = [];
        let count = 0;
        arr.forEach((item, index) => this.next(item, (err, result) => {
          if (count === -1) return;
          if (err) {
            count = -1;
            cb(err);
          } else {
            results[index] = result;
            count += 1;
            if (count === arr.length) {
              cb(null, results);
            }
          }
        }));
      },
      Function: (fn, cb) => this.next(fn(), cb),
      Thenable: (thenable, cb) => thenable.then(results => cb(null, results), cb),
      Any: (val, cb) => cb(null, val)
    };
    this.listeners = {
      end: [],
      cancel: [],
    };
    this.replay = {};
    this.next(input, (err, result) => {
      if (err) {
        this.reject(err);
      } else {
        this.resolve(result);
      }
    });
  }

  get promise() {
    return this.deferred.promise;
  }
  get pending() {
    return this.status === 'pending';
  }
  get cancelled() {
    return this.status === 'cancelled';
  }
  get resolved() {
    return this.status === 'resolved';
  }
  get rejected() {
    return this.status === 'rejected';
  }

  getHandlerKey(input) {
    if (input === null || input === undefined) {
      return 'Any';
    // } else if (input instanceof Job) {
    //   return 'Job';
    } else if (input instanceof Effect) {
      return 'Effect';
    } else if (isIterable(input)) {
      return 'Iterable';
    } else if (Array.isArray(input)) {
      return 'Array'
    } else if (typeof input === 'function') {
      return 'Function'
    } else if (typeof input.then === 'function') {
      return 'Thenable'
    }
    return 'Any';
  }

  next(input, cb) {
    let key = this.getHandlerKey(input)
    this.handlers[key](input, cb);
  }

  iterate(iterable, step, cb) {
    if (step.done) {
      cb(null, step.value);
    } else {
      this.next(step.value, (err, result) => {
        if (!this.pending) {
          cb(err, result);
        } else {
          try {
            if (err) {
              this.iterate(iterable, iterable.throw(err), cb);
            } else {
              this.iterate(iterable, iterable.next(result), cb);
            }
          } catch (err) {
            cb(err);
          }
        }
      });
    }
  }

  free() {
    this.children.forEach(child => child.cancel());
  }

  spawn(iterable) {
    const child = new Job(iterable);
    this.children.push(child);
    child.listen('end', () => {
      if (!this.pending && !this.cancelled) {
        this.end();
      }
    });
    return child;
  }

  end() {
    if (this.children.filter(c => !c.done).length > 0) return;
    this.done = true;
    if (this.resolved) {
      this.deferred.resolve(this.result);
    } else if (this.rejected) {
      this.deferred.reject(this.error);
    }
    this.trigger('end');
  }

  cancel() {
    if (!this.pending) return;
    this.status = 'cancelled';
    this.free();
    this.trigger('cancel');
    this.end();
  }

  resolve(value) {
    if (!this.pending) return;
    this.status = 'resolved';
    this.result = value;
    this.end();
  }

  reject(err) {
    if (!this.pending) return;
    this.status = 'rejected';
    this.error = err;
    this.free();
    this.end();
  }

  trigger(event, ...args) {
    this.replay[event] = args;
    this.listeners[event].forEach(listener => listener(...args));
  }

  listen(event, listener) {
    if (typeof listener !== 'function') return;
    const listeners = this.listeners[event];
    if (!listeners) {
      throw new Error(`Job#listen(${event}) is not a valid event`);
    }
    if (this.replay[event]) {
      listener(...this.replay[event]);
    }
    listeners.push(listener);
    return () => listeners.splice(listeners.indexOf(listener), 1);
  }
}
