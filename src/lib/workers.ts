import { browser } from '$app/environment';
import { transfer, type Remote } from 'comlink';
export type GameWorker = typeof import('$lib/worker/simulation');
export type RenderWorker = typeof import('$lib/worker/render');
export let simulationWorker: Remote<GameWorker> | undefined = undefined;
export let renderWorker: Remote<RenderWorker> | undefined = undefined;
export function restartWorkers() {
	simulationWorker = restarters['simulationWorker']() as unknown as Remote<GameWorker>;
	renderWorker = restarters['renderWorker']() as unknown as Remote<RenderWorker>;
	metadataChannel = new MessageChannel();
	simulationChannel = new MessageChannel();
	simulationWorker?.setCommChannel(transfer(simulationChannel.port1, [simulationChannel.port1]));
	simulationWorker?.setMetadataChannel(transfer(metadataChannel.port1, [metadataChannel.port1]));
	renderWorker?.setCommChannel(transfer(simulationChannel.port2, [simulationChannel.port2]));
	return {
		metadataPort: getMetadataPort()
	};
}
let metadataChannel = new MessageChannel();
let simulationChannel = new MessageChannel();
const terminators: Record<string, () => void> = {};
const restarters: Record<string, () => void> = {};
if (browser) {
	(async () => {
		const {
			instance: _simulationWorker,
			terminate: t1,
			restart: r1
		} = new ComlinkWorker<{
			instance: GameWorker;
			terminate: () => void;
			restart: () => void;
		}>(new URL('./worker/simulation', import.meta.url));
		simulationWorker = _simulationWorker as unknown as Remote<GameWorker>;
		terminators['simulationWorker'] = t1;
		restarters['simulationWorker'] = r1;
		const {
			instance: _renderWorker,
			terminate: t2,
			restart: r2
		} = new ComlinkWorker<{
			instance: RenderWorker;
			terminate: () => void;
			restart: () => void;
		}>(new URL('./worker/render', import.meta.url));
		renderWorker = _renderWorker as unknown as Remote<RenderWorker>;
		terminators['renderWorker'] = t2;
		restarters['renderWorker'] = r2;
		simulationWorker?.setCommChannel(transfer(simulationChannel.port1, [simulationChannel.port1]));
		simulationWorker?.setMetadataChannel(transfer(metadataChannel.port1, [metadataChannel.port1]));
		renderWorker?.setCommChannel(transfer(simulationChannel.port2, [simulationChannel.port2]));
	})();
}
export function getMetadataPort() {
	return metadataChannel.port2;
}
