<script lang="ts">
	import { monaco } from '$lib/monaco-action';
	import { debounce } from '$lib/debouncer';
	import { getMetadataPort, simulationWorker, renderWorker, restartWorkers } from '$lib/workers';
	import { transfer } from 'comlink';
	import localforage from 'localforage';
	import { onMount, tick } from 'svelte';
	const simulationStore = localforage.createInstance({
		name: 'SIMULATION_STORE',
		storeName: 'evolution'
	});
	let dialog: HTMLDialogElement;
	let canvasRef: HTMLCanvasElement;
	let offscreenCanvas: OffscreenCanvas;
	let metadataPort: MessagePort;
	let lastProcessedStep = 0;
	let currentStep = 0;
	let maxSteps = localStorage['maxSteps'] ? +localStorage['maxSteps'] : 500;
	let code = ``;
	let width = localStorage['width'] ? +localStorage['width'] : 50;
	let height = localStorage['height'] ? +localStorage['height'] : 50;
	let record = localStorage['record'] == 'true';
	let bosses: string[] = [];
	let defaultBosses: string[] = [];
	let userBosses: Record<string, string> = localStorage['userBosses']
		? JSON.parse(localStorage['userBosses'])
		: {};
	let currentCodeId = localStorage['currentCodeId'] || bosses?.[0] || '';
	const selectedBosses: Record<string, string> = localStorage['selectedBosses']
		? JSON.parse(localStorage['selectedBosses'])
		: {};
	const debouncedRender = debounce(renderStep, 50);
	let logs: { level: string; message: string }[] = [];
	$: localStorage['selectedBosses'] = JSON.stringify(selectedBosses);
	$: localStorage['maxSteps'] = maxSteps;
	$: localStorage['width'] = width;
	$: localStorage['height'] = height;
	$: localStorage['record'] = record;
	$: localStorage['currentCodeId'] = currentCodeId;
	$: localStorage['userBosses'] = JSON.stringify(userBosses);
	$: readOnly = defaultBosses.includes(currentCodeId);
	$: lbList = Object.keys(userBosses);
	$: bosses = [...lbList, ...defaultBosses];
	$: bosses, loadCode(currentCodeId);
	$: codemirrorOptions = {
		options: {
			value: code,
			language: 'javascript',
			readOnly,
			automaticLayout: true
		},
		onChange
	};
	$: debouncedRender(currentStep);
	$: shouldHideEditorBtn = !currentCodeId || defaultBosses.includes(currentCodeId);
	async function start() {
		currentStep = 0;
		logs = [{ level: 'log', message: `Started simulation ${new Date().toLocaleString()}` }];
		const algorithms = [];
		for (let idx = 1; idx < 5; idx++) {
			const id = selectedBosses['Gen' + idx];
			if (defaultBosses.includes(id)) {
				algorithms.push({
					code: await fetch(`/bosses/${id}.js`).then((res) => res.text()),
					id
				});
			} else if (userBosses[id]) {
				algorithms.push({
					code: userBosses[id],
					id
				});
			} else {
				algorithms.push(undefined);
			}
		}
		await simulationWorker?.start(
			algorithms,
			{
				width,
				height
			},
			{
				maxGenome: 4,
				maxSteps,
				maxMemory: 16,
				record
			}
		);
	}
	async function loadCode(id: string) {
		if (defaultBosses.includes(id))
			code = await fetch(`/bosses/${id}.js`).then((res) => res.text());
		else if (userBosses[id]) code = userBosses[id];
		else code = '';
	}
	async function stop() {
		metadataPort?.removeEventListener('message', handleMessage);
		const lastRender = canvasRef.toDataURL('image/png');
		const canvas = canvasRef.cloneNode(true) as HTMLCanvasElement;
		const { metadataPort: mp } = restartWorkers();
		canvasRef.replaceWith(canvas);
		canvasRef = canvas;
		await tick();
		offscreenCanvas = canvas.transferControlToOffscreen();
		await renderWorker?.setOffscreenCanvas(transfer(offscreenCanvas, [offscreenCanvas]));
		const destinationImage = new Image();
		destinationImage.onload = async () => {
			const imgBmp = await createImageBitmap(destinationImage);
			renderWorker?.renderRaw(transfer(imgBmp, [imgBmp]));
		};
		destinationImage.src = lastRender;
		metadataPort = mp;
		metadataPort.addEventListener('message', handleMessage);
		metadataPort.start();
		await renderWorker?.setSize({
			width,
			height
		});
	}
	async function renderStep(step: number) {
		await renderWorker?.getStepImage(step);
	}
	function handleMessage(evt: MessageEvent) {
		if (evt.data.event == 'log') console.log(evt.data.args);
		else if (evt.data.event == 'info') console.info(evt.data.args);
		else if (evt.data.event == 'warn') console.warn(evt.data.args);
		else if (evt.data.event == 'error') console.error(evt.data.args);
		else if (evt.data.event == 'debug') console.debug(evt.data.args);
		else if (evt.data.event == 'lastProcessedStep') lastProcessedStep = evt.data.step;
	}
	function onChange(evt: string) {
		code = evt;
		if (!userBosses || !currentCodeId || defaultBosses.includes(currentCodeId)) return;
		userBosses = { ...userBosses, [currentCodeId]: code };
		localStorage['userBosses'] = JSON.stringify(userBosses);
	}
	function deleteGen() {
		const response = confirm('Confirm deletion of ' + currentCodeId);
		if (!response) return;
		if (defaultBosses.includes(currentCodeId)) return;
		delete userBosses[currentCodeId];
		userBosses = { ...userBosses };
		currentCodeId = Object.keys(userBosses)[0] || '';
	}
	async function cloneGen() {
		const name = prompt('Clone name ' + currentCodeId, 'clon_' + currentCodeId);
		if (!name) return;
		if (defaultBosses.includes(currentCodeId))
			userBosses[name] = await fetch(`/bosses/${currentCodeId}.js`).then((res) => res.text());
		else userBosses[name] = code;
		userBosses = { ...userBosses };
		currentCodeId = name;
	}
	function newGen() {
		const name = prompt('New gen name', 'Gen' + `${Math.random()}`.padStart(4, ''));
		if (!name) return;
		userBosses[name] = ``;
		userBosses = { ...userBosses };
		currentCodeId = name;
	}
	function renameGen() {
		const name = prompt('Rename gen ' + currentCodeId, currentCodeId);
		if (!name) return;
		userBosses[name] = userBosses[currentCodeId];
		delete userBosses[currentCodeId];
		userBosses = { ...userBosses };
		currentCodeId = name;
	}
	onMount(() => {
		metadataPort = getMetadataPort();
		metadataPort.addEventListener('message', handleMessage);
		metadataPort.start();
		Promise.all([fetch('/bosses/bosses.json').then((res) => res.json())]).then(
			([_bosses]) => (defaultBosses = _bosses)
		);
		simulationStore.keys().then((keys) => (lastProcessedStep = keys.length - 2));
		renderWorker?.setSize({
			width,
			height
		});
		offscreenCanvas = canvasRef.transferControlToOffscreen();
		renderWorker?.setOffscreenCanvas(transfer(offscreenCanvas, [offscreenCanvas]));
		return () => metadataPort.removeEventListener('message', handleMessage);
	});
</script>

<div class="flex w-full h-full justify-start items-center">
	<div class="half bg-sky-200">
		<div class="w-full flex items-center p-1 pb-0">
			<select name="editor" id="editor" title="Select gen to edit" bind:value={currentCodeId}>
				<option value="">Not selected</option>
				{#each bosses as boss (boss)}
					<option value={boss}>{boss}{defaultBosses.includes(boss) ? ' (readonly)' : ''}</option>
				{/each}
			</select>
			<div class="flex-grow"></div>
			<button
				on:click={renameGen}
				title="Delete gen"
				class="ml-1"
				class:hidden={shouldHideEditorBtn}>Rename</button
			>
			<button
				on:click={deleteGen}
				title="Delete gen"
				class="ml-1"
				class:hidden={shouldHideEditorBtn}>Delete</button
			>
			<button on:click={cloneGen} title="Clone gen" class="ml-1" class:hidden={!currentCodeId}
				>Clone</button
			>
			<button on:click={newGen} title="New gen" class="ml-1">New</button>
		</div>
		<div class="w-full h-full p-1">
			<div class="w-full h-full flex-grow">
				<div class="w-full h-full rounded-lg overflow-hidden" use:monaco={codemirrorOptions} />
			</div>
		</div>
	</div>
	<div class="half">
		<div class="flex w-full flex-wrap pl-1 pr-1 pt-1">
			<div class="section">
				<label for="Gen1"
					>Gen1:
					<select name="Gen1" id="Gen1" bind:value={selectedBosses['Gen1']}>
						<option value="">Not selected</option>
						{#each bosses as boss (boss)}
							<option value={boss}>{boss}</option>
						{/each}
					</select>
				</label>
				<label for="Gen2"
					>Gen2:
					<select name="Gen2" id="Gen2" bind:value={selectedBosses['Gen2']}>
						<option value="">Not selected</option>
						{#each bosses as boss (boss)}
							<option value={boss}>{boss}</option>
						{/each}
					</select>
				</label>
				<label for="Gen3"
					>Gen3:
					<select name="Gen3" id="Gen3" bind:value={selectedBosses['Gen3']}>
						<option value="">Not selected</option>
						{#each bosses as boss (boss)}
							<option value={boss}>{boss}</option>
						{/each}
					</select>
				</label>
				<label for="Gen4"
					>Gen4:
					<select name="Gen4" id="Gen4" bind:value={selectedBosses['Gen4']}>
						<option value="">Not selected</option>
						{#each bosses as boss (boss)}
							<option value={boss}>{boss}</option>
						{/each}
					</select>
				</label>
			</div>
			<div class="section">
				<label for="max-steps" class="w-full"
					>Max. steps:
					<input
						id="max-steps"
						class="ml-2"
						type="number"
						min="0"
						max="99999"
						step="1"
						bind:value={maxSteps}
					/>
				</label>
				<div class="flex w-full">
					<label for="width"
						>Width:
						<input
							id="width"
							class="ml-2"
							type="number"
							min="0"
							max="1000"
							step="1"
							bind:value={width}
						/>
					</label>
					<label for="height"
						>Height: <input
							id="height"
							class="ml-2"
							type="number"
							min="0"
							max="1000"
							step="1"
							bind:value={height}
						/></label
					>
				</div>
				<div class="flex w-full">
					<label for="record"
						>Record:
						<input id="record" class="ml-2" type="checkbox" bind:checked={record} />
					</label>
				</div>
				<div class="flex-grow" />
			</div>
			<div class="section">
				<div class="flex w-full">
					<button class="mr-2" on:click={() => dialog.showModal()}>Rules</button>
					<button class="mr-2" on:click={start}>Start</button>
					<button class="" on:click={stop}>Stop</button>
				</div>
				<div class="flex w-full items-center">
					{#if record}
						<span>Step:</span>
						<input type="range" min="0" step="1" max={lastProcessedStep} bind:value={currentStep} />
						<input
							type="number"
							class="ml-2"
							step="1"
							min="0"
							max={lastProcessedStep}
							bind:value={currentStep}
						/>
						<span>&nbsp;of {lastProcessedStep}</span>
					{/if}
				</div>
			</div>
		</div>
		<div class="bg-white w-full flex-grow p-2 overflow-hidden pt-1">
			<canvas
				bind:this={canvasRef}
				class="w-full h-full max-h-[100%] bg-transparent border border-black rounded shadow-lg"
			></canvas>
		</div>
	</div>
</div>

<dialog bind:this={dialog} class="w-[600px] h-[600px] overflow-auto">
	<div class="w-full h-full flex flex-col">
		<h3 class="font-semibold">Rules</h3>
		<ul>
			<li>Each Gen starts with 1 cell</li>
			<li>All cells algorithms gets executed exactly 1 time per step</li>
			<li>Cells have age, and this is used to resolve conflicts</li>
			<li>
				As soon as the cell age gets close to 100 steps we linearly decrease from the health a
				factor from 0 to 0.3 on each step: health -= Math.min(age / 100, 0.3);
			</li>
			<li>
				All cells whose energy is 0 or less at the end of step are dead and gets removed from the
				simulation
			</li>
			<li>
				To solve conflicts we initially use the cell Age to determine who wins, so the more
				experienced cell Wins. If both cells have same age we decide randomly
			</li>
			<li>
				Cells can access global variables: 'cell' and 'surroundings'. cell is an object containing
				cell health, age, gen and memory, surroundings are other cell (objects who only includes the
				genome string to detect enemies), Walls 'W' or empty spaces 'E'
			</li>
		</ul>
		<p>
			From a cell perspective the possible direction are: 'T', 'TR', 'R', 'BR', 'B', 'BL', 'L',
			'TL'. Where T:Top, B:Bottom, R:Right and L:Left.
		</p>
		<p>The possible actions that can be returned include:</p>
		<ul>
			<li>
				Rest (R) *We use follow function to determine how much energy the cell can restore
				'occupiedCount' are the 8 surrounding cells, walls included, health = Math.min(health + 1 -
				occupiedCount / 10, 99);
			</li>
			<li>
				Eat (E + (direction)) *Take 1 (or if less than 1 then the current health) from target cell
				no matter if is of same Gen and increase our health
			</li>
			<li>Feed (E + (direction)) *Same as Eat but inverse direction</li>
			<li>Move (M + (direction)))</li>
			<li>Duplicate (D + (direction))) *Split the cell energy by half</li>
			<li>A return (string) action must be executed or by default the cell does nothing</li>
		</ul>
		<p>Example: Duplicate Left is 'DL'</p>
    <br>
    <br>
		<button class="" on:click={() => dialog.close()}>Close</button>
	</div>
</dialog>

<style lang="postcss">
	button {
		@apply border border-transparent hover:border-sky-400 bg-gray-200 rounded pl-3 pr-3;
	}
	label {
		@apply flex items-center;
	}
	.half {
		@apply flex flex-col justify-start items-start w-[50%] h-full overflow-auto;
	}
	.section {
		@apply flex flex-col flex-grow p-2 m-1 border border-gray-600 rounded overflow-auto;
	}
	.section select {
		@apply flex-grow;
	}
</style>
