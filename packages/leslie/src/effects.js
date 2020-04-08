import Effect from './internal/Effect'

export const effect = (payloadCreator, handler) => (...args) => (
  new Effect(handler, payloadCreator(...args))
);

export const delay = (ms, val) => new Promise(resolve => setTimeout(() => resolve(val), ms))

export const forever = effect(
  () => {},
  (p) => p.promise
)

export const cancel = effect(
  (job) => job,
  (job, child) => child.cancel()
)

export const fork = effect(
  (iterable) => iterable,
  (job, iterable) => {
    const child = job.spawn(iterable);
    child.promise.catch(err => job.reject(err));
    return child;
  }
)

export const race = effect(
  (...inputs) => inputs,
  (job, inputs) => {
    const children = inputs.map(input => job.spawn(input));
    return Promise.race(children.map(child => {
      return child.promise.then(result => {
        children.forEach(child => child.cancel());
        return result;
      });
    }));
  }
)

export const teardown = effect(
  (input, fn) => ({ input, fn }),
  (job, { input, fn }) => {
    const unsub = job.listen('cancel', () => fn(input));
    return new Promise((resolve, reject) => job.next(input, (err, result) => {
      unsub();
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    }));
  }
)
