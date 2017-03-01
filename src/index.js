var _ = require( "lodash" );
var format = require( "util" ).format;
var createStack = require( "./stack" ).create;
var modlo = require( "modlo" );

function executeStack( state, fount, stackName, context, acc ) {
	return fount.resolve( stackName )
		.then( function( stack ) {
			return stack.execute( context, acc );
		} );
}

function isAStackSpec( spec ) {
	return _.isFunction( spec ) ||
		( _.isArray( spec ) && spec[ 0 ].when );
}

function load( state, loader, list ) {
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
					.then( processModule.bind( null, state, fount, stackModuleName ) );
			} );
			return Promise.all( promises )
				.then( function( stacks ) {
					return _.reduce( _.filter( _.flatten( stacks ) ), function( acc, stack ) {
						acc[ stack.name ] = stack;
						return acc;
					}, {} );
				} );
		} );
}

function processModule( state, fount, stackModuleName, stackModule ) {
	if( _.isArray( stackModule ) ) {
		if( _.isFunction( stackModule[ 0 ] ) ) {
			return createStack( state, fount, stackModule, stackModuleName );
		} else {
			return _.map( stackModule, function( stack ) {
				return createStack( state, fount, stack );
			} );
		}
	} else {
		if( _.find( _.values( stackModule ), isAStackSpec ) ) {
			return createStack( state, fount, stackModule, stackModule.name || stackModuleName );
		} else {
			return _.map( stackModule, function( stack, name ) {
				if( !_.isString( stack ) ) {
					return createStack( state, fount, stack, name );	
				}
			} );
		}
	}
}

module.exports = function( config ) {
	config = config || {};
	var fount = config.fount || require( "fount" );
	var containerName = config.container || "stack";
	var container = fount( containerName );
	var loader = modlo( { fount: container } );
	var state = {};
	Object.assign( state, {
		stacks: {},
		execute: executeStack.bind( null, state, container ),
		fount: fount,
		load: load.bind( null, state, loader ),
		stack: createStack.bind( null, state, container )
	} );
	return state;
};
