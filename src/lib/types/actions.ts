export type DirectionV = 'T' | 'B'; // Top, Bottom
export type DirectionH = 'L' | 'R'; // Left, Right
export type Actions = 'M' | 'E' | 'D'; // Move, Eat, Duplicate
export type Communicate = Concat3<['C', DirectionV | DirectionH, string]>;
export type Concat3<T extends string[]> = `${T[0]}${T[1]}${T[2]}`;
export type Concat2<T extends string[]> = `${T[0]}${T[1]}`;
export type ReturnType = Concat2<[Actions, DirectionV | DirectionH]> | Communicate | 'R' | 'N' | 'S'; // Rest, Nothing, SelfDie
export type Surrounding = DirectionV | DirectionH | Concat2<[DirectionV, DirectionH]>;
export type CellInternal = {
	id: string;
	initialGenome: string;
	genomeFnId: string;
	age: number; // 0 means death, 9 means healthy
	health: number; // 0 means death, 9 means healthy
	memory: string;
};
export type CellExternal = {
	genome: string;
};
export type Cell = CellExternal & CellInternal;
// Surrounding, Cell | Empty | Wall
export type CellContext = Record<Surrounding, CellExternal | 'E' | 'W'>;
// Direction + '|' + string, user could infer who is from surroundings
export type Message = Concat2<
	[DirectionV | DirectionH | Concat2<[DirectionV, DirectionH]>, '|', string]
>;
export type CellPosition = {
	x: number;
	y: number;
};
export type StepData = {
	cells: Record<string, Cell>;
	cellPositions: Record<string, CellPosition>;
	step: number;
  totalCells: number;
  cellsCreated: number;
  cellsDied: number;
  ignoredCount: number;
  overallTime: number;
};
