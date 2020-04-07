export default class Effect {
  constructor(handler, payload) {
    this.handler = handler;
    this.payload = payload;
  }
}
