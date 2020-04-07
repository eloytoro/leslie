import Job from './internal/Job';
import { defer } from './internal/utils';

export const immediate = (input) => {
  const seq = new Job(input);
  return seq.promise;
}

export const latest = (genFn) => {
  let deferred = defer();
  let fg;
  return function (...args) {
    if (fg) {
      fg.cancel();
    }
    fg = new Job(genFn.call(this, ...args));
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

export const every = (genFn) => {
  return function (...args) {
    return immediate(genFn.call(this, ...args));
  }
}

export const channel = (genFn) => {
  const queue = [];
  return function (...args) {
    const ctx = this;
    const before = queue.slice();
    const seq = new Job(function* () {
      yield Promise.all(before);
      return yield genFn.call(ctx, ...args);
    });
    queue.push(seq.promise);
    return seq.promise;
  }
}
