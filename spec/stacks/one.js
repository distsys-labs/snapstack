module.exports = function one() {
	return {
		one: function( acc, next ) {
			next();
		},
		two: function() {
			return "one";
		}
	};	
};