import type { ActionReturn } from 'svelte/action';
import { basicSetup, minimalSetup } from 'codemirror';
import { EditorView, keymap, type ViewUpdate } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search';
import '$lib/codemirror.scss';

export interface options {
	onChange: (value: string) => void;
	onInit?: (instance: EditorView) => void;
	options:
		| {
				readOnly?: boolean;
				value: string;
				language: string;
		  }
		| undefined;
}

export function codemirror(el: HTMLElement, options: options): ActionReturn<options> {
	let currentValue: string | undefined = undefined;
	let onChange = options.onChange || (() => {});
	const extensions = [
		options.options?.readOnly ? minimalSetup : basicSetup,
		keymap.of([indentWithTab, ...searchKeymap]),
		highlightSelectionMatches(),
		search({ top: true }),
		EditorState.readOnly.of(options.options?.readOnly || false),
		EditorView.updateListener.of((v: ViewUpdate) => {
			if (v.docChanged && editor instanceof EditorView) {
				const auxVal = currentValue;
				currentValue = editor.state.doc.toString();
				if (auxVal != currentValue) onChange(currentValue);
			}
		})
	];
	if (['javascript', 'js'].includes(options.options?.language || '')) extensions.push(javascript());
	const editor = new EditorView({
		doc: options.options?.value || '',
		extensions,
		parent: el
	});
	return {
		destroy() {
			if (!editor) return;
			editor.destroy();
		},
		update(newOptions: options | undefined) {
			if (newOptions && currentValue != newOptions.options?.value) {
				currentValue = newOptions.options?.value;
				onChange = newOptions.onChange || (() => {});
				editor.dispatch({
					changes: {
						from: 0,
						to: editor.state.doc.length,
						insert: newOptions.options?.value || ''
					}
				});
			}
		}
	};
}
