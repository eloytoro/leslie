import Job from '../src/internal/Job';
import { delay, fork, forever, race, teardown } from '../src';

describe('fork', () => {
  it('forks a job', async () => {
    let count = 0;
    const done = jest.fn();
    function* child(ms) {
      yield delay(ms);
      count = count + 1;
      return count;
    }
    function* gen() {
      const resultArray = yield [fork(child(15)), fork(child(15)), child(0)];
      const seq = yield fork(child(15));
      done(resultArray, seq);
    }
    const seq = new Job(gen());
    expect(done).not.toHaveBeenCalled();
    expect(seq.running).toBe(true);
    await delay(5);
    expect(done).toHaveBeenCalled();
    expect(seq.running).toBe(false);
    await delay(20);
    const resultArray = done.mock.calls[0][0];
    expect(resultArray).toHaveLength(3);
    expect(resultArray[0]).toBeInstanceOf(Job);
    expect(resultArray[1]).toBeInstanceOf(Job);
    expect(resultArray[2]).toBe(1);
    expect(count).toBe(4);
  });

  it('waits for child job', async () => {
    const now = Date.now();
    function* child(ms) {
      yield delay(ms);
    }
    function* gen() {
      yield [fork(child(20)), fork(child(10))];
    }
    const seq = new Job(gen());
    await seq.promise;
    expect(Date.now() - now).toBeGreaterThan(10);
  });

  it('cancels forks', async () => {
    const now = Date.now();
    function* child() {
      yield forever();
    }
    function* gen() {
      const seq = yield fork(child());
      yield delay(10);
      seq.cancel();
    }
    const seq = new Job(gen());
    await seq.promise;
    expect(Date.now() - now).toBeLessThan(20);
  });

  it('propagates error to parent', async () => {
    const err = new Error();
    const done = jest.fn();
    const kill = jest.fn(() => {
      throw err;
    });
    function* child(ms) {
      yield delay(ms);
      kill();
    }
    function* gen() {
      const seq = yield fork(child(20));
      yield delay(30);
      done();
    }
    const seq = new Job(gen());
    await expect(seq.promise).rejects.toThrow(err);
    expect(done).not.toHaveBeenCalled();
    expect(kill).toHaveBeenCalled();
  });
});

describe('race', () => {
  it('races two sequences', async () => {
    const done1 = jest.fn();
    const done2 = jest.fn();
    function* child1() {
      yield delay(10);
      done1();
      return 'one';
    }
    function* child2() {
      yield delay(20);
      done2();
      return 'two';
    }
    function* gen() {
      return yield race(child1(), child2());
    }
    const seq = new Job(gen());
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
    await delay(5);
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
    await delay(5);
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
    await delay(5);
    seq.cancel();
    expect(handler).not.toHaveBeenCalled();
    expect(result).toBe('result');
  });
});
