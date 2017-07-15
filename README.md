## snapstack

Create stacks of functions from heterogenous asynchronous styles. Initially built for middleware stacks.

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coveralls-image]][coveralls-url]

### caveat emptor
snapstack doesn't prevent side-effects and some use-cases may require them.

## Install

```bash
npm i snapstack
```

## Concepts

### Basics
 * `context` - execution context for each of the functions in a stack
 * `accumulator` - an accumulator hash passed to all function calls
 * `fount` - a DI container used to satisfy function arguments not found in the context or accumulator

snapstack takes a unique approach to constructing call stacks:
 * each function have its `this` set to the `context` provided during execution
 * each function's first argument will be an `accumulator` object used to pass values and satisfy argument parameters for future calls
 * each function will have a callback supplied as the last argument to help integrate old school async calls
 * each function will have other arguments 'injected'
  * from properties on the `context`
  * properties on the `accumulator`
  * from `fount`
 * execution always results in a promise regardless of the asynchronous style used by individual functions in the stack
 * there are several ways to short-circuit a stack
   * throw an error
   * return a value
   * invoke a callback with an error or value
   * resolve a promise with a value
 * conditional sets of functions are supported (see [conditions](#conditions))

Throwing, resolving to an error, returning an error or rejecting a promise all result in the execution's promise rejecting. 

### "Stackpacks"
You can load sets of functions from modules under a specified folder or from an npm module. The resulting stacks will be registered with fount under the stack container and can be executed by name. A list of all loaded stacks are returned as a hash.

```js
const fount = require('fount')
const snap = require('snapstack')({ fount: fount })

snap.load([ './stacks', 'someNpmLib' ])
	.then(() => snap.execute('aLoadedStack')({}, {}))
```

## Use

### really simple

```js
const fount = require('fount')
const snap = require('snapstack')({ fount: fount })

function callbackStyle(acc, cb) {
	acc.a = 1
	cb()
}

function promiseStyle(acc, a) {
	acc.b = a + 1
	return Promise.resolve()
}

function plain(acc, b) {
	return b + 1
}

const myStack = snap.stack([
	callbackStyle,
	promiseStyle,
	plain
], 'simple')

// the context and accumulator are both empty hashes
myStack.execute({}, {})
	.then(result => {
		// result == 3;
	})
```

### cloning and modifying

```js
const fount = require('fount')
const snap require('snapstack')({ fount: fount })

function one(acc, id) {
	return someApi.call(id)
		.then(result => {
			acc.one = result
		})
}

function two(acc, one) {
	return otherApi.call(one)
		.then(result => {
			acc.two = result
		})
}

function modifier(acc, one, cb) {
	acc.one = { something: 'completely different' }
	cb()
}

const defaultStack = snap.stack([ one, two ], 'default')

const modifiedStack = defaultStack.clone('modified')
modifiedStack.insertBefore('two', modifier)

// default stack's call order: one -> two
// modified stack's call order: one -> modifier -> two
```

### Combining steps from different stacks
There _may_ be occasions where you want some steps from a shared stack module but need to swap parts out:

```js
const fount = require('fount')
const snap = require('snapstack')({ fount: fount })

// imagin that from this we end up with stacks named after letters in the alphabet ...
snap.load([ './stacks' ])
	.then(() => {
		// you can create a new stack using the stack name and step names in place of functions:
		snap.stack([ 'A.one', 'B.two', 'A.three', 'D.four' ], 'custom')
		return snap.execute('custom')({}, {})
	})

// if any of the stack or step names dont' exist or haven't been loaded yet you'll
// get an exception, in this case, creating the custom stack here would blow up
// because the promise returned for loading hasn't completed yet
```

### Conditions
Having middleware that handles specific conditions is common. Having lots of branches in a single function body can make the code difficult to follow or understand. SnapStack supports lists of functions with when guards that determine which function to invoke based on the context and/or the accumulator. The list is evaluated in order. If no condition is satisfied, the step is skipped _unless its the last call in the stack and then an error is returned_.

> Note: if you don't want an error for a step with no matching conditions at the end of the stack, you can end the condition set with ```{ when: true, then: _.noop }``` as a short-hand pass-through.

The `when` property of the condition may be a set of properties that must be true or a predicate that evaluates the envelope and returns true when it should be called. The `then` property would be the function to call.

> Note: the most likely use cases for this are versioning or transport-specific handlers

```javascript
{
	handle: [
		{
			when: { version: 1 }, // providing a set of properties and values to filter requests for the handler
			then: (envelope) => {
				...
			}
		},
		{
			when: (envelope) => { // provide a predicate to test the envelope
				return envelope.version === 2;
			},
			then: (envelope) => {
				...
			}
		},
		{
			when: true, // use at the end as a catch-all if desired
			then: (envelope) => {
				...
			}
		}
	]
}
```

## API

### `([{config}])`
Initializes an instance of the library, config hash is optional.

__config options__
```js
{
	fount: fount // provide optional fount instance
	container: 'stack' // fount container to register stacks in
}
```

```js
const snap = require('snap')(); // use internal fount instance and "stack" container
```

### `.fount`
The fount instance used by any stacks created. A default internal instance will be used if none is provided when initializing the library. This fount instance will also be used when loading stacks. All loaded stacks will get registered by name in a `stack` container.

### `load( paths and/or module names )`
Loads one or more stacks from a file module or NPM library:

```js
snap.load('./aStack')
	.then(stacks => {
		return stacks[ 'stackName' ].execute({}, {})
	})
```

Stack modules can return a stack a few different ways:

#### example - static hash

__single stack__
```js
module.exports = {
	name: '', // stack name
	one: (acc, next) => {},
	...
};
```

__multiple stacks as a hash__
```js
module.exports = {
	stackOne: {
		one: (acc, next) => {},
		...
	},
	stackTwo: [
		(acc, next) => {}
	],
	...
}
```

#### example - static array

__single stack as an array of named functions__
> Note: module name will determine stack name
```js
module.exports = [
	function one (acc, next) {},
	...
];
```

__multiple stacks as an array of hashes__
```js
module.exports = [
	{
		name: "stackOne", // stack name
		one: ( acc, next ) => {},
		...
	},
	...
]
```

#### example - factory method
> Note: factory methods can return any of the formats above or a promise that resolves for the same

```js
module.exports = function stackOne() {
	return [
		function one( acc, ext ) { ... },
		...
	];
}
```

For more examples, look at the modules under `./spec/stacks`.

### `stack( stackName )` - initialize an empty stack
### `stack( [functions], [stackName] )` - create a stack from functions
Creates a new stack instance. You can optionally provide a hash or array of functions to create the stack initially.

> Note - all stacks require a unique name

```js

function a() { ... };
function b() { ... };
function c() { ... };

const stack1 = snap.stack( [ a, b, c ], 'stackName' );

const stack2 = snap.stack( {
	_name: 'stackName',
	a: () => {},
	b: () => {},
	c: () => {}
} );
```

#### `execute(stackName, context, accumulator)`
Executes a stack by name. See Stack API for more on how this works.

### Stack API

> Note: in the calls that add functions to the stack, if the function is anonymous, you _must_ provide the name via the `name` argument. It is only optional for named functions.

#### `append(function, [name])`
Appends the function to the end of the current stack.

```js
function doAThing() {
	...
}

// named functions don't need a name parameter
stack.append(doAThing)

// anonymous functions need a name
stack.append(() => {}, 'doAnotherThing')
```

#### `clone(cloneName)`
Clones the stack. Use this when you want to create alternate stacks while keeping the original in-tact. Requires a different name for the new stack.

```js
const newStack = stack.clone()

// new stack gets a new step at the beginning without changing stack
newStack.prepend(() => {}, 'someNewStackInitializer')
```

#### `appendStack(stackToAppend)`
Appends all steps from the `stackToAppend` to the steps on this stack.

#### `execute( context, accumulator )`
Execute runs the stack returning a promise for the result. The `context` will set `this` for each function in the stack while `accumulator` will be passed as the first argument to every function.

```js
stack.execute({}, {})
	.then((result) => {
		// result of the stack execution
	})
```

#### `insertBefore(step, function, [name])`
Inserts the function _before_ the named step in the stack. 

```js
function doAThing() {
	...
}

// named functions don't need a name parameter
stack.append(doAThing)

// inserts doAnotherThing BEFORE doAThing
stack.insertBefore('doAThing', () => {}, 'doAnotherThing')
```

#### `insertAfter(step, function, [name])`
Inserts the function _after_ the named step in the stack. 

```js
function doAThing() {
	...
}

// named functions don't need a name parameter
stack.append(doAThing)

// inserts doAnotherThing AFTER doAThing
stack.insertAfter('doAThing', () => {}, 'doAnotherThing')
```


#### `prepend(function, [name])`
Prepends the function to the beginning of the current stack.

```js
function doAThing() {
	...
}

// named functions don't need a name parameter
stack.prepend(doAThing)

// anonymous functions need a name
stack.prepend(() => {}, 'doAnotherThing')
```

#### `prependStack(stackToAppend)`
Appends all steps from the `stackToAppend` to the steps on this stack.

[travis-url]: https://travis-ci.org/deftly/snapstack
[travis-image]: https://travis-ci.org/deftly/snapstack.svg?branch=master
[coveralls-url]: https://coveralls.io/github/deftly/snapstack?branch=master
[coveralls-image]: https://coveralls.io/repos/github/deftly/snapstack/badge.svg?branch=master