import Effect from './internal/Effect'
import {
  defer,
  isIterable,
} from './internal/utils'

const enhancer = (iterable) => ({
  next: (value) => {
    return transaction(iterable.next, value);
  },
  throw: (err) => {
    return transaction(iterable.throw, err);
  }
});

class Seq {
  static latest(sequenceableFn) {
    let deferred = defer();
    let fg;
    return function (...args) {
      if (fg) {
        fg.cancel();
      }
      fg = new Seq(sequenceableFn.call(this, ...args));
      fg.promise
        .then(result => {
          deferred.resolve(result);
          deferred = defer();
        })
        .catch(err => {
          deferred.reject(err);
          deferred = defer();
        });
      return deferred.promise;
    }
  }

  static every(sequenceableFn) {
    return function (...args) {
      return Seq.immediate(sequenceableFn.call(this, ...args));
    }
  }

  static channel(sequenceableFn) {
    const queue = [];
    return function (...args) {
      const ctx = this;
      const before = queue.slice();
      const seq = new Seq(function* () {
        yield Promise.all(before);
        return yield sequenceableFn.call(ctx, ...args);
      });
      queue.push(seq.promise);
      return seq.promise;
    }
  }

  static immediate(input) {
    const seq = new Seq(input);
    return seq.promise;
  }

  constructor(input, enhancer) {
    this.status = 'running';
    this.children = [];
    this.deferred = defer();
    this.listeners = {
      end: [],
      cancel: [],
    };
    Promise.resolve(this.next(input))
      .then(result => {
        this.resolve(result);
      })
      .catch(err => {
        this.reject(err);
      })
  }

  get promise() {
    return this.deferred.promise;
  }
  get running() {
    return this.status === 'running';
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

  async next(input) {
    if (input === null) {
      return input;
    } else if (input instanceof Seq) {
      console.log(input);
      return input.promise;
    } else if (input instanceof Effect) {
      return input.handler(this, input.payload);
    } else if (isIterable(input)) {
      return this.iterate(input);
    } else if (Array.isArray(input)) {
      return Promise.all(input.map(item => this.next(item)));
    } else if (typeof input === 'function') {
      return this.next(input());
    }
    return input;
  }

  async iterate(iterable, step = iterable.next()) {
    try {
      const result = await this.next(step.value);
      if (step.done || !this.running) return result;
      return this.iterate(iterable, iterable.next(result));
    } catch (err) {
      if (step.done || !this.running) throw err;
      return this.iterate(iterable, iterable.throw(err));
    }
  }

  free() {
    this.children.forEach(child => child.cancel());
  }

  spawn(input) {
    const child = new Seq(input);
    this.children.push(child);
    child.listen('end', () => {
      this.children.splice(this.children.indexOf(child), 1);
      if (!this.running && !this.cancelled) {
        this.end();
      }
    });
    return child;
  }

  end() {
    if (this.children.length > 0) return;
    if (this.resolved) {
      this.deferred.resolve(this.result);
    } else if (this.rejected) {
      this.deferred.reject(this.error);
    }
    this.trigger('end');
  }

  cancel() {
    if (!this.running) return;
    this.status = 'cancelled';
    this.free();
    this.trigger('cancel');
    this.end();
  }

  resolve(value) {
    if (!this.running) return;
    this.status = 'resolved';
    this.result = value;
    this.end();
  }

  reject(err) {
    if (!this.running) return;
    this.status = 'rejected';
    this.error = err;
    this.free();
    this.end();
  }

  trigger(event, ...args) {
    this.listeners[event].forEach(listener => listener(...args));
  }

  listen(event, listener) {
    if (typeof listener !== 'function') return;
    const listeners = this.listeners[event];
    if (!listeners) {
      throw new Error(`Seq#listen(${event}) is not a valid event`);
    }
    listeners.push(listener);
    return () => listeners.splice(listeners.indexOf(listener), 1);
  }
}

export default Seq
