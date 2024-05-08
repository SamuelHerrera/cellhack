const emptySurrounding = Object.keys(surroundings).filter(k => surroundings[k] === 'E');
const enemyCount = Object.keys(surroundings).filter(k => surroundings[k] && surroundings[k].gen !== cell.gen).length;
const occupiedCount = Object.keys(surroundings).filter(k => surroundings[k] !== 'E').length;
if (cell.health <= 1) {
    return 'R';
} else if (enemyCount > 3) {
    // Eat if more than 3 surrounding cells are opponents
    return 'E' + Object.keys(surroundings).find(k => surroundings[k] && surroundings[k].gen !== cell.gen);
} else if (emptySurrounding.length > 0) {
    // Find the least occupied zone
    const counts = {
        'T': ['TL', 'T', 'TR'].filter(k => surroundings[k] && surroundings[k] !== 'E').length,
        'B': ['BL', 'B', 'BR'].filter(k => surroundings[k] && surroundings[k] !== 'E').length,
        'L': ['TL', 'L', 'BL'].filter(k => surroundings[k] && surroundings[k] !== 'E').length,
        'R': ['TR', 'R', 'BR'].filter(k => surroundings[k] && surroundings[k] !== 'E').length,
    };
    const direction = Object.keys(counts).reduce((min, cur) => counts[cur] < counts[min] ? cur : min, 'R');
    // Duplicate to the least occupied zone
    return 'D' + direction;
}  else {
    return 'R'; // Rest if no other conditions apply
}