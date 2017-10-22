if (typeof Promise.prototype.finally === 'undefined') {
  Promise.prototype.finally = function (handler) {
    return this.then(
      v => {
        handler()
        return v
      },
      e => {
        handler()
        throw e
      }
    )
  }
}
