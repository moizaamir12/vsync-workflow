/* ── Adapters ──────────────────────────────────────────── */

export { NodeAdapter } from "./node/NodeAdapter.js";
export { MobileAdapter } from "./mobile/MobileAdapter.js";
export { CloudAdapter } from "./cloud/CloudAdapter.js";

/* ── Platform-specific block executors ─────────────────── */

export { nodeImageExecutor } from "./node/blocks/image.js";
export { nodeFilesystemExecutor, validatePath } from "./node/blocks/filesystem.js";
export { nodeFtpExecutor } from "./node/blocks/ftp.js";
export { mobileImageExecutor } from "./mobile/blocks/image.js";
export { mobileLocationExecutor } from "./mobile/blocks/location.js";

/* ── Factory functions ─────────────────────────────────── */

import { Interpreter } from "@vsync/engine";
import type { InterpreterConfig } from "@vsync/engine";
import { NodeAdapter } from "./node/NodeAdapter.js";
import { MobileAdapter } from "./mobile/MobileAdapter.js";
import { CloudAdapter } from "./cloud/CloudAdapter.js";

/**
 * Create an Interpreter pre-configured for Node.js / server environments.
 *
 * Includes all data blocks, flow blocks, image (sharp), filesystem,
 * FTP, validation, and video stub.
 */
export function createNodeInterpreter(
  config?: Partial<InterpreterConfig>,
): Interpreter {
  const interpreter = new Interpreter(config);
  const adapter = new NodeAdapter();
  adapter.registerBlocks(interpreter.blockExecutor);
  return interpreter;
}

/**
 * Create an Interpreter pre-configured for React Native / Expo.
 *
 * Includes all data blocks, flow blocks, image (expo-image-manipulator),
 * location (expo-location), UI blocks, validation, and video stub.
 */
export function createMobileInterpreter(
  config?: Partial<InterpreterConfig>,
): Interpreter {
  const interpreter = new Interpreter(config);
  const adapter = new MobileAdapter();
  adapter.registerBlocks(interpreter.blockExecutor);
  return interpreter;
}

/**
 * Create an Interpreter pre-configured for cloud / serverless environments.
 *
 * Includes only pure-JS data blocks, flow blocks (fetch, agent, code),
 * validation, and video stub. No filesystem, FTP, or image processing.
 */
export function createCloudInterpreter(
  config?: Partial<InterpreterConfig>,
): Interpreter {
  const interpreter = new Interpreter(config);
  const adapter = new CloudAdapter();
  adapter.registerBlocks(interpreter.blockExecutor);
  return interpreter;
}
