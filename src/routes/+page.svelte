<script lang="ts">
	import { codemirror } from '$lib/codemirror-action';
	import { getRenderPort, getMetadataPort, simulationWorker } from '$lib/workers';
	import { onMount } from 'svelte';
	let image: HTMLImageElement;
	let port: MessagePort;
	let metadataPort: MessagePort;
	let lastProcessedStep = 0;
	let lastPaintedStep = 0;
	let currentStep = 0;
	let cellsCreated = 0;
	let totalCells = 0;
	let ignoredCount = 0;
	let maxSteps = 500;
	let src = '';
	let code = `if(cell.health < 2) return 'R';
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
`;

	let codemirrorOptions = {
		options: {
			value: code,
			language: 'javascript'
		},
		onChange
	};
	async function start() {
		src = '';
		currentStep = 0;
		lastPaintedStep = 0;
		console.time('simulation');
		await simulationWorker?.start(
			[code, code],
			{
				width: 100,
				height: 100
			},
			{
				maxGenome: 4,
				maxSteps,
				maxMemory: 16
			}
		);
		console.timeEnd('simulation');
	}
	async function stop() {
		await simulationWorker?.stop();
	}
	function handleMessage(evt: MessageEvent) {
		if (evt.data.event == 'step') {
			const { step, cellsCreated: cc, totalCells: tc, ignoredCount: ic } = evt.data;
			lastProcessedStep = currentStep = step;
			cellsCreated = cc;
			totalCells = tc;
			ignoredCount = ic;
		}
		if (evt.data.event == 'log') console.log(evt.data.args);
	}
	function handleRenderMessage(evt: MessageEvent) {
		src = evt.data;
	}
	function onChange(evt: string) {
		code = evt;
	}

	onMount(() => {
		port = getRenderPort();
		port.addEventListener('message', handleRenderMessage);
		port.start();
		metadataPort = getMetadataPort();
		metadataPort.addEventListener('message', handleMessage);
		metadataPort.start();
		return () => {
			port.removeEventListener('message', handleRenderMessage);
			metadataPort.removeEventListener('message', handleMessage);
		};
	});
</script>

<div class="flex w-full h-full justify-start items-center">
	<div class="flex flex-col justify-start items-center w-[50%] h-full">
		<div class="w-full h-full" use:codemirror={codemirrorOptions} />
	</div>
	<div class="flex flex-col justify-start items-center w-[50%] h-full">
		<div
			class="bg-white border border-sky-200 rounded shadow-lg
      w-[500px] h-[500px] mb-4 mt-2"
		>
			<img
				hidden={!src}
				{src}
				alt=""
				class="w-[500px] h-[500px] bg-transparent"
				bind:this={image}
			/>
		</div>
		<div class="flex items-center w-full pl-6 pr-6">
			<div class="flex-grow" />

			<span class="mr-4">
				ignored actions: {ignoredCount}
			</span>
			<span class="mr-4">
				total: {totalCells}
			</span>
			<span class="mr-4">
				created: {cellsCreated}
			</span>
			<span class="mr-4">
				Step: {currentStep}
			</span>
			<span>
				Steps: {lastProcessedStep}
			</span>
		</div>
		<div class="flex items-center w-full pl-6 pr-6">
			<div class="flex items-center">
				<input
					id="max-steps"
					class="mr-2"
					type="number"
					min="0"
					max="99999"
					step="1"
					bind:value={maxSteps}
				/>
				<button
					class="border border-transparent hover:border-sky-400 bg-gray-200 rounded pl-3 pr-3 mr-2"
					on:click={start}>Start</button
				>
				<button
					class="border border-transparent hover:border-sky-400 bg-gray-200 rounded pl-3 pr-3"
					on:click={stop}>Stop</button
				>
			</div>
			<div class="flex-grow" />
			<input type="range" min="0" max={lastProcessedStep} bind:value={currentStep} />
		</div>
	</div>
</div>
