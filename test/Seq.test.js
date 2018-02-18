const { Seq } = require('../src')
const { delay, forever } = require('../src/effects')
const { expect } = require('chai')
const sinon = require('sinon')

describe('Seq', () => {
  it('returns the final value', async () => {
    function* greet() {
      return 'greetings'
    }
    const seq = new Seq(greet())
    const result = await seq.promise
    expect(result).to.equal('greetings')
  })

  it('resolves promises', async () => {
    function* greet() {
      return yield delay(10, 'greetings')
    }
    const seq = new Seq(greet())
    const result = await seq.promise
    expect(result).to.equal('greetings')
  })

  it('manages concurrency', async () => {
    let flag = false
    const done = sinon.spy()
    const assertFlag = sinon.spy(val => expect(flag).to.equal(val))
    const gen1 = sinon.spy(function* () {
      yield delay(10)
      assertFlag(false)
      flag = true
    })
    const gen2 = sinon.spy(function* () {
      yield delay(5)
      assertFlag(false)
      yield delay(10)
      assertFlag(true)
    })
    function* gen() {
      yield [
        gen1(),
        gen2()
      ]
      done()
    }
    const seq = new Seq(gen())
    await seq.promise
    expect(done).to.have.been.called
    expect(gen1).to.have.been.called
    expect(gen2).to.have.been.called
    expect(assertFlag).to.have.callCount(3)
  })

  it('resolves all primitive values', async () => {
    function* gen() {
      const num = yield 1
      const str = yield 'two'
      const bool = yield true
      const arr = yield [1, 'two', true]
      const obj = yield { foo: 'bar' }
      return [num, str, bool, arr, obj]
    }

    const seq = new Seq(gen())
    const [num, str, bool, arr, obj] = await seq.promise
    expect(num).to.equal(1)
    expect(str).to.equal('two')
    expect(bool).to.equal(true)
    expect(arr).to.eql([1, 'two', true])
    expect(obj).to.eql({ foo: 'bar' })
  })

  it('cancels', async () => {
    const step1 = sinon.spy()
    const step2 = sinon.spy()
    function* cancellable() {
      step1()
      yield delay(10)
      step2()
    }
    const seq = new Seq(cancellable())
    await delay(5)
    seq.cancel()
    await delay(10)
    expect(step1).to.have.been.called
    expect(step2).not.to.have.been.called
  })

  it('cancels child sequences', async () => {
    const done1 = sinon.spy()
    const done2 = sinon.spy()
    const done3 = sinon.spy()
    function* child1() {
      yield delay(10)
      done1()
    }
    function* child2() {
      yield delay(20)
      done2()
    }
    function* child3() {
      yield delay(30)
      done3()
    }
    function* gen() {
      yield [
        child1(),
        child2(),
        child3()
      ]
    }
    const seq = new Seq(gen())
    await delay(15)
    seq.cancel()
    await delay(20)
    expect(done1).to.have.been.called
    expect(done2).not.to.have.been.called
    expect(done3).not.to.have.been.called
  })

  it('cancels stops promise eagerly', async () => {
    let flag = false
    function* gen() {
      yield delay(100)
    }
    const seq = new Seq(gen())
    seq.promise.then(() => flag = true)
    expect(flag).to.equal(false)
    seq.cancel()
    await delay(0)
    expect(flag).to.equal(true)
  })

  it('throws errors', async () => {
    const err = new Error()
    function* gen() {
      throw err
    }
    const seq = new Seq(gen())
    await expect(seq.promise).eventually.to.be.rejectedWith(err)
  })

  it('handles errors', async () => {
    const err = new Error()
    const handle = sinon.spy()
    function* gen() {
      yield Promise.reject(err)
    }
    const seq = new Seq(gen())
    await expect(seq.promise).eventually.to.be.rejectedWith(err)
  })

  it('propagates errors', async () => {
    const err = new Error()
    function* delayErr() {
      yield delay(20)
      throw err
    }
    function* gen() {
      yield delayErr()
    }
    const seq = new Seq(gen())
    await expect(seq.promise).eventually.to.be.rejectedWith(err)
  })

  it('resolves a sequence with throwing children', async () => {
    const err = new Error()
    function* child() {
      yield delay(10)
      throw err
    }
    function* gen() {
      yield forever()
    }
    const seq = new Seq(gen())
    seq.spawn(child())
    await seq.resolve('result')
    await expect(seq.promise).to.be.rejectedWith(err)
  })

  describe('Seq#latest', () => {
    it('fires function on call', async () => {
      const spy = sinon.spy(res => res)
      const handler = Seq.latest(spy)
      const result = handler('hello')
      expect(spy).to.have.been.calledWith('hello')
      await expect(result).to.eventually.equal('hello')
    })

    it('cancels previous calls and returns last', async () => {
      const spy = sinon.spy()
      const handler = Seq.latest(function* (event) {
        yield delay(20)
        spy()
        return event
      })
      const one = handler('one')
      await delay(5)
      const two = handler('two')
      // one resolves to 'two' because its the last emitted value
      await expect(one).to.eventually.equal('two')
      await expect(two).to.eventually.equal('two')
      expect(spy).to.have.been.calledOnce
      const three = handler('three')
      await expect(three).to.eventually.equal('three')
    })
  })

  describe('Seq#channel', () => {
    it('fires function on call', async () => {
      const spy = sinon.spy(res => res)
      const handler = Seq.channel(spy)
      const result = handler('hello')
      await expect(result).to.eventually.equal('hello')
      expect(spy).to.have.been.calledWith('hello')
    })

    it('queues the task after the last one', async () => {
      const spy = sinon.spy()
      let count = 0
      const handler = Seq.channel(function* () {
        spy(count)
        yield delay(10)
        count = count + 1
      })
      handler()
      handler()
      await handler()
      expect(spy.args).to.deep.equal([[0], [1], [2]])
    })
  })

  describe('Seq#every', () => {
    it('fires function on call', async () => {
      const spy = sinon.spy(res => res)
      const handler = Seq.every(spy)
      const result = handler('hello')
      await expect(result).to.eventually.equal('hello')
      expect(spy).to.have.been.calledWith('hello')
    })

    it('creates a new seq for each call', async () => {
      const spy = sinon.spy()
      let count = 0
      const handler = Seq.every(function* () {
        count = count + 1
        yield delay(10)
        return count
      })
      await expect(Promise.all([
        handler(),
        handler(),
        handler()
      ])).to.eventually.deep.equal([3, 3, 3])
    })
  })
})
