import Job from './internal/Job';
import { defer } from './internal/utils';
import { delay, fork, forever, race, teardown } from './effects';

describe('fork', () => {
  it('forks a job', async () => {
    let count = 0;
    const done = jest.fn();
    const stops = [defer(), defer(), defer(), defer()];
    function* child(d) {
      yield d.promise;
      count = count + 1;
      return count;
    }
    function* gen() {
      const resultArray = yield [fork(child(stops[0])), fork(child(stops[1])), child(stops[2])];
      const seq = yield fork(child(stops[3]));
      done(resultArray, seq);
    }
    const seq = new Job(gen());
    expect(done).not.toHaveBeenCalled();
    expect(seq.pending).toBe(true);
    await stops[2].resolve();
    expect(done).toHaveBeenCalled();
    expect(seq.pending).toBe(false);
    expect(count).toBe(1);
    await stops[0].resolve();
    await stops[1].resolve();
    await stops[3].resolve();
    const resultArray = done.mock.calls[0][0];
    expect(resultArray).toHaveLength(3);
    expect(resultArray[0]).toBeInstanceOf(Job);
    expect(resultArray[1]).toBeInstanceOf(Job);
    expect(resultArray[2]).toBe(1);
    expect(count).toBe(4);
  });

  it('waits for child job', async () => {
    const first = jest.fn();
    const done = jest.fn();
    const stop1 = defer();
    const stop2 = defer();
    function* child(p) {
      yield p;
      done();
    }
    function* gen() {
      yield [fork(child(stop1.promise)), fork(child(stop2.promise))];
      first();
    }
    const seq = new Job(gen());
    expect(first).toHaveBeenCalled();
    expect(seq.children.map(c => c.done)).toEqual([false, false]);
    expect(seq.done).toBe(false);
    stop1.resolve();
    stop2.resolve();
    expect(done).not.toHaveBeenCalled();
    await seq.promise;
    expect(seq.children.map(c => c.done)).toEqual([true, true]);
    expect(seq.done).toBe(true);
    expect(done).toHaveBeenCalledTimes(2);
  });

  it('cancels forks', async () => {
    const never = jest.fn();
    const stop1 = defer();
    function* child() {
      yield stop1.promise;
      never();
    }
    function* gen() {
      const seq = yield fork(child());
      seq.cancel();
    }
    const seq = new Job(gen());
    stop1.resolve();
    await seq.promise;
    expect(never).not.toHaveBeenCalled();
  });

  it('propagates error to parent', async () => {
    const err = new Error();
    const done = jest.fn();
    const kill = jest.fn(() => {
      throw err;
    });
    const stop1 = defer();
    function* child(p) {
      yield p;
      kill();
    }
    function* gen() {
      yield fork(child(stop1.promise));
      yield forever();
      done();
    }
    const seq = new Job(gen());
    stop1.resolve();
    await expect(seq.promise).rejects.toThrow(err);
    expect(done).not.toHaveBeenCalled();
    expect(kill).toHaveBeenCalled();
  });
});

describe('race', () => {
  it('races two sequences', async () => {
    const done1 = jest.fn();
    const done2 = jest.fn();
    const stop1 = defer();
    const stop2 = defer();
    function* child1() {
      yield stop1.promise;
      done1();
      return 'one';
    }
    function* child2() {
      yield stop2.promise;
      done2();
      return 'two';
    }
    function* gen() {
      return yield race(child1(), child2());
    }
    const seq = new Job(gen());
    stop1.resolve();
    const result = await seq.promise;
    expect(done1).toHaveBeenCalled();
    expect(done2).not.toHaveBeenCalled();
    expect(result).toBe('one');
  });

  it('cancel affects raced sequences', async () => {
    const done = jest.fn();
    function* child() {
      yield forever();
      done();
    }
    function* gen() {
      return yield race(child());
    }
    const seq = new Job(gen());
    await delay(0);
    seq.cancel();
    expect(done).not.toHaveBeenCalled();
  });
});

describe('teardown', () => {
  it('execs teardown logic', async () => {
    const handler = jest.fn();
    const never = jest.fn();
    function* gen() {
      yield teardown(forever(), handler);
      never();
    }
    const seq = new Job(gen());
    expect(handler).not.toHaveBeenCalled();
    seq.cancel();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(never).not.toHaveBeenCalled();
  });

  it('unsubscribes the handler when finished', async () => {
    const handler = jest.fn();
    let result;
    function* gen() {
      result = yield teardown('result', handler);
      yield forever();
    }
    const seq = new Job(gen());
    await delay(0);
    seq.cancel();
    expect(handler).not.toHaveBeenCalled();
    expect(result).toBe('result');
  });
});
