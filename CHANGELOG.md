# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Branch handling strategies**: Added support for handling situations where a branch already exists on the destination repository
  - New `existingBranchStrategy` configuration option with three strategies:
    - `update` (default): Updates the existing branch and its associated pull request
    - `create-new`: Creates a new branch with timestamp suffix (e.g., `sync-config-2024-01-15T10-30-45`)
    - `fail`: Fails the action if the branch already exists
  - Automatic detection of existing pull requests to avoid creating duplicates
  - Enhanced logging for branch and PR status

### Changed
- **Default behavior**: The action now defaults to updating existing branches instead of failing
- **Branch naming**: When using `create-new` strategy, branches are created with ISO timestamp suffix for uniqueness
- **Error handling**: Improved error messages and handling for branch existence scenarios

### Technical
- Updated TypeScript types to include the new `existingBranchStrategy` option
- Enhanced test coverage with new tests for all branch handling strategies
- Improved GitHub API calls to check for existing branches and pull requests

## [1.3.0] - 2024-01-15

### Added
- Initial release of happi-file-sync-gh action
- Support for syncing files between GitHub repositories
- Automatic pull request creation
- Configurable file mappings with source and destination paths
- Support for custom destination branches
- Debug logging capabilities

## [1.2.0] -  2024-03-17

### Added
- Support for custom destination branches in file mappings
- Debug logging option for Octokit API calls
- Enhanced error handling and validation

### Changed
- Improved file mapping configuration format
- Better pull request titles and descriptions

### Fixed
- Various bug fixes and improvements

## [1.1.0] - 2024-03-16

### Added
- Initial release of happi-file-sync-gh GitHub Action
- Automatic file synchronization between GitHub repositories
- Pull request creation for synced files
- Configurable file mappings with JSON configuration
- Support for multiple file mappings in a single action
- GitHub token authentication for cross-repository access
- Path-based file monitoring and syncing
- Customizable destination paths and filenames
- Integration with GitHub Actions workflow triggers
- Support for both manual and automated triggering

### Features
- **File Mapping Configuration**: Flexible JSON-based configuration for mapping source files to destination repositories
- **Cross-Repository Sync**: Ability to sync files between different repositories and organizations
- **Pull Request Creation**: Automatic creation of pull requests with descriptive titles and descriptions
- **Branch Management**: Support for custom destination branches (defaults to main/master)
- **Path Flexibility**: Support for files in root directories and subdirectories
- **Debug Logging**: Optional debug mode for troubleshooting Octokit API calls

### Technical Details
- Built with TypeScript and Node.js
- Uses Octokit REST API for GitHub operations
- Zod schema validation for configuration
- Comprehensive error handling and logging
- GitHub Actions compatible with Node.js 20 runtime 