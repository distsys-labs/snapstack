module.exports = function nine() {
	return {
		// uno only supplies one condition and because
		// it is _not_ the last step in the stack,
		// it will just skip the step when the condition
		// isn't met
		uno: [
			{
				when: function( acc, x, z ) {
					return x && z && x + z > 50; 
				},
				then: function( acc, x, next ) {
					return x;
				}
			}
		],
		// this step doesn't have a default condition
		// so that the error/rejection branch gets tested
		// there's also a totally invalid condition here which
		// gets ignored and logs to the console
		dose: [
			{
				when: { y: "nine" },
				then: function( acc, y ) {
					return y;
				}
			},
			{
				then: function() {
					// this will get discarded
				}
			}
		]
	};	
};