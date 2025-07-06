import * as core from "@actions/core";

export interface Logger {
	debug: (message: string, info?: any) => void;
	info: (message: string, info?: any) => void;
	warn: (message: string, info?: any) => void;
	error: (message: string, info?: any) => void;
}

export function createLogger(debug: boolean, prefix: string = "Octokit"): Logger {
	return {
		debug: (message: string, info?: any) => {
			if (debug) {
				core.debug(`[${prefix}] ${message}${info ? ` ${JSON.stringify(info)}` : ''}`);
			}
		},
		info: (message: string, info?: any) => {
			core.info(`[${prefix}] ${message}${info ? ` ${JSON.stringify(info)}` : ''}`);
		},
		warn: (message: string, info?: any) => {
			core.warning(`[${prefix}] ${message}${info ? ` ${JSON.stringify(info)}` : ''}`);
		},
		error: (message: string, info?: any) => {
			core.error(`[${prefix}] ${message}${info ? ` ${JSON.stringify(info)}` : ''}`);
		}
	};
} 