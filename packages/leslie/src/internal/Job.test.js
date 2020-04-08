import Job from './Job';
import { delay, immediate } from '..';

describe('Job', () => {
  it('returns the final value', async () => {
    function* greet() {
      return 'greetings';
    }
    const result = await immediate(greet());
    expect(result).toBe('greetings');
  });

  it('manages concurrency', async () => {
    let flag = false;
    const done = jest.fn();
    const assertFlag = jest.fn(val => expect(flag).toBe(val));
    const gen1 = jest.fn(function*() {
      yield delay(10);
      assertFlag(false);
      flag = true;
    });
    const gen2 = jest.fn(function*() {
      yield delay(5);
      assertFlag(false);
      yield delay(10);
      assertFlag(true);
    });
    function* gen() {
      yield [gen1(), gen2()];
      done();
    }
    await immediate(gen());
    expect(done).toHaveBeenCalled();
    expect(gen1).toHaveBeenCalled();
    expect(gen2).toHaveBeenCalled();
    expect(assertFlag).toHaveBeenCalledTimes(3);
  });

  it('resolves all primitive values', async () => {
    function* gen() {
      const num = yield 1;
      const str = yield 'two';
      const bool = yield true;
      const arr = yield [1, 'two', true];
      const obj = yield { foo: 'bar' };
      return [num, str, bool, arr, obj];
    }

    const [num, str, bool, arr, obj] = await immediate(gen());
    expect(num).toBe(1);
    expect(str).toBe('two');
    expect(bool).toBe(true);
    expect(arr).toEqual([1, 'two', true]);
    expect(obj).toEqual({ foo: 'bar' });
  });

  it('cancels', async () => {
    const step1 = jest.fn();
    const step2 = jest.fn();
    function* cancellable() {
      step1();
      yield delay(10);
      step2();
    }
    const seq = new Job(cancellable());
    await delay(5);
    seq.cancel();
    await delay(10);
    expect(step1).toHaveBeenCalled();
    expect(step2).not.toHaveBeenCalled();
  });

  it('cancels child sequences', async () => {
    const done1 = jest.fn();
    const done2 = jest.fn();
    const done3 = jest.fn();
    function* child1() {
      yield delay(10);
      done1();
    }
    function* child2() {
      yield delay(20);
      done2();
    }
    function* child3() {
      yield delay(30);
      done3();
    }
    function* gen() {
      yield [child1(), child2(), child3()];
    }
    const seq = new Job(gen());
    await delay(15);
    seq.cancel();
    await delay(20);
    expect(done1).toHaveBeenCalled();
    expect(done2).not.toHaveBeenCalled();
    expect(done3).not.toHaveBeenCalled();
  });

  it("cancel doesn't resolve or reject the seq", async () => {
    let flag = false;
    function* gen() {
      yield delay(100);
    }
    const seq = new Job(gen());
    seq.promise.then(() => (flag = true)).catch(() => (flag = true));
    expect(flag).toBe(false);
    seq.cancel();
    await delay(0);
    expect(flag).toBe(false);
  });

  it('throws errors', async () => {
    const err = new Error();
    function* gen() {
      throw err;
    }
    await expect(immediate(gen())).rejects.toThrow(err);
  });

  it('handles errors', async () => {
    const err = new Error();
    function* gen() {
      yield Promise.reject(err);
    }
    await expect(immediate(gen())).rejects.toThrow(err);
  });

  it('propagates errors', async () => {
    const err = new Error();
    function* delayErr() {
      yield delay(20);
      throw err;
    }
    function* gen() {
      yield delayErr();
    }
    await expect(immediate(gen())).rejects.toThrow(err);
  });
});
