import * as core from "@actions/core";
import { Octokit } from "@octokit/rest";
import { syncFiles } from "./syncFiles";
import { FileMappingsSchema } from "./types";

export async function run(): Promise<void> {
	const githubToken = process.env.GITHUB_TOKEN;
	if (!githubToken) {
		throw new Error("GITHUB_TOKEN is not set");
	}

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
