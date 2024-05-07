if(cell.health < 2) return 'R';
const directions = [];
if(surroundings['L']=='E') directions.push('L');
if(surroundings['R']=='E') directions.push('R');
if(surroundings['T']=='E') directions.push('T');
if(surroundings['B']=='E') directions.push('L');
if(surroundings['TL']=='E') directions.push('TL');
if(surroundings['TR']=='E') directions.push('TR');
if(surroundings['BL']=='E') directions.push('BL');
if(surroundings['BR']=='E') directions.push('BR');
return 'D' + directions[Math.floor(Math.random() * directions.length)]; 