module.exports = function five() {
	return {
		fiveA: {
			one: function( acc, next ) {
				next();
			},
			two: function() {
				return "five a";
			}
		},
		fiveB: {
			one: function( acc, next ) {
				next();
			},
			two: function() {
				return "five b";
			}
		}
	};	
};