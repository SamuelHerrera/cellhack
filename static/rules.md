- Each Gen starts with 1 cell
- All cells algorithms gets executed exactly 1 time per step
- A return action(string) must be returned or the cell does nothing on the step *cell.health still linearly decrease*
- Cell actions are: Rest, Die, Eat, Feed, Move, Duplicate and Communicate.
- From a cell perspective the possible 8 surrounding directions are: 'T', 'TR', 'R', 'BR', 'B', 'BL', 'L', 'TL'. Where T:Top, B:Bottom, R:Right and L:Left.
- When a returned action is EAT the cell takes 1 from target (or less if target health is less than 1), no matter if target is of same Gen or not. then increase our health in that factor
- FEED is the same as EAT but in the inverse direction
- DUPLICATE split the cell energy by half
- Cells have age, and this is used to resolve conflicts
- Cell health linearly decrease with a factor of 0 to 0.3 on each step, maximum factor is reached at age of 100; 
  - Formula is: cell.health -= Math.min(cell.age / 100, 0.3);
  - So Step Decrease Factor goes from 0.01 when the cell is born to 0.3 when cell age is 100
- Following function determine how much energy the cell can restore when returned action is REST(R):
  - cell.health = Math.min(cell.health + 1 - occupiedCount / 10, 99);
  - Where 'occupiedCount' is the count of the surrounding cells, walls included, values are 0 to 8 so the minimum energy a cell can rest is 0.2 and max is 1
- All cells whose energy is 0 or less at the end of step are marked dead and get removed from the simulation
- To solve conflicts we initially use the cell age to determine who wins, so the more experienced cell WIN. If both cells have same age WINNER is decided randomly
- Cells can access global variables: 'cell', 'surroundings' and 'messages. 
  - cell is an object containing cell health, age, gen and memory
  - surroundings are the 8 other positions (objects who only includes the genome string to detect enemies), Walls 'W' or empty spaces 'E'
  - messages is an array of string containing the messages


## The possible actions that can be returned:

- Rest (R) 
  - 'R'
- Die, yeah just die.
  - 'S'
- Eat (E + (direction))
  - 'ET', 'ETR', 'ER', 'EBR', 'EB', 'EBL', 'EL', 'ETL'
- Feed (E + (direction))
  - 'FT', 'FTR', 'FR', 'FBR', 'FB', 'FBL', 'FL', 'FTL'
- Move (M + (direction))
  - 'MT', 'MTR', 'MR', 'MBR', 'MB', 'MBL', 'ML', 'MTL'
- Duplicate (D + (direction))
  - 'DT', 'DTR', 'DR', 'DBR', 'DB', 'DBL', 'DL', 'DTL'
- Communicate (C + (direction) + : + message)
  - 'CT:anyLengthMessageString', 'CTR:anyLengthMessageString', 'CR:anyLengthMessageString', 'CBR:anyLengthMessageString', 'CB:anyLengthMessageString', 'CBL:anyLengthMessageString', 'CL:anyLengthMessageString', 'CTL:anyLengthMessageString'

## Code sandbox

- Cell code is JS that runs inside a web worker
- Code is wrapped inside an async function that sandboxes the context (this)
- fetch, sessionStorage, localStorage, IndexedDB are not available (are mocks that does nothing)
- console and its methods: log, warn, error, debug, info are redirected from worker to tab log
- Best performance is achieved when the inspector tool is closed
- Other symbols are allowed: setTimeout, setInterval, Promise, await (at root level) but be cautious of the performance impact, only limitation is the HONOR rule to not break others systems.