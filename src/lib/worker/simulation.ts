/// <reference lib="webworker" />
import type {
	Surrounding,
	Cell,
	CellPosition,
	CellContext,
	ReturnType,
	Message
} from '$lib/types/actions';
import localforage from 'localforage';
import { fnEvaluator } from './fnEvaluator';
const simulationStore = localforage.createInstance({
	name: 'SIMULATION_STORE',
	storeName: 'evolution'
});
const positions = ['T', 'TR', 'R', 'BR', 'B', 'BL', 'L', 'TL'] as Surrounding[];
let port: MessagePort;
let metadataPort: MessagePort;
let shouldStop: boolean = false;
let isRunning = false;
export function setCommChannel(_port: MessagePort) {
	port = _port;
}
export function setMetadataChannel(_port: MessagePort) {
	metadataPort = _port;
}
export async function start(
	algorithms: (
		| {
				code: string;
				id: string;
		  }
		| undefined
	)[],
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
	const nonEmptyCodeCount = algorithms.filter((alg) => !!alg?.code).length;
	if (!nonEmptyCodeCount) return;
	const consoleProxy = {
		log(...args: unknown[]) {
			metadataPort.postMessage({ event: 'log', args, time: new Date().toISOString() });
		},
		info(...args: unknown[]) {
			metadataPort.postMessage({ event: 'info', args, time: new Date().toISOString() });
		},
		warn(...args: unknown[]) {
			metadataPort.postMessage({ event: 'warn', args, time: new Date().toISOString() });
		},
		error(...args: unknown[]) {
			metadataPort.postMessage({ event: 'error', args, time: new Date().toISOString() });
		},
		debug(...args: unknown[]) {
			metadataPort.postMessage({ event: 'debug', args, time: new Date().toISOString() });
		}
	};
	isRunning = true;
	shouldStop = false;
	const initialPositions = [
		{ x: 0, y: 0 },
		{ x: map.width - 1, y: 0 },
		{ x: map.width - 1, y: map.height - 1 },
		{ x: 0, y: map.height - 1 }
	];
	const algorithmDict: Record<string, (context: Record<string, unknown>) => Promise<ReturnType>> =
		{};
	const maxMemory = options?.maxMemory || 4;
	const maxGenome = options?.maxGenome || 4;
	let cellsCreated = 0;
	let cellsDied = 0;
	let ignoredCount = 0;
	const startTime = new Date().getTime();
	const cells: Record<string, Cell> = {};
	const cellPositions: { [cellId: string]: CellPosition } = {};
	const cellsByPos: Record<number, Record<number, string>> = {};
	// Cleanup last execution data
	await simulationStore.clear();
	port.postMessage(
		JSON.stringify({
			event: 'setSize',
			map
		})
	);
	let algInitialized = 0;
	// Instantiate algorithm functions and the initial seed with a genome Identifier
	for (const alg of algorithms) {
		if (!alg) {
			algInitialized++;
			continue;
		}
		const genome = `${algInitialized}`.padStart(maxGenome, ' ');
		algorithmDict[genome] = fnEvaluator(alg.code);
		const id = `C${cellsCreated}`;
		const cell: Cell = {
			id,
			genome,
			initialGenome: genome,
			genomeFnId: alg.id,
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
	if (options?.record)
		await simulationStore.setItem(`${step}`, {
			cells,
			cellPositions,
			cellsCreated,
			cellsDied,
			ignoredCount,
			startTime
		});
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
		const distinctGen = new Set();
		// ------------------- Iterate all living cells------------------------------------------------
		for (const k of Object.keys(prevCells)) {
			// ----------------- Collect surroundings from cell position -----------------------------------------
			const cell = prevCells[k] as Cell;
			const { genome, id, initialGenome } = cell;
			distinctGen.add(initialGenome);
			// Age the cell to die
			cells[id].health -= Math.min(cells[k].age / 100, 0.3);
			// Cell gets old and more experienced so they take priority over decisions
			cells[k].age++;
			cell.health = cells[id].health;
			let occupiedCount = 0;
			const surroundings = positions.reduce((dict, posKey) => {
				let { x, y } = cellPositions[id];
				if (posKey.includes('T')) y--;
				else if (posKey.includes('B')) y++;
				if (posKey.includes('R')) x++;
				else if (posKey.includes('L')) x--;
				if (prevCells[cellsByPos[x]?.[y]]) {
					dict[posKey] = {
						genome: prevCells[cellsByPos[x]?.[y]].genome
					};
					occupiedCount++;
				} else if (y >= map.height || x >= map.width || x < 0 || y < 0) {
					dict[posKey] = 'W';
					occupiedCount++;
				} else dict[posKey] = 'E';
				return dict;
			}, {} as CellContext);
			// Collect cell messages
			const cellMessages = messages[id];
			// ------------ Evaluate cell function ---------------------------
			const cellExposed = { ...cell };
			const response = (await algorithmDict[genome]({
				cell: cellExposed,
				surroundings,
				messages: cellMessages,
				console: consoleProxy,
				fetch: function () {}
			})) as ReturnType;
			// ---------------- Processing cell response -------------------------------------------------------------
			cells[k].memory = `${cellExposed.memory || ''}`.padStart(maxMemory, ' ');
			cells[k].genome = `${cellExposed.genome || ''}`.padStart(maxGenome, ' ');
			// Rest
			if (response == 'R') {
				cells[id].health = Math.min(cells[id].health + 1 - occupiedCount / 10, 99);
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
				const targetId = cellsByPos[x][y];
				if (cells[targetId]) {
					// Take from target
					const donation = Math.min(cells[targetId].health, 1);
					if (donation < 1) cells[targetId].health = 0;
					else cells[targetId].health--;
					// Feed ourselves
					cells[id].health = Math.min(cells[id].health + donation, 99);
					// Validate we are alive
					if (cells[id].health > 0 && graveyard[id]) delete graveyard[id];
					// Validate target is still alive
					if (cells[targetId].health <= 0) graveyard[targetId] = true;
				}
			}
			// Feed means: (target + factor) and (cell - factor) where default factor is 1
			else if (response.startsWith('F')) {
				let { x, y } = cellPositions[id];
				if (response.includes('T')) y--;
				else if (response.includes('B')) y++;
				if (response.includes('R')) x++;
				else if (response.includes('L')) x--;
				const targetId = cellsByPos[x][y];
				if (cells[targetId]) {
					// Take from ourselves
					const donation = Math.min(cells[id].health, 1);
					if (donation < 1) cells[id].health = 0;
					else cells[id].health--;
					// Give to target
					cells[targetId].health = Math.min(cells[targetId].health + donation, 99);
					// Validate we are alive
					if (cells[id].health <= 0) graveyard[id] = true;
					// Validate target is still alive
					if (cells[targetId].health > 0 && graveyard[targetId]) delete graveyard[targetId];
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
				if (
					// Is cell occupied?
					cellsByPos[x]?.[y] ||
					// Or is at the wall boundaries
					y >= map.height ||
					x >= map.width ||
					x < 0 ||
					y < 0
				) {
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
		}
		if (nonEmptyCodeCount > 1 && Array.from(distinctGen.keys()).length <= 1) {
			shouldStop = true;
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
			cellsDied++;
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
					cells[cellId].health = cells[cellId].health / 2;
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
		const overallTime = new Date().getTime() - startTime;
		// Record step
		if (options?.record)
			await simulationStore.setItem(`${step}`, {
				cells,
				cellPositions,
				cellsCreated,
				cellsDied,
				ignoredCount,
				overallTime
			});
		metadataPort.postMessage({ event: 'lastProcessedStep', step });
		// Notify to render
		port.postMessage(
			JSON.stringify({
				step,
				cells,
				cellPositions,
				cellsCreated,
				cellsDied,
				ignoredCount,
				overallTime
			})
		);
	}
	// --------------- Ended processing steps ------------------------------------------------------------
	isRunning = false;
	const overallTime = new Date().getTime() - startTime;
	port.postMessage(
		JSON.stringify({
			step,
			cells,
			cellPositions,
			cellsCreated,
			cellsDied,
			ignoredCount,
			overallTime
		})
	);
}
