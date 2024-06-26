import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import JSON5 from 'json5';
import MagicString from 'magic-string';
import { type Plugin, normalizePath } from 'vite';
import { SourceMapConsumer, SourceMapGenerator } from 'source-map';
export default defineConfig({
	plugins: [sveltekit(), nodePolyfills(), comlink()],
	worker: {
		plugins: () => [comlink()]
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});

const importMetaUrl = `${'import'}.meta.url`;
const urlPrefix_normal = 'internal:comlink:';
const urlPrefix_shared = 'internal:comlink-shared:';

let mode = '';

function comlink({ replacement = 'Worker', replacementShared = 'SharedWorker' } = {}): Plugin[] {
	return [
		{
			configResolved(conf) {
				mode = conf.mode;
			},
			name: 'comlink',
			resolveId(id) {
				if (id.includes(urlPrefix_normal) || id.includes(urlPrefix_shared)) return id;
			},
			async load(id) {
				if (id.includes(urlPrefix_normal)) {
					const realID = normalizePath(id.replace(urlPrefix_normal, ''));
					return `
            import {expose} from 'comlink'
            import * as api from '${normalizePath(realID)}'
            expose(api)
          `;
				}
				if (id.includes(urlPrefix_shared)) {
					const realID = normalizePath(id.replace(urlPrefix_shared, ''));
					return `
            import {expose} from 'comlink'
            import * as api from '${normalizePath(realID)}'
            addEventListener('connect', (event) => {
                const port = event.ports[0];
                expose(api, port);
                // We might need this later...
                // port.start()
            })
          `;
				}
			},
			async transform(code: string, id: string) {
				if (!code.includes('ComlinkWorker') && !code.includes('ComlinkSharedWorker')) return;
				const workerSearcher =
					/\bnew\s+(ComlinkWorker|ComlinkSharedWorker)\s*\(\s*new\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*\)\s*([^)]*)\)/g;
				const s: MagicString = new MagicString(code);
				function workerReplacer(
					match: string,
					type: 'ComlinkWorker' | 'ComlinkSharedWorker',
					url: string,
					rest: string
				) {
					url = url.slice(1, url.length - 1);
					const index = code.indexOf(match);
					const i = rest.indexOf(',');
					let reClass = type === 'ComlinkWorker' ? replacement : replacementShared;
					if (i !== -1) {
						const opt = JSON5.parse(
							rest
								.slice(i + 1)
								.split(')')[0]
								.trim()
						);
						if (mode === 'development') opt.type = 'module';
						if (opt.replacement) reClass = opt.replacement;
						rest = ',' + JSON.stringify(opt) + ')';
					} else {
						if (mode === 'development') {
							rest += ', {type: "module"}';
						}
						rest += ')';
					}
					const insertCode = `(()=>{
            let worker = createInstance();
            let instance = wrap(worker);
            function createInstance(){
              return new ${reClass}(
                new URL(
                  '${type === 'ComlinkWorker' ? urlPrefix_normal : urlPrefix_shared}${url}', 
                  ${importMetaUrl}
                )
                ${rest}
              ${type === 'ComlinkSharedWorker' ? '.port' : ''};
            }
            function terminate(){
              worker.terminate();
            }
            return {
              instance, 
              terminate: proxy(terminate),
              restart: proxy(()=>{
                worker?.terminate();
                worker = createInstance();
                instance = wrap(worker);
                return instance;
              })
            };
          })()`;
					s.overwrite(index, index + match.length, insertCode);
					return match;
				}
				code.replace(workerSearcher, workerReplacer);
				s.appendLeft(0, `import {wrap, proxy} from 'comlink';\n`);
				const prevSourcemapConsumer = await new SourceMapConsumer(this.getCombinedSourcemap());
				const thisSourcemapConsumer = await new SourceMapConsumer(s.generateMap());
				const sourceMapGen = SourceMapGenerator.fromSourceMap(thisSourcemapConsumer);
				sourceMapGen.applySourceMap(prevSourcemapConsumer, id);
				return {
					code: s.toString(),
					map: sourceMapGen.toJSON()
				};
			}
		} as Plugin
	];
}
