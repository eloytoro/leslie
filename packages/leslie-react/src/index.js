import { useEffect, useCallback, useRef } from 'react';
import { Job, defer } from 'leslie';

export const useLatestLazy = (genFn, watch = []) => {
  const deferred = useRef(defer());
  const fg = useRef();

  const creator = useCallback(function (...args) {
    if (fg.current) {
      fg.current.cancel();
    }
    fg.current = new Job(genFn.call(this, ...args));
    fg.current.promise
      .then(result => {
        deferred.current.resolve(result);
        deferred.current = defer();
      })
      .catch(err => {
        deferred.current.reject(err);
        deferred.current = defer();
      });
    return deferred.current.promise;
  }, []);

  useEffect(() => () => {
    if (fg.current) {
      fg.current.cancel();
    }
  }, watch);

  return creator;
}

export const useLatest = (genFn, watch) => {
  const creator = useLatestLazy(genFn, watch);
  useeffect(() => {
    creator();
  }, watch);
}

export const useChannelLazy = (genFn, watch = []) => {
  const queue = useRef([]);
  const creator = useCallback(function (...args) {
    const ctx = this;
    const before = queue.current.slice().map(job => job.promise);
    const job = new Job(function* () {
      yield Promise.all(before);
      return yield genFn.call(ctx, ...args);
    });
    queue.current.push(job);
    return job.promise;
  }, []);

  useEffect(() => () => {
    queue.current.forEach(job => job.cancel());
  }, watch);

  return creator;
}

export const useChannel = (genFn, watch) => {
  const creator = useChannelLazy(genFn, watch);
  useEffect(() => {
    creator();
  }, watch);
}

export const useEveryLazy = (genFn) => {
  const jobs = useRef([]);
  const creator = useCallback(function (...args) {
    const job = new Job(Promise.resolve(genFn.call(this, ...args)));
    jobs.current.push(job);
    return job;
  });
  useEffect(() => () => {
    jobs.current.forEach(job => job.cancel());
  });
  return creator;
}

export const useEvery = (genFn, watch) => {
  const creator = useEveryLazy(genFn);
  useEffect(() => {
    creator();
  }, watch);
}
