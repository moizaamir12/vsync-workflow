/* Schema tables */
export {
  users,
  sessions,
  accounts,
  verifications,
  organizations,
  orgMembers,
  workflows,
  workflowVersions,
  blocks,
  secrets,
  runs,
  artifacts,
  publicRuns,
  cache,
  devices,
  keys,
  keyAuditLog,
  chats,
  messages,
} from "./schema/index.js";

/* Database client factories */
export {
  createPostgresClient,
  createPgliteClient,
  type Database,
} from "./client.js";

/* Repository classes */
export {
  WorkflowRepository,
  RunRepository,
  UserRepository,
  OrgRepository,
  ArtifactRepository,
  KeyRepository,
  CacheRepository,
  PublicRunRepository,
} from "./repositories/index.js";

/* ── SQLite (desktop / offline) ──────────────────────────────────── */

/* SQLite schema tables */
export {
  sqliteUsers,
  sqliteSessions,
  sqliteAccounts,
  sqliteVerifications,
  sqliteOrganizations,
  sqliteOrgMembers,
  sqliteWorkflows,
  sqliteWorkflowVersions,
  sqliteBlocks,
  sqliteSecrets,
  sqliteRuns,
  sqliteArtifacts,
  sqlitePublicRuns,
  sqliteCache,
  sqliteDevices,
  sqliteKeys,
  sqliteKeyAuditLog,
  sqliteChats,
  sqliteMessages,
  sqliteSyncQueue,
} from "./schema/sqlite.js";

/* SQLite client factory */
export {
  createSQLiteClient,
  type SqliteDatabase,
} from "./sqlite-client.js";

/* SQLite repository classes */
export {
  SqliteWorkflowRepository,
  SqliteRunRepository,
  SqliteUserRepository,
  SqliteOrgRepository,
  SqliteArtifactRepository,
} from "./repositories/sqlite/index.js";
