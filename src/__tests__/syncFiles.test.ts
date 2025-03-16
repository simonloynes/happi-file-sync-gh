import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Octokit } from '@octokit/rest';
import { syncFiles } from '../syncFiles';
import { SyncFilesOptions } from '../types';

describe('syncFiles', () => {
  const mockOwner = 'test-owner';
  const mockRepo = 'test-repo';
  const mockFileContent = 'test-content';
  const mockSha = 'test-sha';
  const mockBase64Content = Buffer.from(mockFileContent).toString('base64');
  let mockOctokit: any;

  const mockOptions = (): SyncFilesOptions => ({
    octokit: mockOctokit as unknown as Octokit,
    fileMap: {
      sourcePath: 'source/path',
      sourceFilename: 'source.txt',
      destRepo: 'dest-owner/dest-repo',
      destPath: 'dest/path',
      destFilename: 'dest.txt'
    }
  });

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Setup environment variables
    process.env.GITHUB_REPOSITORY_OWNER = mockOwner;
    process.env.GITHUB_REPOSITORY = `${mockOwner}/${mockRepo}`;

    // Create mock Octokit instance with all required methods
    mockOctokit = {
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn()
      },
      git: {
        getRef: vi.fn(),
        createRef: vi.fn()
      },
      pulls: {
        create: vi.fn()
      }
    };

    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should successfully sync files and create a PR when file exists', async () => {
    // Mock getContent for source file
    mockOctokit.repos.getContent
      .mockResolvedValueOnce({
        data: {
          content: mockBase64Content,
          sha: mockSha
        }
      })
      // Mock getContent for destination file
      .mockResolvedValueOnce({
        data: {
          sha: mockSha
        }
      });

    // Mock getRef
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    // Mock other API calls
    mockOctokit.git.createRef.mockResolvedValueOnce({});
    mockOctokit.repos.createOrUpdateFileContents.mockResolvedValueOnce({});
    mockOctokit.pulls.create.mockResolvedValueOnce({});

    const options = mockOptions();
    await syncFiles(options);

    // Verify source file was fetched
    expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
      owner: mockOwner,
      repo: mockRepo,
      path: `${options.fileMap.sourcePath}/${options.fileMap.sourceFilename}`
    });

    // Verify branch was created
    expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      ref: `refs/heads/sync-${options.fileMap.sourceFilename}-${options.fileMap.destFilename}`,
      sha: mockSha
    });

    // Verify file was updated
    expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      path: `${options.fileMap.destPath}/${options.fileMap.destFilename}`,
      message: `Sync ${options.fileMap.sourceFilename} from source repository`,
      content: mockBase64Content,
      sha: mockSha,
      branch: `sync-${options.fileMap.sourceFilename}-${options.fileMap.destFilename}`
    });

    // Verify PR was created
    expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      title: `Sync ${options.fileMap.sourceFilename} from source repository`,
      head: `sync-${options.fileMap.sourceFilename}-${options.fileMap.destFilename}`,
      base: 'main',
      body: 'This PR was automatically created by the file sync action.'
    });
  });

  it('should create new file if it does not exist in destination', async () => {
    // Mock getContent for source file
    mockOctokit.repos.getContent
      .mockResolvedValueOnce({
        data: {
          content: mockBase64Content,
          sha: mockSha
        }
      })
      // Mock getContent for destination file to throw
      .mockRejectedValueOnce(new Error('Not found'));

    // Mock getRef
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    // Mock other API calls
    mockOctokit.git.createRef.mockResolvedValueOnce({});
    mockOctokit.repos.createOrUpdateFileContents.mockResolvedValueOnce({});
    mockOctokit.pulls.create.mockResolvedValueOnce({});

    const options = mockOptions();
    await syncFiles(options);

    // Verify file was created without sha
    expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      path: `${options.fileMap.destPath}/${options.fileMap.destFilename}`,
      message: `Add ${options.fileMap.sourceFilename} from source repository`,
      content: mockBase64Content,
      branch: `sync-${options.fileMap.sourceFilename}-${options.fileMap.destFilename}`
    });
  });

  it('should handle errors when source file does not exist', async () => {
    // Mock getContent to throw for source file
    mockOctokit.repos.getContent.mockRejectedValueOnce(new Error('Not found'));

    const options = mockOptions();
    await syncFiles(options);

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith(
      `Error processing ${options.fileMap.sourceFilename}:`,
      expect.any(Error)
    );
  });

  it('should handle errors in PR creation process', async () => {
    // Mock getContent for source file
    mockOctokit.repos.getContent.mockResolvedValueOnce({
      data: {
        content: mockBase64Content,
        sha: mockSha
      }
    });

    // Mock getRef to throw
    mockOctokit.git.getRef.mockRejectedValueOnce(new Error('Failed to get ref'));

    const options = mockOptions();
    await syncFiles(options);

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith(
      `Error creating PR in ${options.fileMap.destRepo}:`,
      expect.any(Error)
    );
  });

  it('should handle missing environment variables', async () => {
    delete process.env.GITHUB_REPOSITORY_OWNER;
    delete process.env.GITHUB_REPOSITORY;

    const options = mockOptions();
    await syncFiles(options);

    // Verify error was logged
    expect(console.error).toHaveBeenCalled();
  });
}); 