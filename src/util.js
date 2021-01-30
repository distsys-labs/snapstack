const _ = require('fauxdash')
const reserved = ['next', 'cb', 'callback', 'continue', 'done']
const callbacks = ['next', 'cb', 'callback', 'continue', 'done']

function getArgumentsFor (...parameters) {
  const functions = _.map(parameters, _.parseFunction)
  return _.reduce(functions, function (acc, fn) {
    const functionArgs = fn.arguments.slice(1)
    const argList = [functionArgs].concat(reserved.concat(acc.arguments))
    const args = _.without.apply(null, argList)
    const callbacks = _.intersection(functionArgs, reserved)
    acc.arguments = acc.arguments.concat(args)
    acc.callbacks = _.uniq(acc.callbacks.concat(callbacks))
    return acc
  }, { arguments: ['envelope'], callbacks: [] })
}

function getContainer (state, configuration) {
  return configuration.fount || state.fount
}

function getArguments (fn) {
  return _.parseFunction(fn).arguments
}

function getDifferentiator (fount, fn) {
  const list = _.filter(_.map(fn, function (option) {
    if (_.isFunction(option.when)) {
      return {
        when: wrap(fount, option.when),
        then: wrap(fount, option.then)
      }
    } else if (option.when === true) {
      return {
        when: function () { return true },
        then: wrap(fount, option.then)
      }
    } else if (_.isObject(option.when)) {
      return {
        when: _.matches(option.when),
        then: wrap(fount, option.then)
      }
    } else {
      console.error(
        `A step's 'when' property must be a function or an object instead of ${option.when}. Option will not be included in potential outcomes.`
      )
    }
  }))
  const differentiated = function (context, acc, next) {
    // this little headache allows when conditions to return a promise
    const promises = _.map(list, function (option) {
      const pass = option.when(acc)
      const fn = option.then === _.noop ? passthrough : option.then
      if (pass.then) {
        return pass.then(function (result) {
          return { when: result, fn: fn }
        })
      } else {
        return Promise.resolve({ when: pass, fn: fn })
      }
    })
    return Promise.all(promises)
      .then(function (list) {
        const option = _.find(list, function (option) {
          return option.when
        })
        if (option) {
          return option.fn(context, acc, next)
        } else {
          if (context._lastCall) {
            return Promise.reject(new Error('The call stack failed to meet any of the supported conditions'))
          } else {
            next()
          }
        }
      })
  }
  differentiated._wrapped = true
  return differentiated
}

function invokeFount (call, args) {
  const state = args.shift()
  const configuration = args.shift()
  const container = getContainer(state, configuration)
  return container[call].apply(container, args)
}

function inject (...parameters) {
  return invokeFount('inject', parameters)
}

function passthrough (acc, next) {
  next()
}

function resolve (...parameters) {
  return invokeFount('resolve', parameters)
}

function wrap (fount, fn) {
  const argumentList = getArguments(fn).slice(1)
  if (_.contains(callbacks, _.last(argumentList))) {
    argumentList.pop()
  }
  const wrapped = function (context, acc, next) {
    const values = _.reduce(argumentList, function (args, argName) {
      if (context && context[argName]) {
        args.push(context[argName])
      } else if (acc && acc[argName]) {
        args.push(acc[argName])
      } else if (fount.canResolve(argName)) {
        args.push(fount.resolve(argName))
      } else {
        args.push(undefined)
      }
      return args
    }, [acc])
    values.push(next)
    return Promise.all(values)
      .then(function (result) {
        const x = fn.apply(context, result)
        if (x && x.then) {
          return { _promise: x }
        } else {
          return x
        }
      })
  }
  wrapped._wrapped = true
  return wrapped
}

module.exports = {
  getArgumentsFor: getArgumentsFor,
  getContainer: getContainer,
  getDifferentiator: getDifferentiator,
  inject: inject,
  passthrough: passthrough,
  resolve: resolve,
  wrap: wrap
}
