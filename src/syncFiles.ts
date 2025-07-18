import { Octokit } from "@octokit/rest";
import * as core from "@actions/core";
import { SyncFilesOptions } from "./types";

export async function syncFiles(options: SyncFilesOptions): Promise<void> {
	const { octokit, fileMap } = options;
	const { destFilename, destPath, sourcePath, sourceFilename, destRepo, destBranch = 'main', existingBranchStrategy = 'update' } = fileMap;
	
	core.info(`Starting sync for ${sourceFilename} to ${destRepo}/${destPath}/${destFilename}`);
	
	try {
		core.info(`Fetching content from ${process.env.GITHUB_REPOSITORY_OWNER}/${process.env.GITHUB_REPOSITORY?.split("/")[1]}/${sourcePath === '.' ? '' : sourcePath + '/'}${sourceFilename}`);
		
		const filePath = sourcePath === '.' ? sourceFilename : `${sourcePath}/${sourceFilename}`;
		
		const { data: fileContent } = await octokit.repos.getContent({
			owner: process.env.GITHUB_REPOSITORY_OWNER!,
			repo: process.env.GITHUB_REPOSITORY!.split("/")[1],
			path: filePath
		});

		if ("content" in fileContent) {
			core.info(`Successfully fetched content for ${sourceFilename}`);
			const decodedContent = Buffer.from(fileContent.content, "base64").toString();
			await createPullRequest(octokit, destRepo, destPath, destFilename, sourceFilename, decodedContent, destBranch, existingBranchStrategy);
		} else {
			core.error(`Content not found in response for ${sourceFilename}`);
		}
	} catch (error) {
		core.error(`Error processing ${sourceFilename}: ${error instanceof Error ? error.message : String(error)}`);
		if (error instanceof Error && error.stack) {
			core.debug(`Error stack: ${error.stack}`);
		}
	}
}

async function createPullRequest(
	octokit: Octokit,
  destRepo: string,
  destPath: string,
  destFilename: string,
	sourceFilename: string,
	fileContent: string,
	defaultBranch: string = 'main',
	existingBranchStrategy: string = 'update'
): Promise<void> {
	const [owner, repo] = destRepo.split("/");
	const baseBranchName = `sync-${sourceFilename}-${destFilename}`;
	const destFilePath = destPath === '.' ? destFilename : `${destPath}/${destFilename}`;

	core.info(`Creating PR in ${destRepo} with branch ${baseBranchName}`);

	try {
		// Try to get the reference for the specified branch, falling back to 'master' if not found
		let refData;
		try {
			core.info(`Getting ref for ${owner}/${repo}/heads/${defaultBranch}`);
			const response = await octokit.git.getRef({
				owner,
				repo,
				ref: `heads/${defaultBranch}`
			});
			refData = response.data;
		} catch (error: any) {
			if (error.status === 404 && defaultBranch === 'main') {
				core.info(`${defaultBranch} branch not found, trying master branch`);
				defaultBranch = 'master';
				const response = await octokit.git.getRef({
					owner,
					repo,
					ref: "heads/master"
				});
				refData = response.data;
			} else {
				throw error;
			}
		}

		// Check if the branch already exists
		let branchName = baseBranchName;
		let branchExists = false;
		
		try {
			await octokit.git.getRef({
				owner,
				repo,
				ref: `heads/${baseBranchName}`
			});
			branchExists = true;
			core.info(`Branch ${baseBranchName} already exists`);
		} catch (error: any) {
			if (error.status === 404) {
				// Branch doesn't exist, we'll create it
				core.info(`Branch ${baseBranchName} doesn't exist, will create it`);
			} else {
				throw error;
			}
		}

		// Handle existing branch based on strategy
		if (branchExists) {
			switch (existingBranchStrategy) {
				case 'fail':
					throw new Error(`Branch ${baseBranchName} already exists. Use 'update' or 'create-new' strategy to handle this.`);
				
				case 'create-new':
					// Create a new branch with timestamp suffix
					const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
					branchName = `${baseBranchName}-${timestamp}`;
					core.info(`Creating new branch ${branchName} with timestamp suffix`);
					await octokit.git.createRef({
						owner,
						repo,
						ref: `refs/heads/${branchName}`,
						sha: refData.object.sha
					});
					break;
				
				case 'update':
				default:
					core.info(`Using existing branch ${baseBranchName} for updates`);
					break;
			}
		} else {
			// Branch doesn't exist, create it
			core.info(`Creating branch ${branchName} from SHA ${refData.object.sha}`);
			await octokit.git.createRef({
				owner,
				repo,
				ref: `refs/heads/${branchName}`,
				sha: refData.object.sha
			});
		}

		// Check if file exists and update or create accordingly
		try {
			core.info(`Checking if file ${destFilePath} exists in branch ${branchName}`);
			const { data: existingFile } = await octokit.repos.getContent({
				owner,
				repo,
				path: destFilePath,
				ref: branchName
			});

			if ("sha" in existingFile) {
				core.info(`Updating existing file with SHA ${existingFile.sha}`);
				await octokit.repos.createOrUpdateFileContents({
					owner,
					repo,
					path: destFilePath,
					message: `Sync ${sourceFilename} from source repository`,
					content: Buffer.from(fileContent).toString("base64"),
					sha: existingFile.sha,
					branch: branchName
				});
			}
		} catch (error) {
			// File doesn't exist, create it
			core.info(`File doesn't exist, creating new file at ${destFilePath}`);
			await octokit.repos.createOrUpdateFileContents({
				owner,
				repo,
				path: destFilePath,
				message: `Add ${sourceFilename} from source repository`,
				content: Buffer.from(fileContent).toString("base64"),
				branch: branchName
			});
		}

		// Check if a PR already exists for this branch
		let existingPR = null;
		try {
			const { data: pulls } = await octokit.pulls.list({
				owner,
				repo,
				head: `${owner}:${branchName}`,
				base: defaultBranch,
				state: 'open'
			});
			
			if (pulls.length > 0) {
				existingPR = pulls[0];
				core.info(`Found existing PR #${existingPR.number} for branch ${branchName}`);
			}
		} catch (error) {
			core.debug(`Error checking for existing PR: ${error instanceof Error ? error.message : String(error)}`);
		}

		if (existingPR) {
			core.info(`PR already exists: #${existingPR.number} - ${existingPR.html_url}`);
		} else {
			// Create a pull request
			core.info(`Creating pull request from ${branchName} to ${defaultBranch}`);
			const pr = await octokit.pulls.create({
				owner,
				repo,
				title: `Sync ${sourceFilename} from ${process.env.GITHUB_REPOSITORY_OWNER}/${process.env.GITHUB_REPOSITORY?.split("/")[1]}`,
				head: branchName,
				base: defaultBranch,
				body: "This PR was automatically created by the `[happi-file-sync-gh](https://github.com/simonloynes/happi-file-sync-gh)` action."
			});

			core.info(`Created PR #${pr.data.number} for ${destFilename} in ${destRepo}: ${pr.data.html_url}`);
		}
	} catch (error) {
		core.error(`Error creating PR in ${destRepo}: ${error instanceof Error ? error.message : String(error)}`);
		if (error instanceof Error) {
			core.error(`Error message: ${error.message}`);
			core.debug(`Error stack: ${error.stack}`);
		}
	}
}
