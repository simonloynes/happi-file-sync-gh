# happi-file-sync-gh 😜

Automatically sync specified files between github repositories.

## Features

- Automatically sync a file to a target repository when changes are made to monitored files.

## Usage

This is a GitHub Action that automatically syncs files between repositories by creating pull requests.

### Setup

1. Create a `.github/workflows/sync-files.yml` file in your repository:

```yaml
name: Sync Files
on:
  pull_request_target:
    types: [closed]
    branches:
      - main # Only in the main branch
    paths:
      - "README.md" # Target changes on the README in the repository root
  workflow_dispatch:  # Allows manual triggering of the workflow

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: happi-file-sync-gh@v1
        with:
          github-token: ${{ secrets.SYNC_PAT }}  # Token is passed as an input parameter
          debug: false  # Enable debug logging for Octokit API calls (optional)
          file-mappings: |
            {
              "config": {
                "sourcePath": "config",
                "sourceFilename": "settings.json",
                "destRepo": "other-org/other-repo",
                "destPath": "config",
                "destFilename": "settings.json",
                "destBranch": "main"
              },
              "docs": {
                "sourcePath": "docs",
                "sourceFilename": "README.md",
                "destRepo": "other-org/other-repo",
                "destPath": "documentation",
                "destFilename": "README.md"
                "destBranch": "main",
              }
            }

```

### Configuration

#### Input Parameters

- `github-token`: GitHub token with access to both source and destination repositories (required)
- `file-mappings`: JSON object mapping filenames to their source and destination details (required)
- `debug`: Enable debug logging for Octokit API calls (optional, defaults to `false`)

#### File Mappings

The `file-mappings` input is a JSON object where each key is a unique identifier for the mapping, and the value contains:

- `sourcePath`: Directory path in the source repository (use `"."` for files in the root directory)
- `sourceFilename`: Name of the file to sync
- `destRepo`: Target repository in format `owner/repo`
- `destPath`: Directory path in the destination repository (use `"."` for files in the root directory)
- `destFilename`: Name of the file in the destination repository
- `destBranch`: (Optional) Target branch in the destination repository (defaults to `main` with fallback to `master`)

Example with a file in the root directory:
```json
{
  "root-file": {
    "sourcePath": ".",
    "sourceFilename": "package.json",
    "destRepo": "other-org/other-repo",
    "destPath": ".",
    "destFilename": "package.json"
  }
}
```

Example with a custom destination branch:
```json
{
  "develop-branch": {
    "sourcePath": "config",
    "sourceFilename": "settings.json",
    "destRepo": "other-org/other-repo",
    "destPath": "config",
    "destFilename": "settings.json",
    "destBranch": "develop"
  }
}
```

### How it Works

1. When changes are pushed to the monitored branch, the action will:
   - Check for changes in the specified source files
   - Create a new branch in the destination repository
   - Copy the updated file(s) to the destination repository
   - Create a pull request with the changes

2. Pull requests will be created with:
   - Branch name: `sync-{sourceFilename}-{destFilename}`
   - Title: `Sync {sourceFilename} from other-org/other-repo`
   - Description: This PR was automatically created by the `[happi-file-sync-gh](https://github.com/simonloynes/happi-file-sync-gh)` action.

### Permissions

The action requires:
- `github-token` input parameter with access to both source and destination repositories (required)
  - For source repository: Read access to repository contents
  - For destination repository: Write access to create branches and pull requests
- Make sure your token has the following permissions:
  - `contents: write` - To create and update files
  - `pull_requests: write` - To create pull requests
  
Note: The default `GITHUB_TOKEN` provided by GitHub Actions only has access to the current repository. If you need to sync files to a different repository, you'll need to create a Personal Access Token (PAT) with access to both repositories and store it as a repository secret.

Example workflow using a PAT with debug logging:
```yaml
- uses: happi-file-sync-gh@v1
  with:
    github-token: ${{ secrets.SYNC_PAT }}  # Use a PAT with access to both repos
    debug: true  # Enable detailed logging for troubleshooting
    file-mappings: |
      {
        "config": {
          "sourcePath": "config",
          "sourceFilename": "settings.json",
          "destRepo": "other-org/other-repo",
          "destPath": "config",
          "destFilename": "settings.json"
        }
      }
```
