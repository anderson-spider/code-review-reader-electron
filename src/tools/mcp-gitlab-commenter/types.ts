export type Severity = 'critical' | 'warning' | 'suggestion' | 'info';

export interface ReviewComment {
  id: string;
  filePath: string;
  lineNumber: number | null;
  severity: Severity;
  comment: string;
  codeSnippet?: string;
}

export interface FileChange {
  old_path: string;
  new_path: string;
  diff: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
}

export interface DiffVersion {
  base_commit_sha: string;
  head_commit_sha: string;
  start_commit_sha: string;
}

export interface CommentPosition {
  position_type: 'text';
  base_sha: string;
  head_sha: string;
  start_sha: string;
  new_path: string;
  new_line: number;
  old_path?: string;
  old_line?: number | null;
}

export interface GitLabNote {
  id: number;
  body: string;
}

export interface GitLabComment {
  id: number;
  body: string;
  position: {
    new_path: string | null;
    new_line: number | null;
    old_path: string | null;
    old_line: number | null;
  } | null;
}

export interface GitLabDiscussion {
  id: string;
  notes: GitLabComment[];
}

export interface MergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  source_branch: string;
  target_branch: string;
  web_url: string;
  state: string;
}

export interface MRChangesResponse {
  changes: FileChange[];
}

export interface PostResult {
  posted: number;
  skipped: number;
  failed: number;
  duplicates: number;
  errors: string[];
}
