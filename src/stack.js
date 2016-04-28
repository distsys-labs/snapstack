var _ = require( "lodash" );
var when = require( "when" );
var format = require( "util" ).format;
var util = require( "./util" );
var modlo = require( "modlo" );

function addFunction( stack, fount, name, fn ) {
	if( _.isFunction( fn ) ) {
		stack.calls[ name ] = util.wrap( fount, fn );
	} else if( _.isArray( fn ) && fn[ 0 ].then ) {
		stack.calls[ name ] = util.getDifferentiator( fount, fn );
	} else {
		throw new Error( format( "Cannot add non-function %s to stack: %s", name, fn ) );
	}
}

function append( stack, fount, fn, name ) {
	name = fn.name || name;
	stack.steps.push( name );
	addFunction( stack, fount, name, fn );
}

function attach( state, stack, fount ) {
	var merged = Object.assign( stack, {
		append: append.bind( null, stack, fount ),
		clone: clone.bind( null, state, stack, fount ),
		execute: execute.bind( null, stack ),
		insertAfter: insertAfter.bind( null, stack, fount ),
		insertBefore: insertBefore.bind( null, stack, fount ),
		prepend: prepend.bind( null, stack, fount ),
	} );
	state.stacks[ stack.name ] = stack;
	return merged;
}

function clone( state, stack, fount, name ) {
	var copy = _.cloneDeep( stack );
	copy.name = name;
	fount.register( name, copy );
	return attach( state, copy, fount );
}

function createStack( state, fount, calls, name ) {
	if( _.isString( calls ) ) {
		name = calls;
		calls = undefined;
	}
	if( calls ) {
		name = calls._name || calls.name || name;	
	}
	if( !name ) {
		throw new Error( "A stack must be initialized with a name" );
	}
	var stack = {
		name: name,
		steps: [],
		calls: {}
	};
	fount.register( name, stack );
	initialize( state, stack, fount, calls );
	return attach( state, stack, fount );
}

function execute( stack, context, acc ) {
	context = context || {};
	return when.promise( function( resolve, reject ) {
		executeStep( stack, context, acc || {}, 0, resolve, reject );
	} );
}

function executeStep( stack, context, acc, index, resolve, reject, error, result ) {
	if( error || result ) {
		finalize( resolve, reject, error, result );
	}
	var step = stack.steps[ index ];
	var fn = stack.calls[ step ];

	var nextIndex = index + 1;
	if( !fn || !( fn instanceof Function ) ) {
		reject( new Error( format( "Could not invoke step '%s' as it is not a valid function", step ) ) );
		return;
	}
	var result, next, cb;
	function onResult ( result ) {
		if( result ) {
				if( result.then || result._promise ) {
					( result._promise || result ).then( cb, reject );
				} else if( result instanceof Error ) {
					reject( result );
				} else {
					resolve( result );
				}
			}
	}
	if( index === stack.steps.length - 1 ) {
		context._lastCall = true;
		cb = finalize.bind( null, resolve, reject );
	} else {
		context._lastCall = false;
		cb = executeStep.bind( null, stack, context, acc, nextIndex, resolve, reject );
	}
	try {
		fn.call( null, context, acc, cb )
			.then( onResult, reject );
	} catch( ex ) {
		reject( ex );
	}
}

function finalize( resolve, reject, error, result ) {
	var final = error || result;
	if( final instanceof Error ) {
		reject( final );
	} else {
		resolve( final );
	}
}

function initialize( state, stack, fount, calls ) {
	_.each( calls, function( call, name ) {
		if( _.isString( call ) && _.isNumber( name ) ) {
			var parts = call.split( "." );
			var stackName = parts[ 0 ];
			var callName = parts[ 1 ];
			var sourceStack = state.stacks[ stackName ];
			if( sourceStack ) {
				var step = sourceStack.calls[ callName ];
				if( step ) {
					stack.steps.push( callName );
					stack.calls[ callName ] = step;
				} else {
					console.error( format( 
						"Could not find step named '%s' in stack '%s' as specified by step '%s', it will not be included in the stack", 
						callName, stackName, call
					), name );
				}
			} else {
				console.error( format( 
					"Could not find stack named '%s' as specified by step '%s', it will not be included in the stack", 
					stackName, call
				) );
			}
		}
		else if( _.isFunction( call ) || ( _.isArray( call ) && call[ 0 ].then ) ) {
			name = name || call.name;
			append( stack, fount, call, name );
		}
	} );
}

function insertAfter( stack, fount, step, fn, name ) {
	name = fn.name || name;
	var start = stack.steps.indexOf( step ) + 1;
	stack.steps.splice( start, 0, name );
	addFunction( stack, fount, name, fn );
}

function insertBefore( stack, fount, step, fn, name ) {
	name = fn.name || name;
	var start = stack.steps.indexOf( step );
	stack.steps.splice( start, 0, name );
	addFunction( stack, fount, name, fn );
}

function prepend( stack, fount, fn, name ) {
	name = fn.name || name;
	stack.steps.unshift( name );
	addFunction( stack, fount, name, fn );
}

module.exports = {
	create: createStack
};