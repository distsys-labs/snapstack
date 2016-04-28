var _ = require( "lodash" );
var functionRegex = /(function\W*)?(\S+\W*)?[(]([^)]*)[)]\W*[{=>]\W*([\s\S]+)?[};]{0,}/m;

var reserved = [ "next", "cb", "callback", "continue", "done" ];

function parseFunction( fn ) {
	var source = fn.toString();
	var parts = functionRegex.exec( source );
	return {
		name: parts[ 2 ],
		arguments: _.filter( parts[ 3 ]
			.replace( /\s/g, "" )
			.split( "," ) ),
		body: parts[ 4 ]
	}
}

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

function resolve() {
	var args = Array.prototype.slice.call( arguments );
	return invokeFount( "resolve", args );	
}

module.exports = {
	getArguments: getArguments,
	getArgumentsFor: getArgumentsFor,
	getContainer: getContainer,
	inject: inject,
	parseFunction: parseFunction,
	resolve: resolve
};
