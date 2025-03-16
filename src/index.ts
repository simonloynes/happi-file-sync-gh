import * as core from "@actions/core";

export async function run(): Promise<void> {
  try {
    const watchedFiles = core.getInput("watched-files");
    const targetRepo = core.getInput("target-repo");
    console.log(`watchedFiles: ${watchedFiles}`);
    console.log(`targetRepo: ${targetRepo}`);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unknown error occurred");
    }
  }
  }