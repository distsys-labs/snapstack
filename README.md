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

snapstack takes a somewhat unique approach to constructing call stacks:
 * each function have its `this` set to the `context` provided during execution
 * each function will have arguments 'injected' from properties on the `context`, the `accumulator` or from `fount`
 * each function's first argument will be an `accumulator` object used to pass values and satisfy argument parameters for future calls
 * execution always results in a promise regardless of the asynchronous style used by individual functions in the stack
 * there are several ways to short-circuit a stack
   * throw an error
   * return a value
   * invoke a callback with an error or value
   * resolve a promise with a value

Throwing, resolving to an error, returning an error or rejecting a promise all result in the execution's promise rejecting. 

### "Stackpacks"
You can load sets of functions from modules under a specified folder or from an npm module. The resulting stacks will be returned in a hash where module names are they keys.

```js
var fount = require( "fount" );
var snap = require( "snapstack" )( { fount: fount } );

var stacks = snap.load( "./stacks" );
var shared = snap.load( "some-npm-lib" );
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
var stack1 = snap.load( "./aStack" );
var stack2 = snap.load( "./stackLib" );
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