/// <reference lib="webworker" />
import type {
	Surrounding,
	Cell,
	CellPosition,
	CellContext,
	ReturnType,
	Message
} from '$lib/types/actions';
import { evaluator } from '$lib/worker/evaluator';
import localforage from 'localforage';
const simulationStore = localforage.createInstance({
	name: 'SIMULATION_STORE',
	storeName: 'evolution'
});
const positions = ['T', 'B', 'L', 'R', 'TL', 'TR', 'BL', 'BR'] as Surrounding[];

let port: MessagePort;
let metadataPort: MessagePort;
let shouldStop: Promise<boolean> | boolean = false;
let isRunning = false;
export function setCommChannel(_port: MessagePort) {
	port = _port;
}
export function setMetadataChannel(_port: MessagePort) {
	metadataPort = _port;
}
export async function start(
	algorithms: string[],
	map: {
		width: number;
		height: number;
	},
	options?: {
		record?: boolean;
		maxSteps?: number;
		maxMemory?: number;
		maxGenome?: number;
		endCondition?: () => Promise<boolean>;
	}
) {
	if (isRunning) return;
	isRunning = true;
	const initialPositions = [
		{ x: 50, y: 50 },
		{ x: map.width - 1, y: map.width - 1 },
		{ x: map.width - 1, y: 0 },
		{ x: 0, y: map.height - 1 }
	];
	const algorithmDict: Record<string, string> = {};
	const maxMemory = options?.maxMemory || 4;
	const maxGenome = options?.maxGenome || 4;
	let cellsCreated = 0;
	let ignoredCount = 0;
	const cells: Record<string, Cell> = {};
	const cellPositions: { [cellId: string]: CellPosition } = {};
	const cellsByPos: Record<number, Record<number, string>> = {};
	shouldStop = false;
	// Cleanup last execution data
	await simulationStore.clear();
	// Store map size so can be used later to generate map image
	await simulationStore.setItem(`map`, map);
	let algInitialized = 0;
	// Instantiate algorithm functions and the initial seed with a genome Identifier
	for (const alg of algorithms) {
		const genome = `${algInitialized}`.padStart(maxGenome, ' ');
		algorithmDict[genome] = alg;
		const id = `C${cellsCreated}`;
		const cell: Cell = {
			id,
			genome,
			initialGenome: genome,
			age: 0,
			health: 50,
			memory: ''.padStart(maxMemory, ' ')
		};
		cells[id] = cell;
		cellPositions[id] = initialPositions[algInitialized];
		const { x, y } = initialPositions[algInitialized];
		if (!cellsByPos[x]) cellsByPos[x] = {};
		cellsByPos[x][y] = id;
		algInitialized++;
		cellsCreated++;
	}
	let messages: { [cellId: string]: Message[] } = {};
	let step = 0;
	// Storing initial view (step 0)
	if (options?.record) await simulationStore.setItem(`${step}`, { cells, cellPositions });
	// --------------- Start processing steps until max steps or end condition reached -------------------
	while ((!options?.maxSteps || step < options?.maxSteps) && !shouldStop) {
		// Take a snapshot of current state to decouple; so cells, cellPositions continue read only
		const prevCells = JSON.parse(JSON.stringify(cells)) as Record<string, Cell>;
		// Collect messages that are going to be delivered next turn
		const newMessages: { [cellId: string]: Message[] } = {};
		// It holds cells whose health is 0 or less
		const graveyard: { [cellId: string]: boolean } = {};
		// All invalid actions that are going to be ignored on this step
		// Live moving to a wall or occupied cell or two cells trying to use same
		// x,y location so we democratically ignore one of those
		const ignoredActions: { [cellId: string]: ReturnType } = {};
		// Collects all possible actions occurring on a x,y position so if two
		// different cells try to occupy same location we could decide which one ignore
		const overlapActions: Record<
			number,
			Record<
				number,
				{
					cellId: string;
					action: ReturnType;
					prevPos: { x: number; y: number };
				}
			>
		> = {};
		// ------------------- Iterate all living cells------------------------------------------------
		for (const k of Object.keys(prevCells)) {
			// ----------------- Collect surroundings from cell position -----------------------------------------
			const cell = prevCells[k] as Cell;
			const { genome, id } = cell;
			const surroundings = positions.reduce((dict, posKey) => {
				let { x, y } = cellPositions[id];
				if (posKey.includes('T')) y--;
				else if (posKey.includes('B')) y++;
				if (posKey.includes('R')) x++;
				else if (posKey.includes('L')) x--;
				if (prevCells[cellsByPos[x]?.[y]])
					dict[posKey] = {
						genome: prevCells[cellsByPos[x]?.[y]].genome
					};
				else if (y >= map.height || x >= map.width || x < 0 || y < 0) dict[posKey] = 'W';
				else dict[posKey] = 'E';
				return dict;
			}, {} as CellContext);
			// Collect cell messages
			const cellMessages = messages[id];
			// ---------------- Evaluate cell function -------------------------------------------------------------
			const response = (await evaluator(algorithmDict[genome], {
				cell: { ...cell },
				surroundings,
				messages: cellMessages,
				console: {
					log(...args: unknown[]) {
						metadataPort.postMessage({ event: 'log', args });
					}
				}
			})) as ReturnType;
			// ---------------- Processing cell response -------------------------------------------------------------
			cells[k].memory = `${cell.memory || ''}`.padStart(maxMemory, ' ');
			cells[k].genome = `${cell.genome || ''}`.padStart(maxGenome, ' ');
			// Rest
			if (response == 'R') {
				cells[id].health++;
			}
			// Communicate
			else if (response.startsWith('C')) {
				if (!newMessages[id]) newMessages[id] = [];
				newMessages[id].push(response.substring(1) as Message);
			}
			// Eat means: (target - factor) and (cell + factor) where default factor is 1
			else if (response.startsWith('E')) {
				let { x, y } = cellPositions[id];
				if (response.includes('T')) y--;
				else if (response.includes('B')) y++;
				if (response.includes('R')) x++;
				else if (response.includes('L')) x--;
				const targetCell = cells[cellsByPos[x]?.[y]];
				if (targetCell) {
					// Take from target
					targetCell.health--;
					// Feed ourselves
					cells[id].health++;
					// Validate we are alive
					if (cells[id].health > 0 && graveyard[id]) delete graveyard[id];
					// Validate target is still alive
					if (targetCell.health <= 0) graveyard[targetCell.id] = true;
				}
			}
			// Feed means: (target + factor) and (cell - factor) where default factor is 1
			else if (response.startsWith('F')) {
				let { x, y } = cellPositions[id];
				if (response.includes('T')) y--;
				else if (response.includes('B')) y++;
				if (response.includes('R')) x++;
				else if (response.includes('L')) x--;
				const targetCell = cells[cellsByPos[x]?.[y]];
				if (targetCell) {
					// Take from target
					targetCell.health++;
					// Feed ourselves
					cells[id].health--;
					// Validate we are alive
					if (cells[id].health <= 0) graveyard[id] = true;
					// Validate target is still alive
					if (targetCell.health > 0 && graveyard[targetCell.id]) delete graveyard[targetCell.id];
				}
			}
			// Move or Duplicate
			else if (response.startsWith('M') || response.startsWith('D')) {
				let { x, y } = cellPositions[id];
				const prevX = x;
				const prevY = y;
				if (response.includes('T')) y--;
				else if (response.includes('B')) y++;
				if (response.includes('R')) x++;
				else if (response.includes('L')) x--;
				// Is it valid?
				if (cellsByPos[x]?.[y] || y >= map.height || x >= map.width || x < 0 || y < 0) {
					ignoredActions[id] = response;
				} else {
					// Initial set
					if (!overlapActions[x]?.[y]) {
						if (!overlapActions[x]) overlapActions[x] = {};
						overlapActions[x][y] = {
							cellId: cell.id,
							action: response,
							prevPos: {
								x: prevX,
								y: prevY
							}
						};
					}
					// If other action exist on same spot
					else if (
						// Go by age (experience)
						cell.age > prevCells[overlapActions[x]?.[y].cellId].age ||
						// If same age go by randomness to be democratic
						(cell.age == prevCells[overlapActions[x]?.[y].cellId].age && Math.random() < 0.5)
					) {
						ignoredActions[id] = overlapActions[x]?.[y].action;
						if (!overlapActions[x]) overlapActions[x] = {};
						overlapActions[x][y] = {
							cellId: cell.id,
							action: response,
							prevPos: {
								x: prevX,
								y: prevY
							}
						};
					}
				}
			}
			// Decide if we are dead or not, if this happens before other cells turn
			// it gets re evaluated on eat and feed actions anyway
			if (cells[id].health > 0 && graveyard[id]) delete graveyard[id];
			else if (cells[id].health <= 0) graveyard[id] = true;
			// cell gets old and more experienced so they take priority over decisions
			cells[k].age++;
		}
		// ------------------- Living cells iteration ended -------------------------------------------------------
		// Garbage collect all dead cells from this step;
		for (const id of Object.keys(graveyard)) {
			if (!graveyard[id]) continue;
			// Die
			const { x, y } = cellPositions[id];
			delete cellPositions[id];
			delete cells[id];
			delete cellsByPos[x]?.[y];
		}
		// Process all (Move|Duplicate) actions generated on this step
		for (const _x of Object.keys(overlapActions)) {
      const x = +_x;
			for (const _y of Object.keys(overlapActions[x])) {
				const y = +_y;
				const { cellId, action, prevPos } = overlapActions[x][+y];
				if (!cells[cellId]) continue;
				if (action.startsWith('M')) {
					delete cellsByPos[prevPos.x]?.[prevPos.y];
					cellPositions[cellId] = { x, y };
					if (!cellsByPos[x]) cellsByPos[x] = {};
					cellsByPos[x][y] = cellId;
				} else if (action.startsWith('D')) {
					// Divide health by half, other half is assigned to cloned cell
					// When duplicated looks smarter to do it on event numbers since we floor it!
					cells[cellId].health = Math.floor(cells[cellId].health / 2);
					// If cell health goes 0 then it dies when having a baby
					if (cells[cellId].health == 0) {
						graveyard[cellId] = true;
					} else {
						const cloned = JSON.parse(JSON.stringify(cells[cellId]));
						cloned.health = cells[cellId].health;
						cloned.id = `C${cellsCreated}`;
						cells[cloned.id] = cloned;
						cellPositions[cloned.id] = { x, y };
						if (!cellsByPos[x]) cellsByPos[x] = {};
						cellsByPos[x][y] = cloned.id;
						cellsCreated++;
					}
				}
			}
		}
		// Assign messages to be delivered next step
		messages = newMessages;
		step++;
		ignoredCount += Object.keys(ignoredActions).length;
		// Record step
		if (options?.record)
			await simulationStore.setItem(`${step}`, { cells, cellPositions, ignoredCount });
		// Notify step ended
		metadataPort.postMessage({
			event: 'step',
			step,
			cellsCreated,
			totalCells: Object.keys(cells).length,
			ignoredCount
		});
		// port.postMessage({
		// 	step,
		// 	cells,
		// 	cellPositions
		// });
	}
	// --------------- Ended processing steps ------------------------------------------------------------
	isRunning = false;
	port.postMessage({
		step,
		cells,
		cellPositions
	});
}

export function stop() {
	shouldStop = true;
}
