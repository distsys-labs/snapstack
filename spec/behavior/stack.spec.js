require('../setup')
var fount = require('fount')
var snap = require('../../src/index')({ config: fount })
var createStack = snap.stack
var load = snap.load
var exec = snap.execute
var when = require('when')

function promiseOne (acc, next) {
  return when()
}

function promiseTwo (acc, next) {
  return when()
}

function promiseThree (acc, next) {
  return when()
}

function promiseFour (acc, next) {
  return 4
}

function promiseResult (acc, next) {
  return when(3)
}

function promiseException (acc, next) {
  throw new Error('no')
}

function promiseReject (acc, next) {
  return when.reject(new Error('no'))
}

function callbackOne (acc, next) {
  setTimeout(function () {
    next()
  }, 0)
}

function callbackTwo (acc, next) {
  setTimeout(function () {
    next()
  }, 0)
}

function callbackThree (acc, next) {
  setTimeout(function () {
    next()
  }, 0)
}

function callbackFour (acc, next) {
  setTimeout(function () {
    next(4)
  }, 0)
}

function callbackResult (acc, next) {
  return 3
}

function callbackException (acc, next) {
  throw new Error('nope')
}

function callbackError (acc, next) {
  next(new Error('nope'))
}

describe('Stack', function () {
  describe('with uniform promise stack', function () {
    describe('where every step resolves', function () {
      var stack
      before(function () {
        stack = createStack('allPromises')
        stack.append(promiseOne)
        stack.append(promiseFour)
        stack.insertAfter('promiseOne', promiseTwo)
        stack.insertBefore('promiseFour', promiseThree)
      })

      it('should resolve to final calls result', function () {
        return stack.execute({})
          .should.eventually.equal(4)
      })
    })

    describe('with short-circuit', function () {
      var stack
      before(function () {
        stack = createStack('shortCircuitedPromises')
        stack.append(promiseOne)
        stack.append(promiseFour)
        stack.insertAfter('promiseOne', promiseTwo)
        stack.insertBefore('promiseFour', promiseThree)
        stack.insertAfter('promiseOne', promiseResult)
      })

      it('should resolve to final calls result', function () {
        return stack.execute({})
          .should.eventually.equal(3)
      })
    })

    describe('with rejected promise', function () {
      var stack
      before(function () {
        stack = createStack('rejectedPromise')
        stack.append(promiseOne)
        stack.append(promiseTwo)
        stack.append(promiseReject)
      })

      it('should result in rejected error', function () {
        return stack.execute({})
          .should.eventually.be.rejectedWith('no')
      })
    })

    describe('with thrown exception', function () {
      var stack
      before(function () {
        stack = createStack('thrower')
        stack.append(promiseOne)
        stack.append(promiseTwo)
        stack.append(promiseException)
      })

      it('should result in rejected error', function () {
        return stack.execute({})
          .should.eventually.be.rejectedWith('no')
      })
    })

    after(function () {
      fount.purgeAll()
    })
  })

  describe('with uniform callback stack', function () {
    describe('where every step resolves', function () {
      var stack
      before(function () {
        stack = createStack('allCallbacks')
        stack.append(callbackOne)
        stack.append(callbackFour)
        stack.insertAfter('callbackOne', callbackTwo)
        stack.insertBefore('callbackFour', callbackThree)
      })

      it('should resolve to final calls result', function () {
        return stack.execute({})
          .should.eventually.equal(4)
      })
    })

    describe('with short-circuit', function () {
      var stack
      before(function () {
        stack = createStack('shortCircuitedCallbacks')
        stack.append(callbackOne)
        stack.append(callbackFour)
        stack.insertAfter('callbackOne', callbackTwo)
        stack.insertBefore('callbackFour', callbackThree)
        stack.insertAfter('callbackOne', callbackResult)
      })

      it('should resolve to final calls result', function () {
        return stack.execute({})
          .should.eventually.equal(3)
      })
    })

    describe('with rejected callback', function () {
      var stack
      before(function () {
        stack = createStack('rejectedCallback')
        stack.append(callbackOne)
        stack.append(callbackTwo)
        stack.append(callbackError)
      })

      it('should result in rejected error', function () {
        return stack.execute({})
          .should.eventually.be.rejectedWith('nope')
      })
    })

    describe('with thrown exception', function () {
      var stack
      before(function () {
        stack = createStack('thrower2')
        stack.append(callbackOne)
        stack.append(callbackTwo)
        stack.append(callbackException)
      })

      it('should result in rejected error', function () {
        return stack.execute({})
          .should.eventually.be.rejectedWith('nope')
      })
    })

    after(function () {
      fount.purgeAll()
    })
  })

  describe('with initialization and cloning', function () {
    var one, two, three, four, five
    before(function () {
      one = createStack({
        name: 'one',
        a: function () {
          return when()
        },
        b: function (acc, next) {
          process.nextTick(next)
        },
        c: function () {
          return 'one-a'
        }
      })

      two = createStack([
        function a (acc, next) {
          process.nextTick(next)
        },
        function b (x, env, next) {
          return when()
        },
        function c (acc, next) {
          next('two-a')
        }
      ], 'two')

      three = one.clone('three')
      four = two.clone('four')
      five = one.clone('five')

      three.insertBefore('c', function d () { return when('one-b') })
      four.insertAfter('b', function e () { return 'two-b' })
      five.prepend(function f () { return 1 })
    })

    it('should resolve to correct value for stack one', function () {
      return one.execute().should.eventually.equal('one-a')
    })

    it('should resolve to correct value for stack two', function () {
      return two.execute().should.eventually.equal('two-a')
    })

    it('should resolve to correct value for stack three', function () {
      return three.execute().should.eventually.equal('one-b')
    })

    it('should resolve to correct value for stack four', function () {
      return four.execute().should.eventually.equal('two-b')
    })

    it('should resolve to prepended value for stack five', function () {
      return five.execute().should.eventually.equal(1)
    })

    it('should throw an error when adding invalid function', function () {
      expect(function () {
        one.append({}, 'g')
      }).to.throw('Cannot add non-function g to stack: [object Object]')
    })

    it('should throw an error if a step is invalid or missing', function () {
      five.steps.unshift('uhoh')
      return five.execute().should.be.rejectedWith("Could not invoke step 'uhoh' as it is not a valid function")
    })

    it('should reject if an error is returned', function () {
      two.prepend(function h () { return new Error('returned error') })
      return two.execute().should.be.rejectedWith('returned error')
    })

    it('should reject if a step throws an exception', function () {
      three.prepend(function i () { throw new Error('thrown error') })
      return three.execute().should.be.rejectedWith('thrown error')
    })

    after(function () {
      fount.purgeAll()
    })
  })

  describe('with custom arguments', function () {
    var one
    before(function () {
      one = createStack([
        function a (acc, x, next) {
          if (x) {
            return x
          }
          next()
        },
        function b () {
          return when()
        },
        function c (acc, next) {
          next('c')
        }
      ], 'custom')
    })

    it('should resolve to last call by default', function () {
      one.execute().should.eventually.equal('c')
    })

    it('should resolve to acc.x', function () {
      one.execute({ x: 5 }).should.eventually.equal(5)
    })

    after(function () {
      fount.purgeAll()
    })
  })

  describe('with loaded stacks', function () {
    var stacks
    before(function () {
      return load('./spec/stacks/*.js')
        .then(function (list) {
          stacks = list
          createStack([
            'one.one',
            'two.one',
            'fourA.one',
            'fiveB.three'
          ], 'custom')
        })
    })

    it('should load all stacks', function () {
      Object.keys(stacks).should.eql([
        'one',
        'two',
        'three',
        'fourA',
        'fourB',
        'fiveA',
        'fiveB',
        'sixA',
        'sixB',
        'sevenA',
        'sevenB',
        'eight',
        'nine'
      ].sort())
    })

    it('should load and execute stack one', function () {
      return exec('one').should.eventually.equal('one')
    })

    it('should load and execute stack two', function () {
      return exec('two').should.eventually.equal('two')
    })

    it('should load and execute stack three', function () {
      return exec('three').should.eventually.equal('three')
    })

    it('should load and execute stack four a', function () {
      return exec('fourA').should.eventually.equal('four a')
    })

    it('should load and execute stack four b', function () {
      return exec('fourB').should.eventually.equal('four b')
    })

    it('should load and execute stack five a', function () {
      return exec('fiveA').should.eventually.equal('five a')
    })

    it('should load and execute stack five b', function () {
      return exec('fiveB').should.eventually.equal('five b')
    })

    it('should load and execute stack six a', function () {
      return exec('sixA').should.eventually.equal('six a')
    })

    it('should load and execute stack six b', function () {
      return exec('sixB').should.eventually.equal('six b')
    })

    it('should load and execute stack seven a', function () {
      return exec('sevenA').should.eventually.equal('seven a')
    })

    it('should load and execute stack seven b', function () {
      return exec('sevenB').should.eventually.equal('seven b')
    })

    it('should load and execute stack eight', function () {
      return exec('eight').should.eventually.equal('eight')
    })

    it('should load and execute stack nine (condition 1)', function () {
      return exec('nine', {}, { x: 9, z: 50 }).should.eventually.equal(9)
    })

    it('should load and execute stack nine (condition 2)', function () {
      return exec('nine', {}, { y: 'nine' }).should.eventually.equal('nine')
    })

    it('should reject when no conditions for stack nine are met', function () {
      return exec('nine', {}, {}).should.be.rejectedWith('The call stack failed to meet any of the supported conditions')
    })

    it('should have created a custom stack from other steps', function () {
      return exec('custom').should.eventually.equal('unreachable?')
    })
  })
})
