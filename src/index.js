const _ = require('fauxdash')
const createStack = require('./stack').create
const modlo = require('modlo')

function executeStack (state, fount, stackName, context, acc) {
  return fount.resolve(stackName)
    .then(stack => stack.execute(context, acc))
}

function isAStackSpec (spec) {
  return _.isFunction(spec) ||
    (Array.isArray(spec) && spec[ 0 ].when)
}

function load (state, loader, list) {
  const files = []
  const names = []
  list = _.isString(list) ? [ list ] : list
  list.forEach(x => {
    if (/[/]/.test(x)) {
      files.push(x)
    } else {
      names.push(x)
    }
  })
  return loader.load({ patterns: files, modules: names })
    .then(result => {
      const fount = result.fount
      const promises = result.loaded.map(stackModuleName => {
        return fount.resolve(stackModuleName)
        .then(processModule.bind(null, state, fount, stackModuleName))
      })
      return Promise.all(promises)
        .then(stacks => {
          const list = _.filter(_.flatten(stacks), x => x && x.steps && x.steps.length)
          return list.reduce((acc, stack) => {
            acc[ stack.name ] = stack
            return acc
          }, {})
        })
    })
}

function processModule (state, fount, stackModuleName, stackModule) {
  if (Array.isArray(stackModule)) {
    if (_.isFunction(stackModule[ 0 ])) {
      return createStack(state, fount, stackModule, stackModuleName)
    } else {
      return _.map(stackModule, stack => {
        return createStack(state, fount, stack)
      })
    }
  } else {
    if (_.find(_.values(stackModule), isAStackSpec)) {
      return createStack(state, fount, stackModule, stackModule.name || stackModuleName)
    } else {
      return _.map(stackModule, (stack, name) => {
        if (!_.isString(stack)) {
          return createStack(state, fount, stack, name)
        }
      })
    }
  }
}

module.exports = function (config = {}) {
  const fount = config.fount || require('fount')
  const containerName = config.container || 'stack'
  const container = fount(containerName)
  const loader = modlo({ fount: container })
  const state = {}
  Object.assign(state, {
    stacks: {},
    execute: executeStack.bind(null, state, container),
    fount: fount,
    load: load.bind(null, state, loader),
    stack: createStack.bind(null, state, container)
  })
  return state
}
