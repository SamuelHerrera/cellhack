import { browser } from '$app/environment';
import { transfer, type Remote } from 'comlink';
import systemInfo from '$lib/system-info';
export type GameWorker = typeof import('$lib/worker/simulation');
export type RenderWorker = typeof import('$lib/worker/render');
export let simulationWorker: Remote<GameWorker> | undefined = undefined;
export let renderWorker: Remote<RenderWorker> | undefined = undefined;
const metadataChannel = new MessageChannel();
const simulationChannel = new MessageChannel();
const renderChannel = new MessageChannel();
if (browser) {
	(async () => {
		if (['Android', 'iOS', 'iPadOS', 'ChromeOS'].includes(systemInfo.OSName)) {
			simulationWorker = new ComlinkWorker<GameWorker>(
				new URL('./worker/simulation', import.meta.url)
			);
			renderWorker = new ComlinkWorker<RenderWorker>(
				new URL('./worker/render', import.meta.url)
			);
		} else {
			simulationWorker = new ComlinkSharedWorker<GameWorker>(
				new URL('./worker/simulation', import.meta.url)
			);
			renderWorker = new ComlinkSharedWorker<RenderWorker>(
				new URL('./worker/render', import.meta.url)
			);
		}
		simulationWorker?.setCommChannel(transfer(simulationChannel.port1, [simulationChannel.port1]));
		simulationWorker?.setMetadataChannel(transfer(metadataChannel.port1, [metadataChannel.port1]));
		renderWorker?.setCommChannel(transfer(simulationChannel.port2, [simulationChannel.port2]));
		renderWorker?.setRenderChannel(transfer(renderChannel.port1, [renderChannel.port1]));
	})();
} 
export function getRenderPort() {
	return renderChannel.port2;
}
export function getMetadataPort() {
	return metadataChannel.port2;
}
