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
    
    // Mock core.getInput values
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'github-token') return mockGithubToken;
      if (name === 'file-mappings') return JSON.stringify({ 'test-mapping': mockFileMapping });
      throw new Error(`Unexpected input: ${name}`);
    });
  });

  it('should throw error if github-token is not provided', async () => {
    // Mock getInput to throw for required input
    vi.mocked(core.getInput).mockImplementation((name, options) => {
      if (name === 'github-token') throw new Error('Input required and not supplied: github-token');
      if (name === 'file-mappings') return JSON.stringify({ 'test-mapping': mockFileMapping });
      throw new Error(`Unexpected input: ${name}`);
    });

    await expect(run()).rejects.toThrow('Input required and not supplied: github-token');
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
    vi.mocked(core.getInput).mockImplementation((name) => {
      if (name === 'github-token') return mockGithubToken;
      if (name === 'file-mappings') return 'invalid-json';
      throw new Error(`Unexpected input: ${name}`);
    });

    await expect(run()).rejects.toThrow();
  });
}); 