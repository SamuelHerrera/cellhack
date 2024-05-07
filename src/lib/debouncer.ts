export function debounce<T>(fn: (args: T) => void, time: number) {
	let debounce: number | undefined;
	return (args: T) => {
		clearTimeout(debounce);
		debounce = setTimeout(() => {
			fn(args);
		}, time);
	};
}
