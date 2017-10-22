const { Seq } = require('../src')
const { fork, observe, race, delay, reduce, latest } = require('../src/effects')
const { observable } = require('mobx')
const { observer } = require('mobx-react/custom')
const enzyme = require('enzyme')
const React = require('react')
const { expect } = require('chai')
const sinon = require('sinon')

describe('real-world', () => {
  it('creates an app', async function () {
    const store = observable([
      { count: 0 },
    ])

    const addTodo = Seq.handler(function* (event) {
      yield delay(20)
      store.push({ count: 0 })
    })

    function* watchTodo(todo) {
      while (true) {
        yield delay(30)
        todo.count = todo.count + 1
      }
    }

    const Todo = observer(class extends React.Component {
      componentWillMount() {
        this.watch = new Seq(watchTodo(this.props.todo))
      }

      componentWillUnmount() {
        this.watch.cancel()
      }

      render() {
        return React.createElement('li', { onClick: this.handleClick }, this.props.todo.count)
      }
    })

    const TodoList = observer(class extends React.Component {
      handleClick = addTodo

      render() {
        return React.createElement('div', null,
          React.createElement('ul', null, this.props.store.map(
            (todo, index) => React.createElement(Todo, {
              todo: todo,
              key: index
            })
          )),
          React.createElement('button', { onClick: this.handleClick })
        )
      }
    })

    const component = enzyme.mount(React.createElement(TodoList, { store }))

    expect(component.find(Todo).length).to.equal(1)
    component.find('button').simulate('click')
    await delay(30)
    expect(component.find(Todo).length).to.equal(2)
    component.find('button').simulate('click')
    await delay(10)
    component.find('button').simulate('click')
    await delay(30)
    expect(component.find(Todo).length).to.equal(3)
    expect(store[0].count).to.equal(2)
    expect(store[1].count).to.equal(1)
    expect(store[2].count).to.equal(0)
    store.pop()
    store.pop()
    await delay(30)
    expect(store[0].count).to.equal(3)
    store.pop()
  })
})
