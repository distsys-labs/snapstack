module.exports = function three() {
	return [
		function one( acc, next ) {
			next();
		},
		function two() {
			return "three";
		}
	];	
};