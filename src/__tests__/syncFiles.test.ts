import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Octokit } from '@octokit/rest';
import * as core from '@actions/core';
import { syncFiles } from '../syncFiles';
import { SyncFilesOptions } from '../types';

// Mock @actions/core
vi.mock('@actions/core', () => ({
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn()
}));

describe('syncFiles', () => {
  const mockOwner = 'test-owner';
  const mockRepo = 'test-repo';
  const mockFileContent = 'test-content';
  const mockSha = 'test-sha';
  const mockBase64Content = Buffer.from(mockFileContent).toString('base64');
  let mockOctokit: any;

  const mockOptions = (sourcePath = 'source/path', destBranch?: string): SyncFilesOptions => ({
    octokit: mockOctokit as unknown as Octokit,
    fileMap: {
      sourcePath,
      sourceFilename: 'source.txt',
      destRepo: 'dest-owner/dest-repo',
      destPath: 'dest/path',
      destFilename: 'dest.txt',
      ...(destBranch ? { destBranch } : {})
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

    // Mock getRef for main branch
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    // Mock getRef for branch existence check (branch doesn't exist)
    const notFoundError = new Error('Not Found');
    (notFoundError as any).status = 404;
    mockOctokit.git.getRef.mockRejectedValueOnce(notFoundError);

    // Mock other API calls
    mockOctokit.git.createRef.mockResolvedValueOnce({});
    mockOctokit.repos.createOrUpdateFileContents.mockResolvedValueOnce({});
    mockOctokit.pulls.create.mockResolvedValueOnce({
      data: {
        number: 123,
        html_url: 'https://github.com/dest-owner/dest-repo/pull/123'
      }
    });

    const options = mockOptions();
    await syncFiles(options);

    // Verify source file was fetched with correct path
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

    // Verify file was updated with correct path
    const destFilePath = `${options.fileMap.destPath}/${options.fileMap.destFilename}`;
    expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      path: destFilePath,
      message: `Sync ${options.fileMap.sourceFilename} from source repository`,
      content: mockBase64Content,
      sha: mockSha,
      branch: `sync-${options.fileMap.sourceFilename}-${options.fileMap.destFilename}`
    });

    // Verify PR was created with updated title and body
    expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      title: `Sync ${options.fileMap.sourceFilename} from ${mockOwner}/${mockRepo}`,
      head: `sync-${options.fileMap.sourceFilename}-${options.fileMap.destFilename}`,
      base: 'main',
      body: "This PR was automatically created by the `[happi-file-sync-gh](https://github.com/simonloynes/happi-file-sync-gh)` action."
    });
  });

  it('should handle files in the root directory correctly', async () => {
    // Mock getContent for source file in root directory
    mockOctokit.repos.getContent
      .mockResolvedValueOnce({
        data: {
          content: mockBase64Content,
          sha: mockSha
        }
      })
      // Mock getContent for destination file to throw
      .mockRejectedValueOnce(new Error('Not found'));

    // Mock getRef for main branch
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    // Mock getRef for branch existence check (branch doesn't exist)
    const notFoundError = new Error('Not Found');
    (notFoundError as any).status = 404;
    mockOctokit.git.getRef.mockRejectedValueOnce(notFoundError);

    // Mock other API calls
    mockOctokit.git.createRef.mockResolvedValueOnce({});
    mockOctokit.repos.createOrUpdateFileContents.mockResolvedValueOnce({});
    mockOctokit.pulls.create.mockResolvedValueOnce({
      data: {
        number: 123,
        html_url: 'https://github.com/dest-owner/dest-repo/pull/123'
      }
    });

    const options = mockOptions('.');
    await syncFiles(options);

    // Verify source file was fetched with correct path (just filename for root)
    expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
      owner: mockOwner,
      repo: mockRepo,
      path: options.fileMap.sourceFilename
    });

    // Verify file was created with correct path
    const destFilePath = `${options.fileMap.destPath}/${options.fileMap.destFilename}`;
    expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      path: destFilePath,
      message: `Add ${options.fileMap.sourceFilename} from source repository`,
      content: mockBase64Content,
      branch: `sync-${options.fileMap.sourceFilename}-${options.fileMap.destFilename}`
    });
  });

  it('should handle destination files in the root directory correctly', async () => {
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

    // Mock getRef for main branch
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    // Mock getRef for branch existence check (branch doesn't exist)
    const notFoundError = new Error('Not Found');
    (notFoundError as any).status = 404;
    mockOctokit.git.getRef.mockRejectedValueOnce(notFoundError);

    // Mock other API calls
    mockOctokit.git.createRef.mockResolvedValueOnce({});
    mockOctokit.repos.createOrUpdateFileContents.mockResolvedValueOnce({});
    mockOctokit.pulls.create.mockResolvedValueOnce({
      data: {
        number: 123,
        html_url: 'https://github.com/dest-owner/dest-repo/pull/123'
      }
    });

    // Create options with root destination path
    const options = {
      ...mockOptions(),
      fileMap: {
        ...mockOptions().fileMap,
        destPath: '.'
      }
    };
    
    await syncFiles(options);

    // Verify file was created with correct path (just filename for root)
    expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      path: options.fileMap.destFilename,
      message: `Add ${options.fileMap.sourceFilename} from source repository`,
      content: mockBase64Content,
      branch: `sync-${options.fileMap.sourceFilename}-${options.fileMap.destFilename}`
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

    // Mock getRef for main branch
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    // Mock getRef for branch existence check (branch doesn't exist)
    const notFoundError = new Error('Not Found');
    (notFoundError as any).status = 404;
    mockOctokit.git.getRef.mockRejectedValueOnce(notFoundError);

    // Mock other API calls
    mockOctokit.git.createRef.mockResolvedValueOnce({});
    mockOctokit.repos.createOrUpdateFileContents.mockResolvedValueOnce({});
    mockOctokit.pulls.create.mockResolvedValueOnce({
      data: {
        number: 123,
        html_url: 'https://github.com/dest-owner/dest-repo/pull/123'
      }
    });

    const options = mockOptions();
    await syncFiles(options);

    // Verify file was created without sha
    const destFilePath = `${options.fileMap.destPath}/${options.fileMap.destFilename}`;
    expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      path: destFilePath,
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
    expect(core.error).toHaveBeenCalledWith(
      `Error processing ${options.fileMap.sourceFilename}: Not found`
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
    expect(core.error).toHaveBeenCalledWith(
      `Error creating PR in ${options.fileMap.destRepo}: Failed to get ref`
    );
  });

  it('should fallback to master branch when main branch is not found', async () => {
    // Mock getContent for source file
    mockOctokit.repos.getContent.mockResolvedValueOnce({
      data: {
        content: mockBase64Content,
        sha: mockSha
      }
    });

    // Mock getRef to throw 404 for main branch but succeed for master branch
    const notFoundError = new Error('Not Found');
    (notFoundError as any).status = 404;
    mockOctokit.git.getRef
      .mockRejectedValueOnce(notFoundError) // main branch not found
      .mockResolvedValueOnce({ // master branch found
        data: {
          object: {
            sha: mockSha
          }
        }
      })
      .mockRejectedValueOnce(notFoundError); // sync branch doesn't exist

    // Mock other API calls
    mockOctokit.git.createRef.mockResolvedValueOnce({});
    mockOctokit.repos.createOrUpdateFileContents.mockResolvedValueOnce({});
    mockOctokit.pulls.create.mockResolvedValueOnce({
      data: {
        number: 123,
        html_url: 'https://github.com/dest-owner/dest-repo/pull/123'
      }
    });

    const options = mockOptions();
    await syncFiles(options);

    // Verify both main and master refs were attempted
    expect(mockOctokit.git.getRef).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      ref: 'heads/main'
    });
    
    expect(mockOctokit.git.getRef).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      ref: 'heads/master'
    });

    // Verify PR was created successfully using master branch
    expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      title: `Sync ${options.fileMap.sourceFilename} from ${mockOwner}/${mockRepo}`,
      head: `sync-${options.fileMap.sourceFilename}-${options.fileMap.destFilename}`,
      base: 'master',
      body: "This PR was automatically created by the `[happi-file-sync-gh](https://github.com/simonloynes/happi-file-sync-gh)` action."
    });
  });

  it('should handle missing environment variables', async () => {
    delete process.env.GITHUB_REPOSITORY_OWNER;
    delete process.env.GITHUB_REPOSITORY;

    const options = mockOptions();
    await syncFiles(options);

    // Verify error was logged
    expect(core.error).toHaveBeenCalled();
  });

  it('should use the specified destination branch when provided', async () => {
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

    // Mock getRef for custom branch
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    // Mock getRef for branch existence check (branch doesn't exist)
    const notFoundError = new Error('Not Found');
    (notFoundError as any).status = 404;
    mockOctokit.git.getRef.mockRejectedValueOnce(notFoundError);

    // Mock other API calls
    mockOctokit.git.createRef.mockResolvedValueOnce({});
    mockOctokit.repos.createOrUpdateFileContents.mockResolvedValueOnce({});
    mockOctokit.pulls.create.mockResolvedValueOnce({
      data: {
        number: 123,
        html_url: 'https://github.com/dest-owner/dest-repo/pull/123'
      }
    });

    const customBranch = 'develop';
    const options = mockOptions('source/path', customBranch);
    await syncFiles(options);

    // Verify the correct branch was used
    expect(mockOctokit.git.getRef).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      ref: `heads/${customBranch}`
    });
    
    // Verify PR was created with the custom branch
    expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      title: `Sync ${options.fileMap.sourceFilename} from ${mockOwner}/${mockRepo}`,
      head: `sync-${options.fileMap.sourceFilename}-${options.fileMap.destFilename}`,
      base: customBranch,
      body: "This PR was automatically created by the `[happi-file-sync-gh](https://github.com/simonloynes/happi-file-sync-gh)` action."
    });
  });

  it('should handle existing branch with update strategy', async () => {
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

    // Mock getRef for main branch
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    // Mock getRef for branch existence check (branch exists)
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    // Mock pulls.list to return existing PR
    mockOctokit.pulls = {
      ...mockOctokit.pulls,
      list: vi.fn().mockResolvedValueOnce({
        data: [{
          number: 123,
          html_url: 'https://github.com/dest-owner/dest-repo/pull/123'
        }]
      })
    };

    // Mock other API calls
    mockOctokit.repos.createOrUpdateFileContents.mockResolvedValueOnce({});

    const options = {
      ...mockOptions(),
      fileMap: {
        ...mockOptions().fileMap,
        existingBranchStrategy: 'update' as const
      }
    };
    
    await syncFiles(options);

    // Verify branch was not created (it already exists)
    expect(mockOctokit.git.createRef).not.toHaveBeenCalled();
    
    // Verify file was updated
    expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalled();
    
    // Verify PR was not created (it already exists)
    expect(mockOctokit.pulls.create).not.toHaveBeenCalled();
  });

  it('should handle existing branch with create-new strategy', async () => {
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

    // Mock getRef for main branch
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    // Mock getRef for branch existence check (branch exists)
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
    mockOctokit.pulls.create.mockResolvedValueOnce({
      data: {
        number: 124,
        html_url: 'https://github.com/dest-owner/dest-repo/pull/124'
      }
    });

    const options = {
      ...mockOptions(),
      fileMap: {
        ...mockOptions().fileMap,
        existingBranchStrategy: 'create-new' as const
      }
    };
    
    await syncFiles(options);

    // Verify new branch was created with timestamp suffix
    expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
      owner: 'dest-owner',
      repo: 'dest-repo',
      ref: expect.stringMatching(/^refs\/heads\/sync-source\.txt-dest\.txt-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/),
      sha: mockSha
    });
    
    // Verify file was updated
    expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalled();
    
    // Verify PR was created
    expect(mockOctokit.pulls.create).toHaveBeenCalled();
  });

  it('should fail when branch exists with fail strategy', async () => {
    // Mock getContent for source file
    mockOctokit.repos.getContent.mockResolvedValueOnce({
      data: {
        content: mockBase64Content,
        sha: mockSha
      }
    });

    // Mock getRef for main branch
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    // Mock getRef for branch existence check (branch exists)
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: {
        object: {
          sha: mockSha
        }
      }
    });

    const options = {
      ...mockOptions(),
      fileMap: {
        ...mockOptions().fileMap,
        existingBranchStrategy: 'fail' as const
      }
    };
    
    await syncFiles(options);

    // Verify error was logged
    expect(core.error).toHaveBeenCalledWith(
      expect.stringContaining('Error creating PR in dest-owner/dest-repo: Branch sync-source.txt-dest.txt already exists')
    );
  });
}); 