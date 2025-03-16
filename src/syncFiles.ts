import { Octokit } from "@octokit/rest";
import { SyncFilesOptions } from "./types";

export async function syncFiles(options: SyncFilesOptions): Promise<void> {
	const { octokit, fileMap } = options;
	const { destFilename, destPath, sourcePath, sourceFilename, destRepo } = fileMap;
	
	console.log(`Starting sync for ${sourceFilename} to ${destRepo}/${destPath}/${destFilename}`);
	
	try {
		console.log(`Fetching content from ${process.env.GITHUB_REPOSITORY_OWNER}/${process.env.GITHUB_REPOSITORY?.split("/")[1]}/${sourcePath}/${sourceFilename}`);
		
		const { data: fileContent } = await octokit.repos.getContent({
			owner: process.env.GITHUB_REPOSITORY_OWNER!,
			repo: process.env.GITHUB_REPOSITORY!.split("/")[1],
			path: `${sourcePath}/${sourceFilename}`
		});

		if ("content" in fileContent) {
			console.log(`Successfully fetched content for ${sourceFilename}`);
			const decodedContent = Buffer.from(fileContent.content, "base64").toString();
			await createPullRequest(octokit, destRepo, destPath, destFilename, sourceFilename, decodedContent);
		} else {
			console.error(`Content not found in response for ${sourceFilename}`);
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

	console.log(`Creating PR in ${destRepo} with branch ${branchName}`);

	try {
		// Get the SHA of the default branch
		console.log(`Getting ref for ${owner}/${repo}/heads/main`);
		const { data: refData } = await octokit.git.getRef({
			owner,
			repo,
			ref: "heads/main"
		});

		// Create a new branch
		console.log(`Creating branch ${branchName} from SHA ${refData.object.sha}`);
		await octokit.git.createRef({
			owner,
			repo,
			ref: `refs/heads/${branchName}`,
			sha: refData.object.sha
		});

		// Check if file exists and update or create accordingly
		try {
			console.log(`Checking if file ${destPath}/${destFilename} exists in branch ${branchName}`);
			const { data: existingFile } = await octokit.repos.getContent({
				owner,
				repo,
				path: `${destPath}/${destFilename}`,
				ref: branchName
			});

			if ("sha" in existingFile) {
				console.log(`Updating existing file with SHA ${existingFile.sha}`);
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
			console.log(`File doesn't exist, creating new file at ${destPath}/${destFilename}`);
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
		console.log(`Creating pull request from ${branchName} to main`);
		const pr = await octokit.pulls.create({
			owner,
			repo,
			title: `Sync ${sourceFilename} from source repository`,
			head: branchName,
			base: "main",
			body: "This PR was automatically created by the file sync action."
		});

		console.log(`Created PR #${pr.data.number} for ${destFilename} in ${destRepo}: ${pr.data.html_url}`);
	} catch (error) {
		console.error(`Error creating PR in ${destRepo}:`, error);
		if (error instanceof Error) {
			console.error(`Error message: ${error.message}`);
			console.error(`Error stack: ${error.stack}`);
		}
	}
}
