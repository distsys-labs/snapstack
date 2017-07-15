module.exports = {
  sevenA: [
    function one (acc, next) {
      next()
    },
    function two () {
      return 'seven a'
    }
  ],
  sevenB: [
    function one (acc, next) {
      next()
    },
    function two () {
      return 'seven b'
    }
  ]
}
