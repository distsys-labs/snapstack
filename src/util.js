var _ = require( "lodash" );
// var functionRegex = /(function\W*)?(\S+\W*)?[(]?([^)]=>*)[)]?\W*[{=>]\W*([\s\S]+)?[};]{0,}/m;
var functionRegex = /(function)?(\s[a-zA-Z0-9_]*)?[(]?([^=\>)]*)[)]?\W*[{=>]*\W*([\s\S]+)?[};]{0,}/m;
var format = require( "util" ).format;
var reserved = [ "next", "cb", "callback", "continue", "done" ];
var callbacks = [ "next", "cb", "callback", "continue", "done" ];

function getArgumentsFor() {
	var list = Array.prototype.slice.call( arguments, 0 );
	var functions = _.map( list, parseFunction );
	return _.reduce( functions, function( acc, fn ) {
		var functionArgs = fn.arguments.slice( 1 );
		var argList = [ functionArgs ].concat( reserved.concat( acc.arguments ) );
		var args = _.without.apply( null, argList );
		var callbacks = _.intersection( functionArgs, reserved );
		acc.arguments = acc.arguments.concat( args );
		acc.callbacks = _.uniq( acc.callbacks.concat( callbacks ) );
		return acc;
	}, { arguments: ["envelope" ], callbacks: [] } );
}

function getContainer( state, configuration ) {
	return configuration.fount || state.fount;
}

function getArguments( fn ) {
	return parseFunction( fn ).arguments;
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
	var differentiated = function( context, acc, next ) {
		// this little headache allows when conditions to return a promise
		var promises = _.map( list, function( option ) {
			var pass = option.when( acc );
			var fn = option.then === _.noop ? passthrough : option.then;
			if( pass.then ) {
				return pass.then( function( result ) {
					return { when: result, fn: option.then }
				} );
			} else {
				return Promise.resolve( { when: pass, fn: option.then } );
			}
		} );
		return Promise.all( promises )
			.then( function( list ) {
				var option = _.find( list, function( option ) {
					return option.when;
				} );
				if( option ) {
					return option.fn( context, acc, next );	
				} else {
					if( context._lastCall ) {
						return Promise.reject( new Error( "The call stack failed to meet any of the supported conditions" ) );
					} else {
						next();	
					}
				}
			} );
	};
	differentiated._wrapped = true;
	return differentiated;
}

function invokeFount( call, args ) {
	var state = args.shift();
	var configuration = args.shift();
	var container = getContainer( state, configuration );
	return container[ call ].apply( container, args );
}

function inject() {
	var args = Array.prototype.slice.call( arguments );
	return invokeFount( "inject", args );
}

function parseFunction( fn ) {
	var source = fn.toString();
	var parts = functionRegex.exec( source );
	return {
		name: parts[ 2 ] ? parts[ 2 ].trim() : undefined,
		arguments: _.filter( parts[ 3 ]
			.replace( /\s/g, "" )
			.split( "," ) ),
		body: parts[ 4 ]
	}
}

function passthrough( acc, next ) {
	next();
}

function resolve() {
	var args = Array.prototype.slice.call( arguments );
	return invokeFount( "resolve", args );	
}

function wrap( fount, fn ) {
	var argumentList = getArguments( fn ).slice( 1 );
	if( _.includes( callbacks, _.last( argumentList ) ) ) {
		argumentList.pop();
	}
	var wrapped = function( context, acc, next ) {
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
		return Promise.all( values )
			.then( function( result ) {
				var x = fn.apply( context, result );
				if( x && x.then ) {
					return { _promise: x };
				} else {
					return x;
				}
			} );
	};
	wrapped._wrapped = true;
	return wrapped;
}

module.exports = {
	getArguments: getArguments,
	getArgumentsFor: getArgumentsFor,
	getContainer: getContainer,
	getDifferentiator: getDifferentiator,
	inject: inject,
	passthrough: passthrough,
	parseFunction: parseFunction,
	resolve: resolve,
	wrap: wrap
};
