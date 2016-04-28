## snapstack

Create stacks of functions from heterogenous asynchronous styles. Initially built for middleware stacks. This is a bit of an experiment/toy that I hope to use in other projects.

### caveat emptor
snapstack doesn't prevent side-effects and certain use-cases will probably require the use there-of.

## Install

```bash
npm install snapstack -S
```

## Concepts

### Basics
 * `context` - execution context for each of the functions in a stack
 * `accumulator` - an accumulator hash passed to all function calls
 * `fount` - a DI container used to satisfy function arguments not found in the context or accumulator

snapstack takes a unique approach to constructing call stacks:
 * each function have its `this` set to the `context` provided during execution
 * each function will have arguments 'injected' from properties on the `context`, the `accumulator` or from `fount`
 * each function's first argument will be an `accumulator` object used to pass values and satisfy argument parameters for future calls
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
var fount = require( "fount" );
var snap = require( "snapstack" )( { fount: fount } );

snap.load( [ "./stacks", "someNpmLib" ] )
	.then( function() {
		return snap.execute( "aLoadedStack" )( {}, {} );
	} );
```

## Use

### really simple

```js
var fount = require( "fount" );
var snap = require( "snapstack" )( { fount: fount } );

function callbackStyle( acc, cb ) {
	acc.a = 1;
	cb();
}

function promiseStyle( acc, a ) {
	acc.b = a + 1;
	return when();
}

function plain( acc, b ) {
	return b + 1;
}

var myStack = snap.stack( [
	callbackStyle,
	promiseStyle,
	plain
], "simple" );

// the context and accumulator are both empty hashes
myStack.execute( {}, {} )
	.then( function( result ) {
		// result == 3;
	} );

```

### cloning and modifying

```js
var fount = require( "fount" );
var snap require( "snapstack" )( { fount: fount } );

function one( acc, id ) {
	return someApi.call( id )
		.then( function( result ) {
			acc.one = result;
		} );
}

function two( acc, one ) {
	return otherApi.call( one )
		.then( function( result ) {
			acc.two = result;
		} );
}

function modifier( acc, one, cb ) {
	acc.one = { something: "completely different" };
	cb();
}

var defaultStack = snap.stack( [ one, two ], "default" );

var modifiedStack = defaultStack.clone( "modified" );
modifiedStack.insertBefore( "two", modifier );

// default stack's call order: one -> two
// modified stack's call order: one -> modifier -> two

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
			then: function( envelope ) {
				...
			}
		},
		{
			when: function( envelope ) { // provide a predicate to test the envelope
				return envelope.version === 2;
			},
			then: function( envelope ) {
				...
			}
		},
		{
			when: true, // use at the end as a catch-all if desired
			then: function( envelope ) {
				...
			}
		}
	]
}
```

## API

### `( [{config}] )`
Initializes an instance of the library, config hash is optional.

__config options__
```js
{
	fount: fount // provide optional fount instance
	container: "stack" // fount container to register stacks in
}
```

```js
var snap = require( "snap" )(); // use internal fount instance and "stack" container
```

### `.fount`
The fount instance used by any stacks created. A default internal instance will be used if none is provided when initializing the library. This fount instance will also be used when loading stacks. All loaded stacks will get registered by name in a `stack` container.

### `load( paths and/or module names )`
Loads one or more stacks from a file module or NPM library:

```js
snap.load( "./aStack" )
	.then( function( stacks ) {
		return stacks[ "stackName" ].execute( {}, {} );
	} );
```

Stack modules can return a stack a few different ways:

#### example - static hash

__single stack__
```js
module.exports = {
	name: "", // stack name
	one: function( acc, next ) { ... },
	...
};
```

__multiple stacks as a hash__
```js
module.exports = {
	stackOne: {
		one: function( acc, next ) { ... },
		...
	},
	stackTwo: [
		function one( acc, next ) { ... }
	],
	...
}
```

#### example - static array

__single stack as an array of named functions__
> Note: module name will determine stack name
```js
module.exports = [
	function one( acc, next ) { ... },
	...
];
```

__multiple stacks as an array of hashes__
```js
module.exports = [
	{
		name: "stackOne", // stack name
		one: function( acc, next ) { ... },
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

var stack1 = snap.stack( [ a, b, c ], "stackName" );

var stack2 = snap.stack( {
	_name: "stackName",
	a: () => {},
	b: () => {},
	c: () => {}
} );
```

#### `execute( stackName, context, accumulator )`
Executes a stack by name. See Stack API for more on how this works.

### Stack API

> Note: in the calls that add functions to the stack, if the function is anonymous, you _must_ provide the name via the `name` argument. It is only optional for named functions.

#### `append( function, [name] )`
Appends the function to the end of the current stack.

```js
function doAThing() {
	...
}

// named functions don't need a name parameter
stack.append( doAThing );

// anonymous functions need a name
stack.append( () => {}, "doAnotherThing" );
```

#### `clone( cloneName )`
Clones the stack. Use this when you want to create alternate stacks while keeping the original in-tact. Requires a different name for the new stack.

```js
var newStack = stack.clone();

// new stack gets a new step at the beginning without changing stack
newStack.prepend( () => {}, "someNewStackInitializer" );
```

#### `execute( context, accumulator )`
Execute runs the stack returning a promise for the result. The `context` will set `this` for each function in the stack while `accumulator` will be passed as the first argument to every function.

```js
stack.execute( {}, {} )
	.then( function( result ) {
		// result of the stack execution
	} );
```

#### `insertBefore( step, function, [name] )`
Inserts the function _before_ the named step in the stack. 

```js
function doAThing() {
	...
}

// named functions don't need a name parameter
stack.append( doAThing );

// inserts doAnotherThing BEFORE doAThing
stack.insertBefore( "doAThing", () => {}, "doAnotherThing" );
```

#### `insertAfter( step, function, [name] )`
Inserts the function _after_ the named step in the stack. 

```js
function doAThing() {
	...
}

// named functions don't need a name parameter
stack.append( doAThing );

// inserts doAnotherThing AFTER doAThing
stack.insertAfter( "doAThing", () => {}, "doAnotherThing" );
```


#### `prepend( function, [name] )`
Prepends the function to the beginning of the current stack.

```js
function doAThing() {
	...
}

// named functions don't need a name parameter
stack.prepend( doAThing );

// anonymous functions need a name
stack.prepend( () => {}, "doAnotherThing" );
```