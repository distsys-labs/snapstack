module.exports = function loadedTwo () {
  return {
    name: 'two',
    one: function (acc, next) {
      next()
    },
    two: function () {
      return 'two'
    }
  }
}
