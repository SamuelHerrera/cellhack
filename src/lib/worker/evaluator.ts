export async function evaluator(script: string, context: Record<string, unknown>) {
	const keys = Object.keys(context);
	const sandbox = `((async (${keys.join(',')}) => {
    ${script}
  })(${keys.length ? 'this.' : ''}${keys.join(',this.')}))`;
	return await async function () {
		return await eval(sandbox);
	}.call(context);
}
