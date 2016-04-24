module.exports = function four() {
	return [
		{
			name: "fourA",
			one: function( acc, next ) {
				next();
			},
			two: function() {
				return "four a";
			}
		},
		{
			name: "fourB",
			one: function( acc, next ) {
				next();
			},
			two: function() {
				return "four b";
			}
		}
	];	
};