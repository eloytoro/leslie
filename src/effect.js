import Effect from './internal/Effect'

export default (payloadCreator, handler) => (...args) => (
  new Effect(handler, payloadCreator(...args))
)
