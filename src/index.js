var _ = require( "lodash" );
var when = require( "when" );
var format = require( "util" ).format;
var getArguments = require( "./util" ).getArguments;
var modlo = require( "modlo" );

var callbacks = [ "next", "cb", "callback", "continue", "done" ];

function addFunction( stack, fount, name, fn ) {
	if( _.isFunction( fn ) ) {
		stack.calls[ name ] = wrap( fount, fn );
	} else if( _.isArray( fn ) && fn[ 0 ].then ) {
		stack.calls[ name ] = getDifferentiator( fount, fn );
	} else {
		throw new Error( format( "Cannot add non-function %s to stack: %s", name, fn ) );
	}
}

function append( stack, fount, fn, name ) {
	name = fn.name || name;
	stack.steps.push( name );
	addFunction( stack, fount, name, fn );
}

function attach( stack, fount ) {
	return Object.assign( stack, {
		append: append.bind( null, stack, fount ),
		clone: clone.bind( null, stack, fount ),
		execute: execute.bind( null, stack ),
		insertAfter: insertAfter.bind( null, stack, fount ),
		insertBefore: insertBefore.bind( null, stack, fount ),
		prepend: prepend.bind( null, stack, fount ),
	} );
}

function clone( stack, fount, name ) {
	var copy = _.cloneDeep( stack );
	copy.name = name;
	fount.register( name, copy );
	return attach( copy, fount );
}

function createStack( fount, calls, name ) {
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
	initialize( stack, fount, calls );
	return attach( stack, fount );
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

function executeStack( fount, stackName, context, acc ) {
	return fount.resolve( stackName )
		.then( function( stack ) {
			return execute( stack, context, acc );
		} );
}

function finalize( resolve, reject, error, result ) {
	var final = error || result;
	if( final instanceof Error ) {
		reject( final );
	} else {
		resolve( final );
	}
}

function getDifferentiator( fount, fn ) {
	var list = _.filter( _.map( fn, function( option ) {
		if( _.isFunction( option.when ) ) {
			return {
				when: wrap( fount, option.when ),
				then: wrap( fount, option.then )
			};
		} else if( option.when === true ) {
			return {
				when: function() { return true; },
				then: wrap( fount, option.then )
			};
		} else if( _.isObject( option.when ) ) {
			return {
				when: _.matches( option.when ),
				then: wrap( fount, option.then )
			};
		} else {
			console.error(
				format(
					"A step's 'when' property must be a function or an object instead of '%s'. Option will not be included in potential outcomes."
				), 
				option.when
			);
		}
	} ) );
	return function( context, acc, next ) {
		// this little headache allows when conditions to return a promise
		var promises = _.map( list, function( option ) {
			var pass = option.when( acc );
			var fn = option.then === _.noop ? passthrough : option.then;
			if( pass.then ) {
				return pass.then( function( result ) {
					return { when: result, fn: option.then }
				} );
			} else {
				return when.resolve( { when: pass, fn: option.then } );
			}
		} );
		return when.all( promises )
			.then( function( list ) {
				var option = _.find( list, function( option ) {
					return option.when;
				} );
				if( option ) {
					return option.fn( context, acc, next );	
				} else {
					if( context._lastCall ) {
						return when.reject( new Error( "The call stack failed to meet any of the supported conditions" ) );
					} else {
						next();	
					}
				}
			} );
	};
}

function initialize( stack, fount, calls ) {
	_.each( calls, function( call, name ) {
		if( _.isFunction( call ) || ( _.isArray( call ) && call[ 0 ].then ) ) {
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

function isAStackSpec( spec ) {
	return _.isFunction( spec ) ||
		( _.isArray( spec ) && spec[ 0 ].when );
}

function load( loader, list ) {
	var files =[];
	var names = [];
	list = _.isString( list ) ? [ list ] : list;
	_.each( list, function( x ) { 
		if( /[\/]/.test( x ) ) {
			files.push( x );
		} else {
			names.push( x );
		}
	} );
	return loader.load( { patterns: files, modules: names } )
		.then( function( result ) {
			var fount = result.fount;
			var promises = _.map( result.loaded, function( stackModuleName ) {
				return fount.resolve( stackModuleName )
					.then( processModule.bind( null, fount, stackModuleName ) );
			} );
			return when.all( promises )
				.then( function( stacks ) {
					return _.reduce( _.filter( _.flatten( stacks ) ), function( acc, stack ) {
						acc[ stack.name ] = stack;
						return acc;
					}, {} );
				} );
		} );
}

function passthrough( acc, next ) {
	next();
}

function processModule( fount, stackModuleName, stackModule ) {
	if( _.isArray( stackModule ) ) {
		if( _.isFunction( stackModule[ 0 ] ) ) {
			return createStack( fount, stackModule, stackModuleName );
		} else {
			return _.map( stackModule, function( stack ) {
				return createStack( fount, stack );
			} );
		}
	} else {
		if( _.find( _.values( stackModule ), isAStackSpec ) ) {
			return createStack( fount, stackModule, stackModule.name || stackModuleName );
		} else {
			return _.map( stackModule, function( stack, name ) {
				if( !_.isString( stack ) ) {
					return createStack( fount, stack, name );	
				}
			} );
		}
	}
}

function prepend( stack, fount, fn, name ) {
	name = fn.name || name;
	stack.steps.unshift( name );
	addFunction( stack, fount, name, fn );
}

function wrap( fount, fn ) {
	var argumentList = getArguments( fn ).slice( 1 );
	if( _.includes( callbacks, _.last( argumentList ) ) ) {
		argumentList.pop();
	}
	return function( context, acc, next ) {
		var values = _.reduce( argumentList, function( args, argName ) {
			if( context && context[ argName ] ) {
				args.push( context[ argName ] );
			} else if( acc && acc[ argName ] ) {
				args.push( acc[ argName ] );
			} else if ( fount.canResolve( argName ) ){
				args.push( fount.resolve( argname ) )
			} else {
				args.push( undefined );
			}
			return args;
		}, [ acc ] );
		values.push( next );
		return when.all( values )
			.then( function( result ) {
				var x = fn.apply( context, result );
				if( x && x.then ) {
					return { _promise: x };
				} else {
					return x;
				}
			} );
	};
}

module.exports = function( config ) {
	config = config || {};
	var fount = config.fount || require( "fount" );
	var containerName = config.container || "stack";
	var container = fount( containerName );
	var loader = modlo( { fount: container } );
	return {
		execute: executeStack.bind( null, container ),
		fount: fount,
		load: load.bind( null, loader ),
		stack: createStack.bind( null, container )
	};
};
