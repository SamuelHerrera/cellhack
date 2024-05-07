if(cell.health < 2) return 'R';
const emptySurrounding = [];
const enemySurrounding = [];
for(const side of Object.keys(surroundings)){
  if(surroundings[side] == 'E') emptySurrounding.push(side)
  if(typeof surroundings[side] == 'object' && surroundings[side].genome!=cell.genome) emptySurrounding.push(side)
}
if(!emptySurrounding.length) {
  if(enemySurrounding.length){
    return 'E'+enemySurrounding[Math.floor(Math.random() * enemySurrounding.length)]
  } else return 'R'
}
return 'D'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];