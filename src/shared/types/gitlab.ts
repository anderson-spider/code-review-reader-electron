// -----------------------------------------------------------------------------
// GitLab Types
// -----------------------------------------------------------------------------

export interface Author {
  id: number;
  name: string;
  username: string;
  avatar_url?: string;
}

export interface MergeRequest {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  source_branch: string;
  target_branch: string;
  author: Author;
  web_url: string;
  sha: string;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  created_at: string;
  updated_at: string;
  // Validation fields (RN-VAL-002, RN-VAL-003)
  has_conflicts?: boolean;
  merge_status?: 'can_be_merged' | 'cannot_be_merged' | 'unchecked' | 'checking' | 'cannot_be_merged_recheck';
  changes_count?: number;
}

export interface FileChange {
  old_path: string;
  new_path: string;
  diff: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
}

export interface MRChangesResponse {
  changes: FileChange[];
}

export interface GitLabFileResponse {
  file_name: string;
  file_path: string;
  size: number;
  encoding: 'base64';
  content: string;
  ref: string;
}

export interface DiffVersion {
  base_commit_sha: string;
  head_commit_sha: string;
  start_commit_sha: string;
}

export interface GitLabNote {
  id: number;
  body: string;
  author: Author;
  created_at: string;
}

export interface CommentPosition {
  new_path: string | null;
  new_line: number | null;
  old_path: string | null;
  old_line: number | null;
  position_type: 'text' | 'image';
}

export interface GitLabComment {
  id: number;
  body: string;
  position: CommentPosition | null;
  author: Author | null;
}

export interface GitLabDiscussion {
  id: string;
  notes: GitLabComment[];
}

/** GitLab project information for repository operations */
export interface GitLabProject {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  ssh_url_to_repo: string;
  http_url_to_repo: string;
  default_branch: string;
}

/** Parsed GitLab Merge Request URL */
export interface ParsedMRUrl {
  projectPath: string;
  mrIID: number;
}
