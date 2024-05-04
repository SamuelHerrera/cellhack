/// <reference lib="webworker" />
import { throttle } from '$lib/throttle';
import type { StepData } from '$lib/types/actions';
import localforage from 'localforage';
const nodeSize = 5;
const simulationStore = localforage.createInstance({
	name: 'SIMULATION_STORE',
	storeName: 'evolution'
});
let port: MessagePort;
let renderPort: MessagePort;
export function setCommChannel(_port: MessagePort) {
	if (port) {
		port.close();
		port.removeEventListener('message', handleDataEvent);
	}
	port = _port;
	port.addEventListener('message', handleDataEvent);
	port.start();
}
export function setRenderChannel(_port: MessagePort) {
	renderPort = _port;
}
export async function getStepImage(stepData: StepData) {
	if (!stepData) return ``;
	const map = (await simulationStore.getItem(`map`)) as {
		width: number;
		height: number;
	};
	if (!map) return ``;
	const { width, height } = map;
	const { cells, cellPositions, step } = stepData;
	const canvas = new OffscreenCanvas(width * nodeSize, height * nodeSize);
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error(`webgl not available`);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	for (const id of Object.keys(cells)) {
		const { x, y } = cellPositions[id];
		const { health, genome } = cells[id];
		const pixelX = x * nodeSize; // Calculate the actual pixel position from the x value
		const pixelY = y * nodeSize; // Calculate the actual pixel position from the y value
		const genomeColor = getColorFromGenome(genome);
		ctx.fillStyle = numberToColor(health, genomeColor);
		ctx.strokeStyle = genomeColor;
		ctx.lineWidth = 1;
		ctx.fillRect(pixelX, pixelY, nodeSize, nodeSize);
		ctx.strokeRect(pixelX, pixelY, nodeSize, nodeSize);
	}
  ctx.fillStyle = "black";
  ctx.font = "20px serif";
  ctx.fillText(`${step}`, 0, 20);
	const dataBlob = await canvas.convertToBlob();
	const reader = new FileReader();
	return new Promise<string>((ok) => {
		reader.addEventListener('load', () => ok(reader.result as string));
		reader.readAsDataURL(dataBlob);
	});
}
async function handleDataEvent(_evt: MessageEvent) {
	const evt = _evt.data;
	renderStepThrottled(evt);
}
const renderStepThrottled = throttle(async (stepData: StepData) => {
	if (renderPort) renderPort.postMessage(await getStepImage(stepData));
}, 100);
function numberToColor(num: number, baseColor: string) {
	// Ensure num is between 0 and 99
	num = Math.max(0, Math.min(99, num));
	// Calculate the alpha value based on the number
	const alpha = num / 100;
	// Convert the alpha value to hex
	const alphaHex = Math.floor(alpha * 255)
		.toString(16)
		.padStart(2, '0');
	// Return the color in hex format with alpha
	return `${baseColor}${alphaHex}`;
}
function getColorFromGenome(genome: string) {
	if (genome == '   0') return `#ff0000`;
	else if (genome == '   1') return `#0000ff`;
	else if (genome == '   2') return `#00ff0a`;
	return `#edff00`;
}
