import type { BlockSchema } from "./types.js";

export const FTP_SCHEMA: BlockSchema = {
  required: ["ftp_operation", "ftp_host"],
  optional: {
    ftp_port: { default: 21 },
    ftp_username: { default: null },
    ftp_password: { default: null },
    ftp_secure: { default: false },
    ftp_remote_path: { default: "/" },
    ftp_local_path: { default: null },
    ftp_passive: { default: true },
    ftp_timeout_ms: { default: 30000 },
    ftp_bind_value: { default: null },
  },
  commonMistakes: {
    operation: "ftp_operation",
    host: "ftp_host",
    server: "ftp_host",
    port: "ftp_port",
    username: "ftp_username",
    user: "ftp_username",
    password: "ftp_password",
    path: "ftp_remote_path",
    remote_path: "ftp_remote_path",
    local_path: "ftp_local_path",
    bind_value: "ftp_bind_value",
  },
} as const;
