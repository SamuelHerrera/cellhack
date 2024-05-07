const args = ['cell', 'surroundings', 'messages', 'console', 'fetch'];
export function fnEvaluator(script: string) {
	const sandbox = eval(`(async function (${args.join(',')}){\n${script}\n})`);
	return (context: Record<string, unknown>) =>
		sandbox.call(context, ...args.map((k) => context[k]));
}
