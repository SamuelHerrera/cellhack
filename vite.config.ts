import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { comlink } from 'vite-plugin-comlink';
export default defineConfig({
	plugins: [sveltekit(), nodePolyfills(), comlink()],
  worker: {
		plugins: () => [comlink()]
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
