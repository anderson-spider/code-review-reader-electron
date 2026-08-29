// -----------------------------------------------------------------------------
// IPC Channel Constants
// -----------------------------------------------------------------------------

// IPC channel names
export const IPC_CHANNELS = {
  // GitLab
  GITLAB_INIT: 'gitlab:init',
  GITLAB_PARSE_URL: 'gitlab:parseUrl',
  GITLAB_FETCH_MR: 'gitlab:fetchMR',
  GITLAB_FETCH_CHANGES: 'gitlab:fetchChanges',
  GITLAB_FETCH_PROJECT: 'gitlab:fetchProject',
  GITLAB_POST_COMMENT: 'gitlab:postComment',
  GITLAB_POST_LINE_COMMENT: 'gitlab:postLineComment',
  GITLAB_DELETE_MY_COMMENTS: 'gitlab:deleteMyComments',
  GITLAB_FETCH_EXISTING_COMMENTS: 'gitlab:fetchExistingComments',
  GITLAB_APPROVE_MR: 'gitlab:approveMR',

  // Review
  REVIEW_GENERATE: 'review:generateReview',
  REVIEW_GENERATE_PARALLEL: 'review:generateParallelReview',
  REVIEW_REFINE_COMMENT: 'review:refineComment',

  // Config
  CONFIG_GET_MEMORY_SETTINGS: 'config:getMemorySettings',
  CONFIG_SET_MEMORY_SETTINGS: 'config:setMemorySettings',

  // Memory
  MEMORY_LIST_CONTAINERS: 'memory:listContainers',

  // Repository (local checkout)
  REPOSITORY_CLONE: 'repository:clone',
  REPOSITORY_READ_CONTEXT: 'repository:readContext',
  REPOSITORY_CLEANUP: 'repository:cleanup',

  // Keychain
  KEYCHAIN_SAVE_TOKEN: 'keychain:saveToken',
  KEYCHAIN_GET_TOKEN: 'keychain:getToken',
  KEYCHAIN_HAS_TOKEN: 'keychain:hasToken',
  KEYCHAIN_DELETE_TOKEN: 'keychain:deleteToken',

  // App
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_PLATFORM: 'app:getPlatform',

  // Logs
  LOG_ENTRY: 'log:entry',
} as const;
