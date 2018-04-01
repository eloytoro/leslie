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

export const fork = effect(
  (iterable) => iterable,
  (seq, iterable) => {
    const child = seq.spawn(iterable);
    child.promise.catch(err => seq.reject(err));
    return child;
  }
)

export const race = effect(
  (...inputs) => inputs,
  (seq, inputs) => {
    const children = inputs.map(input => seq.spawn(input));
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
  (seq, { input, fn }) => {
    const unsub = seq.listen('cancel', () => fn(input));
    return seq.next(input).then(result => {
      unsub();
      return result;
    });
  }
)
