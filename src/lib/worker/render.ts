/// <reference lib="webworker" />
import type { StepData } from '$lib/types/actions';
import localforage from 'localforage';
const nodeSize = 20;
const simulationStore = localforage.createInstance({
	name: 'SIMULATION_STORE',
	storeName: 'evolution'
});
let port: MessagePort;
let canvas: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;
let metaYPx: number;
let totalCells = 0;
export function setOffscreenCanvas(_canvas: OffscreenCanvas) {
	canvas = _canvas;
	ctx = canvas.getContext('2d')!;
	if (!ctx) throw new Error(`webgl not available`);
}
export function setCommChannel(_port: MessagePort) {
	if (port) {
		port.close();
		port.removeEventListener('message', handleDataEvent);
	}
	port = _port;
	port.addEventListener('message', handleDataEvent);
	port.start();
}
export async function renderRaw(image: ImageBitmap) {
	ctx.drawImage(image, 0, 0);
}
export async function getStepImage(step: number) {
	const stepData = (await simulationStore.getItem(`${step}`)) as StepData;
	if (!stepData) return;
	stepData.step = step;
	getImage(stepData);
}
export async function setSize({ width, height }: { width: number; height: number }) {
	totalCells = width * height;
	await simulationStore.setItem(`map`, { width, height });
	metaYPx = Math.max(height * nodeSize, 700);
	canvas.width = Math.max(width * nodeSize, 700);
	canvas.height = metaYPx + 84;
	ctx = canvas.getContext('2d')!;
	if (!ctx) throw new Error(`webgl not available`);
}
async function handleDataEvent(_evt: MessageEvent) {
	const event = JSON.parse(_evt.data);
	if (event.event == 'setSize') setSize(event.map);
	else getImage(event);
}
async function getImage(stepData: StepData) {
	if (!stepData) return ``;
	const { cells, cellPositions, step, cellsCreated, cellsDied, ignoredCount, overallTime } =
		stepData;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	const genomeCountsAndColors: Record<
		string,
		{ count: number; color: string; genomeFnId: string; initialGenome: string }
	> = {};
	for (const id of Object.keys(cells || {})) {
		const { x, y } = cellPositions[id];
		const { health, initialGenome, genomeFnId } = cells[id];
		const pixelX = x * nodeSize; // Calculate the actual pixel position from the x value
		const pixelY = y * nodeSize; // Calculate the actual pixel position from the y value
		const genomeColor = getColorFromGenome(initialGenome);
		if (!genomeCountsAndColors[initialGenome])
			genomeCountsAndColors[initialGenome] = {
				count: 0,
				color: genomeColor,
				initialGenome,
				genomeFnId
			};
		genomeCountsAndColors[initialGenome].count++;
		ctx.fillStyle = numberToColor(health, genomeColor);
		ctx.strokeStyle = genomeColor;
		ctx.lineWidth = 1;
		ctx.fillRect(pixelX, pixelY, nodeSize, nodeSize);
		ctx.strokeRect(pixelX + 1, pixelY + 1, nodeSize - 2, nodeSize - 2);
	}
	ctx.fillStyle = 'black';
	ctx.font = '20px serif';
	const live = Object.keys(cells || {}).length;
	ctx.fillText(`Step: ${step}`, 0, metaYPx + 20);
	ctx.fillText(`Live: ${live}`, 0, metaYPx + 40);
	ctx.fillText(`Born: ${cellsCreated}`, 0, metaYPx + 60);
	ctx.fillText(`Died: ${cellsDied}`, 0, metaYPx + 80);
	ctx.fillText(`Ignored: ${ignoredCount}`, 200, metaYPx + 20);
	ctx.fillText(`Empty: ${totalCells - live}`, 200, metaYPx + 40);
	overallTime;
	ctx.fillText(`Time: ${overallTime / 1000}`, 200, metaYPx + 60);
	let offset = 1;
	const genomesList = Object.keys(genomeCountsAndColors)
		.sort((a, b) => {
			return genomeCountsAndColors[a].count > genomeCountsAndColors[b].count
				? 1
				: genomeCountsAndColors[a].count == genomeCountsAndColors[b].count
					? 0
					: -1;
		})
		.reverse();
	for (const genome of genomesList) {
		const { color, count, genomeFnId, initialGenome } = genomeCountsAndColors[genome];
		ctx.fillStyle = color;
		ctx.fillRect(400, metaYPx + 20 * offset - 15, 15, 15);
		ctx.fillStyle = 'black';
		ctx.fillText(
			`Gen${+initialGenome.trim() + 1} - ${genomeFnId}: ${count}`,
			420,
			metaYPx + 20 * offset
		);
		offset++;
	}
}
function numberToColor(num: number, baseColor: string, mem: Record<string, string> = {}) {
	const id = num + baseColor;
	if (mem[id]) return mem[id];
	// Ensure num is between 0 and 99
	num = Math.max(0, Math.min(99, num));
	// Calculate the alpha value based on the number
	const alpha = num / 100;
	// Convert the alpha value to hex
	const alphaHex = Math.floor(alpha * 255)
		.toString(16)
		.padStart(2, '0');
	// Store in mem and
	// Return the color in hex format with alpha
	return (mem[id] = `${baseColor}${alphaHex}`);
}
function getColorFromGenome(genome: string) {
	if (genome == '   0') return `#ff0000`;
	else if (genome == '   1') return `#0000ff`;
	else if (genome == '   2') return `#00ff0a`;
	return `#a300ff`;
}
