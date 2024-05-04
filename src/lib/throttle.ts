export function throttle<T>(fn: (step: T) => Promise<void>, delay: number | undefined) {
	let timerFlag: number | null = null; // Variable to keep track of the timer
	let mostRecentArgs: T | undefined;
	// Returning a throttled version
	return async (args: T) => {
		if (timerFlag) {
			mostRecentArgs = args;
		} else {
			timerFlag = setTimeout(async () => {
				if (mostRecentArgs !== undefined) await fn(mostRecentArgs);
				timerFlag = null;
				mostRecentArgs = undefined;
			}, delay);
			await fn(args);
		}
	};
}
