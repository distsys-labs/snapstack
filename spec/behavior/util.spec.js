require('../setup')
var fount = require('fount')
var utility = require('../../src/util')

describe('Utility Module', function () {
  describe('Fount', function () {
    describe('when getting container from state', function () {
      var state, config

      before(function () {
        state = { fount: fount }
        config = {}
        fount.register('a', 1)
        fount.register('b', function () { return 2 })
        fount.register('c', Promise.resolve(3))
      })

      it("should get state's fount instance", function () {
        utility.getContainer(state, config).should.eql(fount)
      })

      it('should inject values from container', function () {
        return utility.inject(state, config, function (a, b, c) { return a + b + c })
          .should.eventually.eql(6)
      })

      it('should resolve values from container', function () {
        return utility.resolve(state, config, [ 'a', 'b', 'c' ])
          .then(function (results) {
            return results.a + results.b + results.c
          }).should.eventually.equal(6)
      })

      after(function () {
        fount.purgeAll()
      })
    })

    describe('when configuration provides a fount instance', function () {
      var state, config

      before(function () {
        state = { fount: {} }
        config = { fount: fount }
        fount.register('a', 1)
        fount.register('b', function () { return 2 })
        fount.register('c', Promise.resolve(3))
      })

      it("should get config's fount instance", function () {
        utility.getContainer(state, config).should.eql(fount)
      })

      it('should inject values from container', function () {
        return utility.inject(state, config, function (a, b, c) { return a + b + c })
          .should.eventually.eql(6)
      })

      it('should resolve values from container', function () {
        return utility.resolve(state, config, [ 'a', 'b', 'c' ])
          .then(function (results) {
            return results.a + results.b + results.c
          }).should.eventually.equal(6)
      })

      after(function () {
        fount.purgeAll()
      })
    })
  })
})
