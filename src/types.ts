import { Octokit } from "@octokit/rest";
import { z } from "zod";

export const FileMappingSchema = z.object({
	sourcePath: z.string(),
	sourceFilename: z.string(),
	destRepo: z.string(),
	destPath: z.string(),
	destFilename: z.string(),
	destBranch: z.string().optional(),
	existingBranchStrategy: z.enum(['update', 'create-new', 'fail']).optional().default('update')
});

export const FileMappingsSchema = z.record(z.string(), FileMappingSchema);

export const SyncFilesOptionsSchema = z.object({
	githubToken: z.string(),
	fileMappings: FileMappingsSchema
});

export interface FileMapping {
	sourcePath: string;
	sourceFilename: string;
	destRepo: string;
	destPath: string;
	destFilename: string;
	destBranch?: string;
	existingBranchStrategy?: 'update' | 'create-new' | 'fail';
}

export interface FileMappings {
	[filename: string]: FileMapping;
}

export interface SyncFilesOptions {
	fileMap: FileMapping;
	octokit: Octokit;
}

// Type inference from Zod schemas
export type FileMappingType = z.infer<typeof FileMappingSchema>;
export type FileMappingsType = z.infer<typeof FileMappingsSchema>;
export type SyncFilesOptionsType = z.infer<typeof SyncFilesOptionsSchema>;
