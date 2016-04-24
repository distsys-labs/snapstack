var _ = require( "lodash" );
var argumentRegex = /^(function\s*\w*\s*)?[(](.*)[)]\s*(=>)?\s*[{]/;

function getContainer( state, configuration ) {
	return configuration.fount || state.fount;
}

function getArguments( fn ) {
	var match = argumentRegex.exec( fn.toString() );
	return _.filter( match[ 2 ]
		.replace( /\s/g, "" )
		.split( "," ) );
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
	getContainer: getContainer,
	inject: inject,
	resolve: resolve
};
