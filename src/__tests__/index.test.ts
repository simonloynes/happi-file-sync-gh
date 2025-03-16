import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { run } from '../index';
import { syncFiles } from '../syncFiles';
import { FileMapping } from '../types';

// Mock dependencies
vi.mock('@actions/core');
vi.mock('../syncFiles');
vi.mock('@octokit/rest');

describe('run', () => {
  const mockGithubToken = 'mock-token';
  const mockFileMapping: FileMapping = {
    sourcePath: 'source/path',
    sourceFilename: 'test.txt',
    destRepo: 'dest/repo',
    destPath: 'dest/path',
    destFilename: 'test.txt'
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    
    // Setup environment variable
    process.env.GITHUB_TOKEN = mockGithubToken;

    // Mock core.getInput to return our test file mappings
    vi.mocked(core.getInput).mockReturnValue(JSON.stringify({
      'test-mapping': mockFileMapping
    }));
  });

  it('should throw error if GITHUB_TOKEN is not set', async () => {
    // Remove the token for this test
    delete process.env.GITHUB_TOKEN;

    await expect(run()).rejects.toThrow('GITHUB_TOKEN is not set');
  });

  it('should initialize Octokit with the correct token', async () => {
    await run();

    expect(Octokit).toHaveBeenCalledWith({ auth: mockGithubToken });
  });

  it('should call syncFiles with correct parameters', async () => {
    const mockOctokit = new Octokit({ auth: mockGithubToken });
    vi.mocked(Octokit).mockImplementation(() => mockOctokit);

    await run();

    expect(syncFiles).toHaveBeenCalledWith({
      octokit: mockOctokit,
      fileMap: mockFileMapping
    });
  });

  it('should handle invalid file mappings input', async () => {
    // Mock core.getInput to return invalid JSON
    vi.mocked(core.getInput).mockReturnValue('invalid-json');

    await expect(run()).rejects.toThrow();
  });
}); 