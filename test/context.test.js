const { Seq } = require('../src')
const { select, reduce } = require('../src/effects')
const { expect } = require('chai')
const sinon = require('sinon')

describe('context', () => {
  it('selects the context', async () => {
    function* gen() {
      return yield select()
    }
    const ctx = {}
    const seq = new Seq(gen(), ctx)
    const result = await seq.promise
    expect(result).to.equal(ctx)
  })

  it('reduces the context', async () => {
    function* gen() {
      yield reduce(ctx => ({ msg: 'hi' }))
      return yield select()
    }
    const ctx = { name: 'eloy' }
    const seq = new Seq(gen(), ctx)
    const result = await seq.promise
    expect(result).not.to.equal(ctx)
    expect(result.msg).to.equal('hi')
    expect(result.name).to.equal('eloy')
  })

  it('passes context to children', async () => {
    function* child1() {
      return yield select(ctx => ctx.msg)
    }
    function* child2() {
      return yield select(ctx => ctx.name)
    }
    function* child3() {
      return yield select(ctx => ctx.last)
    }
    function* gen() {
      const greetings = yield child1()
      const [name, last] = yield [
        child2(),
        child3()
      ]
      return `${greetings}, ${name} ${last}`
    }
    const seq = new Seq(gen(), { msg: 'greetings', name: 'eloy', last: 'toro' })
    const result = await seq.promise
    expect(result).to.equal('greetings, eloy toro')
  })
})
