import * as core from "@actions/core";
import { Octokit } from "@octokit/rest";
import { syncFiles } from "./syncFiles";
import { FileMappingsSchema } from "./types";

export async function run(): Promise<void> {
	const githubToken = core.getInput("github-token", { required: true });

	const filesMapInput = JSON.parse(core.getInput("file-mappings"));
	const fileMaps = FileMappingsSchema.parse(filesMapInput);

	const octokit = new Octokit({ auth: githubToken });

	await Promise.all(
		Object.keys(fileMaps).map(async (mapKey: string) => {
			await syncFiles({ octokit, fileMap: fileMaps[mapKey] });
		})
	);
}

export * from "./types";
export { syncFiles } from "./syncFiles";

// Execute the run function when the action is run
run().catch(error => {
	console.error("Action failed with error:", error);
	core.setFailed(error.message);
});
