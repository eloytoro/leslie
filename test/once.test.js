const { Seq } = require('../src')
const { once, delay } = require('../src/effects')
const { expect } = require('chai')
const sinon = require('sinon')

describe('once', () => {
  it('listener defaults to single call', async () => {
    let callback
    const unsubscribe = sinon.spy(() => callback = null)
    const listen = sinon.spy(cb => {
      callback = cb
      return unsubscribe
    })
    function* gen() {
      const one = yield once(listen)
      const two = yield once(listen)
      return [one, two]
    }
    const seq = new Seq(gen())
    await delay(0)
    expect(seq.done).to.equal(false)
    expect(listen).to.have.been.calledOnce
    expect(unsubscribe).to.not.have.been.called
    callback('one')
    await delay(0)
    expect(listen).to.have.been.calledTwice
    expect(unsubscribe).to.have.been.calledOnce
    callback('two')
    await expect(seq.promise).eventually.to.deep.equal(['one', 'two'])
    expect(unsubscribe).to.have.been.calledTwice
  })
})
