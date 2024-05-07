const randomVal = Math.random();
if(cell.health < 4 || cell.health < 20 && randomVal > 0.5) 
    return 'R'; 
const emptySurrounding = Object.keys(surroundings)
  .filter(k=>surroundings[k] == 'E');
if(randomVal > 0.35 ){
    if(!emptySurrounding.length) return 'R';
    return 'D'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
} else {
   return 'M'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
}