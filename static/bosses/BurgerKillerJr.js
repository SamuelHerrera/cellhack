if (cell.health < 1) return 'R';
const emptySurrounding = Object.keys(surroundings).filter((k) => surroundings[k] == 'E');
const enemySurrounding = Object.keys(surroundings).filter(
	(k) => typeof surroundings[k] == 'object' && surroundings[k].genome != cell.genome
);
const friendSurrounding = Object.keys(surroundings).filter(
	(k) => typeof surroundings[k] == 'object' && surroundings[k].genome == cell.genome
);
if (enemySurrounding.length)
	return 'E' + enemySurrounding[Math.floor(Math.random() * enemySurrounding.length)];
if (emptySurrounding.length)
	return 'D' + emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
if (friendSurrounding.length)
	return 'F' + friendSurrounding[Math.floor(Math.random() * friendSurrounding.length)];
return 'R';
