module.exports = function six () {
  return {
    sixA: [
      function one (acc, next) {
        next()
      },
      function two () {
        return 'six a'
      }
    ],
    sixB: [
      function one (acc, next) {
        next()
      },
      function two () {
        return 'six b'
      }
    ]
  }
}
