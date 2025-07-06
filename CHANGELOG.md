# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2024-12-19

### Changed
- Improved logging using Octokit's core logging utilities

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