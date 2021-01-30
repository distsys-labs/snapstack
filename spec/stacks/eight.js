const _ = require('lodash')
module.exports = function (one) {
  const eight = _.cloneDeep(one)
  eight.two = function () {
    return 'eight'
  }
  return eight
}
