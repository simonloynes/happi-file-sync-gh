import { Octokit } from "@octokit/rest";
import { SyncFilesOptions } from "./types";

export async function syncFiles(options: SyncFilesOptions): Promise<void> {
	const { octokit, fileMap } = options;
	const { destFilename, destPath, sourcePath, sourceFilename, destRepo } = fileMap;
	try {
		const { data: fileContent } = await octokit.repos.getContent({
			owner: process.env.GITHUB_REPOSITORY_OWNER!,
			repo: process.env.GITHUB_REPOSITORY!.split("/")[1],
			path: `${sourcePath}/${sourceFilename}`
		});

		if ("content" in fileContent) {
			const decodedContent = Buffer.from(fileContent.content, "base64").toString();
			await createPullRequest(octokit, destRepo, destPath, destFilename, sourceFilename, decodedContent);
		}
	} catch (error) {
		console.error(`Error processing ${sourceFilename}:`, error);
	}
}

async function createPullRequest(
	octokit: Octokit,
  destRepo: string,
  destPath: string,
  destFilename: string,
	sourceFilename: string,
	fileContent: string
): Promise<void> {
	const [owner, repo] = destRepo.split("/");
	const branchName = `sync-${sourceFilename}-${destFilename}`;

	try {
		// Get the SHA of the default branch
		const { data: refData } = await octokit.git.getRef({
			owner,
			repo,
			ref: "heads/main"
		});

		// Create a new branch
		await octokit.git.createRef({
			owner,
			repo,
			ref: `refs/heads/${branchName}`,
			sha: refData.object.sha
		});

		// Check if file exists and update or create accordingly
		try {
			const { data: existingFile } = await octokit.repos.getContent({
				owner,
				repo,
				path: `${destPath}/${destFilename}`,
				ref: branchName
			});

			if ("sha" in existingFile) {
				await octokit.repos.createOrUpdateFileContents({
					owner,
					repo,
					path: `${destPath}/${destFilename}`,
					message: `Sync ${sourceFilename} from source repository`,
					content: Buffer.from(fileContent).toString("base64"),
					sha: existingFile.sha,
					branch: branchName
				});
			}
		} catch (error) {
			// File doesn't exist, create it
			await octokit.repos.createOrUpdateFileContents({
				owner,
				repo,
				path: `${destPath}/${destFilename}`,
				message: `Add ${sourceFilename} from source repository`,
				content: Buffer.from(fileContent).toString("base64"),
				branch: branchName
			});
		}

		// Create a pull request
		await octokit.pulls.create({
			owner,
			repo,
			title: `Sync ${sourceFilename} from source repository`,
			head: branchName,
			base: "main",
			body: "This PR was automatically created by the file sync action."
		});

		console.log(`Created PR for ${destFilename} in ${destRepo}`);
	} catch (error) {
		console.error(`Error creating PR in ${destRepo}:`, error);
	}
}
