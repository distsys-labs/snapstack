const _ = require('fauxdash')
const format = require('util').format
const util = require('./util')

function addFunction (stack, fount, name, fn) {
  if (_.isFunction(fn)) {
    stack.calls[ name ] = fn._wrapped ? fn : util.wrap(fount, fn)
  } else if (Array.isArray(fn) && fn[ 0 ].then) {
    stack.calls[ name ] = util.getDifferentiator(fount, fn)
  } else {
    throw new Error(format('Cannot add non-function %s to stack: %s', name, fn))
  }
}

function append (stack, fount, fn, name) {
  name = fn.name || name
  stack.steps.push(name)
  addFunction(stack, fount, name, fn)
}

function appendStack (stack, source) {
  _.each(source.steps, function (stepName) {
    stack.steps.push(stepName)
    stack.calls[ stepName ] = source.calls[ stepName ]
  })
}

function attach (state, stack, fount) {
  const merged = Object.assign(stack, {
    append: append.bind(null, stack, fount),
    appendStack: appendStack.bind(null, stack),
    clone: clone.bind(null, state, stack, fount),
    execute: execute.bind(null, stack),
    insertAfter: insertAfter.bind(null, stack, fount),
    insertBefore: insertBefore.bind(null, stack, fount),
    prepend: prepend.bind(null, stack, fount),
    prependStack: prependStack.bind(null, stack)
  })
  state.stacks[ stack.name ] = stack
  return merged
}

function clone (state, stack, fount, name) {
  const copy = _.clone(stack)
  copy.name = name
  fount.register(name, copy)
  return attach(state, copy, fount)
}

function create (state, fount, calls, name) {
  let stackName = name
  let callList = calls
  if (_.isString(calls)) {
    stackName = calls
    callList = undefined
  }
  if (calls) {
    stackName = calls._name || calls.name || stackName
  }
  if (!stackName) {
    throw new Error('A stack must be initialized with a name')
  }
  const stack = {
    name: stackName,
    steps: [],
    calls: {}
  }
  fount.register(stackName, stack)
  initialize(state, stack, fount, callList)
  return attach(state, stack, fount)
}

function execute (stack, context, acc) {
  context = context || {}
  return new Promise(function (resolve, reject) {
    executeStep(stack, context, acc || {}, 0, resolve, reject)
  })
}

function executeStep (stack, context, acc, index, resolve, reject, error, result) {
  if (error || result) {
    finalize(resolve, reject, error, result)
  }
  const step = stack.steps[ index ]
  const fn = stack.calls[ step ]

  const nextIndex = index + 1
  if (!fn || !(fn instanceof Function)) {
    reject(new Error(format("Could not invoke step '%s' as it is not a valid function", step)))
    return
  }
  var cb
  function onResult (result) {
    if (result) {
      if (result.then || result._promise) {
        (result._promise || result).then(cb, reject)
      } else if (result instanceof Error) {
        reject(result)
      } else {
        resolve(result)
      }
    }
  }
  if (index === stack.steps.length - 1) {
    context._lastCall = true
    cb = finalize.bind(null, resolve, reject)
  } else {
    context._lastCall = false
    cb = executeStep.bind(null, stack, context, acc, nextIndex, resolve, reject)
  }
  try {
    fn(context, acc, cb)
      .then(onResult, reject)
  } catch (ex) {
    reject(ex)
  }
}

function finalize (resolve, reject, error, result) {
  const final = error || result
  if (final instanceof Error) {
    reject(final)
  } else {
    resolve(final)
  }
}

function initialize (state, stack, fount, calls = {}) {
  _.each(calls, function (call, name) {
    if (_.isString(call) && parseInt(name) >= 0) {
      const parts = call.split('.')
      const stackName = parts[ 0 ]
      const callName = parts[ 1 ]
      const sourceStack = state.stacks[ stackName ]
      if (sourceStack) {
        const step = sourceStack.calls[ callName ]
        if (step) {
          stack.steps.push(callName)
          stack.calls[ callName ] = step
        } else {
          console.error(format(
            "Could not find step named '%s' in stack '%s' as specified by step '%s', it will not be included in the stack",
            callName, stackName, call
          ), name)
        }
      } else {
        console.error(format(
          "Could not find stack named '%s' as specified by step '%s', it will not be included in the stack",
          stackName, call
        ))
      }
    } else if (_.isFunction(call) || (Array.isArray(call) && call[ 0 ].then)) {
      const appliedName = name || call.name
      append(stack, fount, call, appliedName)
    }
  })
}

function insertAfter (stack, fount, step, fn, name) {
  name = fn.name || name
  const start = stack.steps.indexOf(step) + 1
  stack.steps.splice(start, 0, name)
  addFunction(stack, fount, name, fn)
}

function insertBefore (stack, fount, step, fn, name) {
  name = fn.name || name
  const start = stack.steps.indexOf(step)
  stack.steps.splice(start, 0, name)
  addFunction(stack, fount, name, fn)
}

function prepend (stack, fount, fn, name) {
  name = fn.name || name
  stack.steps.unshift(name)
  addFunction(stack, fount, name, fn)
}

function prependStack (stack, source) {
  _.each(source.steps, function (stepName) {
    stack.steps.unshift(stepName)
    stack.calls[ stepName ] = source.calls[ stepName ]
  })
}

module.exports = {
  create: create
}
