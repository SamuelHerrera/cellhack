## Algorithms

### Random with duplication to the right
```
if(cell.health < 20 && Math.random() > 0.5) 
    return 'R';
return Math.random() > 0.5 
  ? Math.random() > 0.5 
    ? 'ML'
    : 'DR' 
  : Math.random() > 0.5 
    ? 'MT'
    : 'MB';
```

### Pseudo rand + if cell age is even duplication to the right
```
const randomVal = Math.random();
if(cell.health < 20 && randomVal > 0.6) 
    return 'R'; 
return randomVal > 0.35 
  ? cell.age % 2 == 0 
    ? 'ML'
    : 'DR' 
  : randomVal > 0.15 
    ? 'MT'
    : 'MB';
```
### Pseudo rand + detect empty spaces

```
const randomVal = Math.random();
if(cell.health < 20 && randomVal > 0.5) 
    return 'R'; 
const emptySurrounding = Object.keys(surroundings)
  .filter(k=>surroundings[k] == 'E');
if(randomVal > 0.35 ){
    if(!emptySurrounding.length) return 'R';
    return 'D'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
} else {
   return 'M'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
}
```

```
if(cell.health < 20 && Math.random() > 0.5) 
    return 'R'; 
const emptySurrounding = Object.keys(surroundings)
  .filter(k=>surroundings[k] == 'E');
if(!emptySurrounding.length) return 'R';
if(Math.random() > 0.15 ){
    return 'D'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
} else {
   return 'M'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
}
```


```
if(cell.health < 20 && Math.random() > 0.5) 
    return 'R'; 
const emptySurrounding = Object.keys(surroundings)
  .filter(k=>surroundings[k] == 'E');
if(!emptySurrounding.length) return 'R'
return 'D'+emptySurrounding[0];
```
 

 ```
if(cell.health < 20 && Math.random() > 0.5) 
    return 'R'; 
const emptySurrounding = Object.keys(surroundings)
  .filter(k=>surroundings[k] == 'E');
if(!emptySurrounding.length) return 'R';
return 'D'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
 ```

 ```
if(cell.health < 2) return 'R';
const emptySurrounding = Object.keys(surroundings)
  .filter(k=>surroundings[k] == 'E');
if(!emptySurrounding.length) return 'R';
return 'D'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
 ```

 ```
 if(cell.health < 3) return 'R';
const emptySurrounding = Object.keys(surroundings)
  .filter(k=>surroundings[k] == 'E');
const enemySurrounding = Object.keys(surroundings)
  .filter(k=>typeof surroundings[k] == 'object' && surroundings[k].genome!=cell.genome);
if(!emptySurrounding.length) {
  if(enemySurrounding.length){
    return 'A'+enemySurrounding[0]
  } else return 'R'
}
return 'D'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
 ```


 ```
 if(cell.health < 2) return 'R';
const emptySurrounding = Object.keys(surroundings)
  .filter(k=>surroundings[k] == 'E');
const enemySurrounding = Object.keys(surroundings)
  .filter(k=>typeof surroundings[k] == 'object' && surroundings[k].genome!=cell.genome);
if(!emptySurrounding.length) {
  if(enemySurrounding.length){
    return 'A'+enemySurrounding[Math.floor(Math.random() * enemySurrounding.length)]
  } else return 'R'
}
return 'D'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
 ```


 ```
if(cell.health < 2) return 'R';
const emptySurrounding = Object.keys(surroundings)
  .filter(k=>surroundings[k] == 'E');
const enemySurrounding = Object.keys(surroundings)
  .filter(k=>typeof surroundings[k] == 'object' && surroundings[k].genome!=cell.genome);
if(!emptySurrounding.length) {
  if(enemySurrounding.length){
    return 'A'+enemySurrounding[Math.floor(Math.random() * enemySurrounding.length)]
  } else return 'R'
}
const action = Math.random() > 0.5 ? 'D' : 'M';
return action+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];

 ```

 ```
 if(cell.health < 2) return 'R';
const emptySurrounding = Object.keys(surroundings)
  .filter(k=>surroundings[k] == 'E');
const enemySurrounding = Object.keys(surroundings)
  .filter(k=>typeof surroundings[k] == 'object' && surroundings[k].genome!=cell.genome);
if(!emptySurrounding.length) {
  if(enemySurrounding.length){
    return 'E'+enemySurrounding[Math.floor(Math.random() * enemySurrounding.length)]
  } else return 'R'
}
return 'D'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
 ```

```
if(cell.health < 2) return 'R';
const emptySurrounding = Object.keys(surroundings)
  .filter(k=>surroundings[k] == 'E');
const enemySurrounding = Object.keys(surroundings)
  .filter(k=>typeof surroundings[k] == 'object' && surroundings[k].genome!=cell.genome);
const friendSurrounding = Object.keys(surroundings)
  .filter(k=>typeof surroundings[k] == 'object' && surroundings[k].genome==cell.genome);
if(enemySurrounding.length)
  return 'E'+enemySurrounding[Math.floor(Math.random() * enemySurrounding.length)]
if(emptySurrounding.length)
  return 'D'+emptySurrounding[Math.floor(Math.random() * emptySurrounding.length)];
if(friendSurrounding.length)
  return 'F'+friendSurrounding[0]
return 'R'
```