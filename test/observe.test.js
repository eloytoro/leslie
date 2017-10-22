const { Seq } = require('../src')
const { observe, delay } = require('../src/effects')
const { expect } = require('chai')
const sinon = require('sinon')

describe('observe', () => {
  it('observes an observable', async () => {
    let callback
    const handler = sinon.spy()

    const observable = {
      subscribe: (onNext) => {
        callback = onNext
        return {
          unsubscribe: () => {
            callback = null
          }
        }
      },
      trigger: (val) => {
        if (callback) {
          callback(val)
        }
      }
    }

    function* gen() {
      yield observe(observable, handler)
    }

    const seq = new Seq(gen())
    expect(handler).not.to.have.been.called
    await delay(10)
    observable.trigger('one')
    await delay(10)
    observable.trigger('two')
    seq.cancel()
    await delay(10)
    observable.trigger('three')
    expect(handler).to.have.callCount(2)
    expect(handler.args[0][0]).to.equal('one')
    expect(handler.args[1][0]).to.equal('two')
  })
})
