import * as core from "@actions/core";
import { Octokit } from "@octokit/rest";
import { syncFiles } from "./syncFiles";
import { FileMappingsSchema } from "./types";

export async function run(): Promise<void> {
	const githubToken = core.getInput("github-token", { required: true });
	const debug = core.getInput("debug") === "true";

	const filesMapInput = JSON.parse(core.getInput("file-mappings"));
	const fileMaps = FileMappingsSchema.parse(filesMapInput);

	// Create a custom logger for Octokit
	const logger = {
		debug: (message: string, info?: any) => {
			if (debug) {
				core.debug(`[Octokit] ${message}${info ? ` ${JSON.stringify(info)}` : ''}`);
			}
		},
		info: (message: string, info?: any) => {
			core.info(`[Octokit] ${message}${info ? ` ${JSON.stringify(info)}` : ''}`);
		},
		warn: (message: string, info?: any) => {
			core.warning(`[Octokit] ${message}${info ? ` ${JSON.stringify(info)}` : ''}`);
		},
		error: (message: string, info?: any) => {
			core.error(`[Octokit] ${message}${info ? ` ${JSON.stringify(info)}` : ''}`);
		}
	};

	const octokit = new Octokit({ 
		auth: githubToken,
		log: logger,
		debug: debug
	});

	await Promise.all(
		Object.keys(fileMaps).map(async (mapKey: string) => {
			await syncFiles({ octokit, fileMap: fileMaps[mapKey] });
		})
	);
}

export * from "./types";
export { syncFiles } from "./syncFiles";

// Execute the run function when the action is run
if (process.env.GITHUB_ACTIONS === 'true') {
	run().catch(error => {
		console.error("Action failed with error:", error);
		core.setFailed(error.message);
	});
}
