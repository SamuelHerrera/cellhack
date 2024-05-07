import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import type { ActionReturn } from 'svelte/action';
import type { editor } from 'monaco-editor';
import { basicSetup, minimalSetup } from 'codemirror';
import { EditorView, keymap, type ViewUpdate } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';

interface options {
	onChange: (value: string) => void;
	onInit?: (instance: editor.IStandaloneCodeEditor | EditorView) => void;
	options: editor.IStandaloneEditorConstructionOptions | undefined;
}

export function monaco(el: HTMLElement, options: options): ActionReturn<options> {
	self.MonacoEnvironment = {
		getWorker: function (_moduleId: string, label: string) {
			if (label === 'json') return new jsonWorker();
			if (['css', 'scss', 'less'].includes(label)) return new cssWorker();
			if (['handlebars', 'html', 'razor'].includes(label)) return new htmlWorker();
			if (['typescript', 'javascript'].includes(label)) return new tsWorker();
			return new editorWorker();
		}
	};
	let editor: editor.IStandaloneCodeEditor | EditorView;
	let model: editor.ITextModel | null;
	let Monaco: unknown;
	let delayed: editor.IStandaloneEditorConstructionOptions | undefined;
	let currentValue: string | undefined = undefined;
	let onChange = options.onChange || (() => {});
	const init = (lib: typeof import('monaco-editor')) => {
		Monaco = lib;
		editor = (Monaco as typeof lib).editor.create(el, options.options);
		options.onInit && options.onInit(editor);
		model = editor.getModel();
		if (model) {
			if (delayed) {
				editor.updateOptions(delayed);
				delayed = undefined;
			}
			model.onDidChangeContent(() => {
				const auxVal = currentValue;
				if (editor instanceof EditorView) currentValue = editor.state.doc.toString();
				else currentValue = editor.getValue();
				if (auxVal != currentValue) onChange(currentValue);
			});
		}
	};
	import('monaco-editor').then(init).catch(async () => {
		const extensions = [
			options.options?.readOnly ? minimalSetup : basicSetup,
			keymap.of([indentWithTab]),
			EditorState.readOnly.of(options.options?.readOnly || false),
			EditorView.updateListener.of((v: ViewUpdate) => {
				if (v.docChanged && editor instanceof EditorView) {
					const auxVal = currentValue;
					currentValue = editor.state.doc.toString();
					if (auxVal != currentValue) onChange(currentValue);
				}
			})
		];
		if (['javascript', 'js'].includes(options.options?.language || '')) {
			const js = (await import('@codemirror/lang-javascript')).javascript;
			extensions.push(js());
		}
		editor = new EditorView({
			doc: options.options?.value || '',
			extensions,
			parent: el
		});
	});
	return {
		destroy() {
			if (!editor) return;
			if (editor instanceof EditorView) editor.destroy();
			else editor.dispose();
		},
		update(newOptions: options | undefined) {
			if (!editor) {
				delayed = newOptions?.options;
			} else {
				if (newOptions && currentValue != newOptions.options?.value) {
					currentValue = newOptions.options?.value;
					onChange = newOptions.onChange || (() => {});
					if (editor instanceof EditorView) {
						editor.dispatch({
							changes: {
								from: 0,
								to: editor.state.doc.length,
								insert: newOptions.options?.value || ''
							}
						});
					} else {
						editor.updateOptions(newOptions?.options as editor.IEditorOptions);
						editor.setValue((newOptions.options?.value as string) || '');
					}
				}
			}
		}
	};
}
