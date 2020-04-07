import { latest, channel, every } from './jobs';
import { delay } from './effects';

describe('latest', () => {
  it('fires function on call', async () => {
    const spy = jest.fn(res => res);
    const handler = latest(spy);
    const result = handler('hello');
    expect(spy).toHaveBeenCalledWith('hello');
    await expect(result).resolves.toBe('hello');
  });

  it('cancels previous calls and returns last', async () => {
    const spy = jest.fn();
    const handler = latest(function*(event) {
      yield delay(20);
      spy();
      return event;
    });
    const one = handler('one');
    await delay(5);
    const two = handler('two');
    // one resolves to 'two' because its the last emitted value
    await expect(one).resolves.toBe('two');
    await expect(two).resolves.toBe('two');
    expect(spy).toHaveBeenCalledTimes(1);
    const three = handler('three');
    await expect(three).resolves.toBe('three');
  });
});

describe('channel', () => {
  it('fires function on call', async () => {
    const spy = jest.fn(res => res);
    const handler = channel(spy);
    const result = handler('hello');
    await expect(result).resolves.toBe('hello');
    expect(spy).toHaveBeenCalledWith('hello');
  });

  it('queues the task after the last one', async () => {
    const spy = jest.fn();
    let count = 0;
    const handler = channel(function*() {
      spy(count);
      yield delay(10);
      count = count + 1;
    });
    handler();
    handler();
    await handler();
    expect(spy.mock.calls).toEqual([[0], [1], [2]]);
  });
});

describe('every', () => {
  it('fires function on call', async () => {
    const spy = jest.fn(res => res);
    const handler = every(spy);
    const result = handler('hello');
    await expect(result).resolves.toBe('hello');
    expect(spy).toHaveBeenCalledWith('hello');
  });

  it('creates a new Job for each call', async () => {
    const spy = jest.fn();
    let count = 0;
    const handler = every(function*() {
      count = count + 1;
      yield delay(10);
      return count;
    });
    await expect(
      Promise.all([handler(), handler(), handler()])
    ).resolves.toEqual([3, 3, 3]);
  });
});
