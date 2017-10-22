const { Seq } = require('../src')
const { delay, race } = require('../src/effects')
const { expect } = require('chai')
const sinon = require('sinon')

describe('race', () => {
  it('races two sequences', async () => {
    const done1 = sinon.spy()
    const done2 = sinon.spy()
    function* child1() {
      yield delay(10)
      done1()
      return 'one'
    }
    function* child2() {
      yield delay(20)
      done2()
      return 'two'
    }
    function* gen() {
      return yield race(
        child1(),
        child2()
      )
    }
    const seq = new Seq(gen())
    const result = await seq.promise
    expect(done1).to.have.been.called
    expect(done2).not.to.have.been.called
    expect(result).to.equal('one')
  })

  it('cancel affects raced sequences', async () => {
    const done = sinon.spy()
    function* child() {
      yield delay(20)
      done()
    }
    function* gen() {
      return yield race(
        child()
      )
    }
    const seq = new Seq(gen())
    await delay(5)
    seq.cancel()
    await seq.promise
    expect(done).not.to.have.been.called
  })
})
