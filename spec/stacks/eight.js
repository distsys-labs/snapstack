var _ = require( "lodash" );
module.exports = function( one ) {
	var eight = _.cloneDeep( one );
	eight[ "two" ] = function () {
		return "eight";
	};
	return eight;
}