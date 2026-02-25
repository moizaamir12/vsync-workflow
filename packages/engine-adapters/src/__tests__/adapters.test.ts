import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { Block, WorkflowContext, BlockType } from "@vsync/shared-types";
import type { BlockResult } from "@vsync/engine";
import { BlockExecutor, Interpreter } from "@vsync/engine";
import { NodeAdapter } from "../node/NodeAdapter.js";
import { MobileAdapter } from "../mobile/MobileAdapter.js";
import { CloudAdapter } from "../cloud/CloudAdapter.js";
import { nodeFilesystemExecutor, validatePath } from "../node/blocks/filesystem.js";
import { nodeImageExecutor } from "../node/blocks/image.js";
import {
  createNodeInterpreter,
  createMobileInterpreter,
  createCloudInterpreter,
} from "../index.js";

/* ── Test helpers ────────────────────────────────────────── */

function makeBlock(logic: Record<string, unknown>, type: BlockType = "object"): Block {
  return {
    id: "test-block",
    workflowId: "wf-1",
    workflowVersion: 1,
    name: "Test Block",
    type,
    logic,
    order: 0,
  };
}

function makeContext(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    state: {},
    cache: new Map(),
    artifacts: [],
    secrets: {},
    run: {
      id: "run-1",
      workflowId: "wf-1",
      versionId: "wf-1:v1",
      status: "running",
      triggerType: "interactive",
      startedAt: new Date().toISOString(),
      platform: "test",
      deviceId: "test-device",
    },
    event: {},
    loops: {},
    paths: {},
    ...overrides,
  };
}

/* ────────────────────────────────────────────────────────── */
/*  NodeAdapter                                              */
/* ────────────────────────────────────────────────────────── */

describe("NodeAdapter", () => {
  let adapter: NodeAdapter;

  beforeEach(() => {
    adapter = new NodeAdapter();
  });

  it("has platform = 'node'", () => {
    expect(adapter.platform).toBe("node");
  });

  describe("capabilities", () => {
    it("has filesystem access", () => {
      expect(adapter.capabilities.hasFilesystem).toBe(true);
    });

    it("has FTP access", () => {
      expect(adapter.capabilities.hasFtp).toBe(true);
    });

    it("has no camera", () => {
      expect(adapter.capabilities.hasCamera).toBe(false);
    });

    it("has no UI", () => {
      expect(adapter.capabilities.hasUi).toBe(false);
    });

    it("has no video", () => {
      expect(adapter.capabilities.hasVideo).toBe(false);
    });

    it("has no location", () => {
      expect(adapter.capabilities.hasLocation).toBe(false);
    });
  });

  describe("supports()", () => {
    it("supports all data block types", () => {
      const dataTypes: BlockType[] = ["object", "string", "array", "math", "date", "normalize"];
      for (const type of dataTypes) {
        expect(adapter.supports(type)).toBe(true);
      }
    });

    it("supports flow block types", () => {
      const flowTypes: BlockType[] = ["fetch", "agent", "goto", "sleep", "code"];
      for (const type of flowTypes) {
        expect(adapter.supports(type)).toBe(true);
      }
    });

    it("supports filesystem", () => {
      expect(adapter.supports("filesystem")).toBe(true);
    });

    it("supports ftp", () => {
      expect(adapter.supports("ftp")).toBe(true);
    });

    it("supports image", () => {
      /* Image is not in the capMap — universally supported */
      expect(adapter.supports("image")).toBe(true);
    });

    it("does not support ui_camera", () => {
      expect(adapter.supports("ui_camera")).toBe(false);
    });

    it("does not support ui_form", () => {
      expect(adapter.supports("ui_form")).toBe(false);
    });

    it("does not support ui_table", () => {
      expect(adapter.supports("ui_table")).toBe(false);
    });

    it("does not support ui_details", () => {
      expect(adapter.supports("ui_details")).toBe(false);
    });

    it("does not support video", () => {
      expect(adapter.supports("video")).toBe(false);
    });

    it("does not support location (no GPS)", () => {
      expect(adapter.supports("location")).toBe(false);
    });
  });

  describe("registerBlocks()", () => {
    it("registers data block handlers", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      const dataTypes = ["object", "string", "array", "math", "date", "normalize"];
      for (const type of dataTypes) {
        expect(registered).toContain(type);
      }
    });

    it("registers flow block handlers", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      const flowTypes = ["fetch", "agent", "goto", "sleep", "location", "code"];
      for (const type of flowTypes) {
        expect(registered).toContain(type);
      }
    });

    it("registers platform-specific handlers", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      expect(registered).toContain("image");
      expect(registered).toContain("filesystem");
      expect(registered).toContain("ftp");
    });

    it("registers validation handler", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      expect(registered).toContain("validation");
    });

    it("registers video stub", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      expect(registered).toContain("video");
    });

    it("registers at least 15 block types total", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      /* 6 data + 6 flow + image + filesystem + ftp + validation + video = 17 */
      expect(executor.getRegisteredTypes().length).toBeGreaterThanOrEqual(15);
    });
  });

  describe("getLocation()", () => {
    it("returns null (no GPS on server)", () => {
      expect(adapter.getLocation()).toBeNull();
    });
  });

  describe("getFilesystem()", () => {
    it("returns null (filesystem is built into block)", () => {
      expect(adapter.getFilesystem()).toBeNull();
    });
  });

  describe("video stub", () => {
    it("throws when video block is executed", async () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const block = makeBlock({}, "video");
      const ctx = makeContext();

      await expect(executor.execute(block, ctx)).rejects.toThrow(
        "Video block is planned for a future release",
      );
    });
  });
});

/* ────────────────────────────────────────────────────────── */
/*  MobileAdapter                                            */
/* ────────────────────────────────────────────────────────── */

describe("MobileAdapter", () => {
  let adapter: MobileAdapter;

  beforeEach(() => {
    adapter = new MobileAdapter();
  });

  it("has platform = 'mobile'", () => {
    expect(adapter.platform).toBe("mobile");
  });

  describe("capabilities", () => {
    it("has camera", () => {
      expect(adapter.capabilities.hasCamera).toBe(true);
    });

    it("has UI", () => {
      expect(adapter.capabilities.hasUi).toBe(true);
    });

    it("has location", () => {
      expect(adapter.capabilities.hasLocation).toBe(true);
    });

    it("has no filesystem", () => {
      expect(adapter.capabilities.hasFilesystem).toBe(false);
    });

    it("has no FTP", () => {
      expect(adapter.capabilities.hasFtp).toBe(false);
    });

    it("has no video", () => {
      expect(adapter.capabilities.hasVideo).toBe(false);
    });
  });

  describe("supports()", () => {
    it("supports data blocks", () => {
      const dataTypes: BlockType[] = ["object", "string", "array", "math", "date", "normalize"];
      for (const type of dataTypes) {
        expect(adapter.supports(type)).toBe(true);
      }
    });

    it("supports flow blocks", () => {
      const flowTypes: BlockType[] = ["fetch", "agent", "goto", "sleep", "code"];
      for (const type of flowTypes) {
        expect(adapter.supports(type)).toBe(true);
      }
    });

    it("supports ui_camera", () => {
      expect(adapter.supports("ui_camera")).toBe(true);
    });

    it("supports ui_form", () => {
      expect(adapter.supports("ui_form")).toBe(true);
    });

    it("supports ui_table", () => {
      expect(adapter.supports("ui_table")).toBe(true);
    });

    it("supports ui_details", () => {
      expect(adapter.supports("ui_details")).toBe(true);
    });

    it("supports location", () => {
      expect(adapter.supports("location")).toBe(true);
    });

    it("does not support filesystem", () => {
      expect(adapter.supports("filesystem")).toBe(false);
    });

    it("does not support ftp", () => {
      expect(adapter.supports("ftp")).toBe(false);
    });

    it("does not support video", () => {
      expect(adapter.supports("video")).toBe(false);
    });
  });

  describe("registerBlocks()", () => {
    it("registers data block handlers", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      const dataTypes = ["object", "string", "array", "math", "date", "normalize"];
      for (const type of dataTypes) {
        expect(registered).toContain(type);
      }
    });

    it("registers flow block handlers", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      const flowTypes = ["fetch", "agent", "goto", "sleep", "location", "code"];
      for (const type of flowTypes) {
        expect(registered).toContain(type);
      }
    });

    it("registers image and location handlers", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      expect(registered).toContain("image");
      expect(registered).toContain("location");
    });

    it("registers UI block handlers", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      expect(registered).toContain("ui_camera");
      expect(registered).toContain("ui_form");
      expect(registered).toContain("ui_table");
      expect(registered).toContain("ui_details");
    });

    it("registers validation handler", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      expect(executor.getRegisteredTypes()).toContain("validation");
    });

    it("registers video stub", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      expect(executor.getRegisteredTypes()).toContain("video");
    });

    it("does NOT register filesystem or ftp handlers", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      expect(registered).not.toContain("filesystem");
      expect(registered).not.toContain("ftp");
    });
  });

  describe("getLocation()", () => {
    it("returns 'expo-location'", () => {
      expect(adapter.getLocation()).toBe("expo-location");
    });
  });

  describe("getFilesystem()", () => {
    it("returns null (no filesystem)", () => {
      expect(adapter.getFilesystem()).toBeNull();
    });
  });

  describe("video stub", () => {
    it("throws when video block is executed", async () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const block = makeBlock({}, "video");
      const ctx = makeContext();

      await expect(executor.execute(block, ctx)).rejects.toThrow(
        "Video block is planned for a future release",
      );
    });
  });

  describe("UI passthrough handlers", () => {
    it("ui_camera returns empty result", async () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const block = makeBlock({}, "ui_camera");
      const ctx = makeContext();

      const result = await executor.execute(block, ctx);
      expect(result).toEqual({});
    });

    it("ui_form returns empty result", async () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const block = makeBlock({}, "ui_form");
      const ctx = makeContext();

      const result = await executor.execute(block, ctx);
      expect(result).toEqual({});
    });
  });
});

/* ────────────────────────────────────────────────────────── */
/*  CloudAdapter                                             */
/* ────────────────────────────────────────────────────────── */

describe("CloudAdapter", () => {
  let adapter: CloudAdapter;

  beforeEach(() => {
    adapter = new CloudAdapter();
  });

  it("has platform = 'cloud'", () => {
    expect(adapter.platform).toBe("cloud");
  });

  describe("capabilities", () => {
    it("has no camera", () => {
      expect(adapter.capabilities.hasCamera).toBe(false);
    });

    it("has no filesystem", () => {
      expect(adapter.capabilities.hasFilesystem).toBe(false);
    });

    it("has no FTP", () => {
      expect(adapter.capabilities.hasFtp).toBe(false);
    });

    it("has no UI", () => {
      expect(adapter.capabilities.hasUi).toBe(false);
    });

    it("has no video", () => {
      expect(adapter.capabilities.hasVideo).toBe(false);
    });

    it("has no location", () => {
      expect(adapter.capabilities.hasLocation).toBe(false);
    });

    it("all capabilities are false", () => {
      const caps = adapter.capabilities;
      const allFalse = Object.values(caps).every((v) => v === false);
      expect(allFalse).toBe(true);
    });
  });

  describe("supports()", () => {
    it("supports data blocks", () => {
      const dataTypes: BlockType[] = ["object", "string", "array", "math", "date", "normalize"];
      for (const type of dataTypes) {
        expect(adapter.supports(type)).toBe(true);
      }
    });

    it("supports flow blocks", () => {
      const flowTypes: BlockType[] = ["fetch", "agent", "goto", "sleep", "code"];
      for (const type of flowTypes) {
        expect(adapter.supports(type)).toBe(true);
      }
    });

    it("does not support ui_camera", () => {
      expect(adapter.supports("ui_camera")).toBe(false);
    });

    it("does not support ui_form", () => {
      expect(adapter.supports("ui_form")).toBe(false);
    });

    it("does not support filesystem", () => {
      expect(adapter.supports("filesystem")).toBe(false);
    });

    it("does not support ftp", () => {
      expect(adapter.supports("ftp")).toBe(false);
    });

    it("does not support video", () => {
      expect(adapter.supports("video")).toBe(false);
    });

    it("does not support location", () => {
      expect(adapter.supports("location")).toBe(false);
    });
  });

  describe("registerBlocks()", () => {
    it("registers data block handlers", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      const dataTypes = ["object", "string", "array", "math", "date", "normalize"];
      for (const type of dataTypes) {
        expect(registered).toContain(type);
      }
    });

    it("registers flow block handlers", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const registered = executor.getRegisteredTypes();
      const flowTypes = ["fetch", "agent", "goto", "sleep", "location", "code"];
      for (const type of flowTypes) {
        expect(registered).toContain(type);
      }
    });

    it("registers validation handler", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      expect(executor.getRegisteredTypes()).toContain("validation");
    });

    it("registers video stub", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      expect(executor.getRegisteredTypes()).toContain("video");
    });

    it("registers image, filesystem, ftp as unsupported stubs", () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      /* They are registered but throw clear errors */
      const registered = executor.getRegisteredTypes();
      expect(registered).toContain("image");
      expect(registered).toContain("filesystem");
      expect(registered).toContain("ftp");
    });
  });

  describe("unsupported block stubs throw clear errors", () => {
    it("image throws on cloud platform", async () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const block = makeBlock({}, "image");
      const ctx = makeContext();

      await expect(executor.execute(block, ctx)).rejects.toThrow(
        '"image" block is not supported on the cloud platform',
      );
    });

    it("filesystem throws on cloud platform", async () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const block = makeBlock({}, "filesystem");
      const ctx = makeContext();

      await expect(executor.execute(block, ctx)).rejects.toThrow(
        '"filesystem" block is not supported on the cloud platform',
      );
    });

    it("ftp throws on cloud platform", async () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const block = makeBlock({}, "ftp");
      const ctx = makeContext();

      await expect(executor.execute(block, ctx)).rejects.toThrow(
        '"ftp" block is not supported on the cloud platform',
      );
    });
  });

  describe("video stub", () => {
    it("throws when video block is executed", async () => {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const block = makeBlock({}, "video");
      const ctx = makeContext();

      await expect(executor.execute(block, ctx)).rejects.toThrow(
        "Video block is planned for a future release",
      );
    });
  });

  describe("getLocation()", () => {
    it("returns null (no GPS in cloud)", () => {
      expect(adapter.getLocation()).toBeNull();
    });
  });

  describe("getFilesystem()", () => {
    it("returns null (no persistent filesystem in cloud)", () => {
      expect(adapter.getFilesystem()).toBeNull();
    });
  });
});

/* ────────────────────────────────────────────────────────── */
/*  Filesystem block (node)                                  */
/* ────────────────────────────────────────────────────────── */

describe("nodeFilesystemExecutor", () => {
  let tmpDir: string;
  let ctx: WorkflowContext;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vsync-fs-test-"));
    ctx = makeContext();
  });

  describe("validatePath()", () => {
    it("allows absolute paths", () => {
      expect(validatePath("/tmp/test.txt")).toBe("/tmp/test.txt");
    });

    it("allows relative paths without traversal", () => {
      expect(validatePath("data/output.txt")).toBe("data/output.txt");
    });

    it("rejects directory traversal with ..", () => {
      expect(() => validatePath("../../../etc/passwd")).toThrow(
        "directory traversal",
      );
    });

    it("rejects hidden traversal via path normalization", () => {
      expect(() => validatePath("data/../../../etc/passwd")).toThrow(
        "directory traversal",
      );
    });

    it("normalizes redundant separators", () => {
      const result = validatePath("/tmp///test.txt");
      expect(result).toBe("/tmp/test.txt");
    });
  });

  describe("read operation", () => {
    it("reads a file and returns content with size", async () => {
      const testFile = path.join(tmpDir, "read-test.txt");
      await fs.writeFile(testFile, "hello vsync");

      const block = makeBlock(
        {
          filesystem_operation: "read",
          filesystem_path: testFile,
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      expect(result.stateDelta).toBeDefined();

      const data = result.stateDelta!.result as { content: string; size: number; path: string };
      expect(data.content).toBe("hello vsync");
      expect(data.size).toBeGreaterThan(0);
      expect(data.path).toBe(testFile);
    });
  });

  describe("write operation", () => {
    it("writes content to a file", async () => {
      const testFile = path.join(tmpDir, "write-test.txt");

      const block = makeBlock(
        {
          filesystem_operation: "write",
          filesystem_path: testFile,
          filesystem_content: "test data",
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      expect(result.stateDelta).toBeDefined();

      const data = result.stateDelta!.result as { path: string; size: number };
      expect(data.path).toBe(testFile);
      expect(data.size).toBeGreaterThan(0);

      /* Verify file was actually written */
      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toBe("test data");
    });

    it("creates parent directories automatically", async () => {
      const testFile = path.join(tmpDir, "sub", "deep", "write-test.txt");

      const block = makeBlock(
        {
          filesystem_operation: "write",
          filesystem_path: testFile,
          filesystem_content: "nested",
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      await nodeFilesystemExecutor(block, ctx);

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toBe("nested");
    });
  });

  describe("delete operation", () => {
    it("deletes an existing file", async () => {
      const testFile = path.join(tmpDir, "delete-test.txt");
      await fs.writeFile(testFile, "to be deleted");

      const block = makeBlock(
        {
          filesystem_operation: "delete",
          filesystem_path: testFile,
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      const data = result.stateDelta!.result as { deleted: boolean };
      expect(data.deleted).toBe(true);

      /* Verify file is gone */
      await expect(fs.access(testFile)).rejects.toThrow();
    });

    it("returns deleted=false for nonexistent file", async () => {
      const block = makeBlock(
        {
          filesystem_operation: "delete",
          filesystem_path: path.join(tmpDir, "nonexistent.txt"),
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      const data = result.stateDelta!.result as { deleted: boolean };
      expect(data.deleted).toBe(false);
    });
  });

  describe("exists operation", () => {
    it("returns exists=true for a file", async () => {
      const testFile = path.join(tmpDir, "exists-test.txt");
      await fs.writeFile(testFile, "here");

      const block = makeBlock(
        {
          filesystem_operation: "exists",
          filesystem_path: testFile,
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      const data = result.stateDelta!.result as {
        exists: boolean;
        isFile: boolean;
        isDirectory: boolean;
      };
      expect(data.exists).toBe(true);
      expect(data.isFile).toBe(true);
      expect(data.isDirectory).toBe(false);
    });

    it("returns exists=true for a directory", async () => {
      const block = makeBlock(
        {
          filesystem_operation: "exists",
          filesystem_path: tmpDir,
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      const data = result.stateDelta!.result as {
        exists: boolean;
        isFile: boolean;
        isDirectory: boolean;
      };
      expect(data.exists).toBe(true);
      expect(data.isFile).toBe(false);
      expect(data.isDirectory).toBe(true);
    });

    it("returns exists=false for nonexistent path", async () => {
      const block = makeBlock(
        {
          filesystem_operation: "exists",
          filesystem_path: path.join(tmpDir, "nope.txt"),
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      const data = result.stateDelta!.result as { exists: boolean };
      expect(data.exists).toBe(false);
    });
  });

  describe("list operation", () => {
    it("lists directory entries", async () => {
      await fs.writeFile(path.join(tmpDir, "a.txt"), "aaa");
      await fs.writeFile(path.join(tmpDir, "b.txt"), "bbb");
      await fs.mkdir(path.join(tmpDir, "subdir"));

      const block = makeBlock(
        {
          filesystem_operation: "list",
          filesystem_path: tmpDir,
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      const data = result.stateDelta!.result as {
        entries: { name: string; type: string; size: number }[];
      };

      const names = data.entries.map((e) => e.name);
      expect(names).toContain("a.txt");
      expect(names).toContain("b.txt");
      expect(names).toContain("subdir");

      const dir = data.entries.find((e) => e.name === "subdir");
      expect(dir!.type).toBe("directory");

      const file = data.entries.find((e) => e.name === "a.txt");
      expect(file!.type).toBe("file");
      expect(file!.size).toBeGreaterThan(0);
    });

    it("filters entries with pattern", async () => {
      await fs.writeFile(path.join(tmpDir, "data.json"), "{}");
      await fs.writeFile(path.join(tmpDir, "config.json"), "{}");
      await fs.writeFile(path.join(tmpDir, "readme.md"), "# hi");

      const block = makeBlock(
        {
          filesystem_operation: "list",
          filesystem_path: tmpDir,
          filesystem_pattern: "*.json",
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      const data = result.stateDelta!.result as {
        entries: { name: string }[];
      };

      expect(data.entries).toHaveLength(2);
      const names = data.entries.map((e) => e.name);
      expect(names).toContain("data.json");
      expect(names).toContain("config.json");
    });
  });

  describe("mkdir operation", () => {
    it("creates a directory", async () => {
      const dirPath = path.join(tmpDir, "new-dir");

      const block = makeBlock(
        {
          filesystem_operation: "mkdir",
          filesystem_path: dirPath,
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      const data = result.stateDelta!.result as { created: boolean };
      expect(data.created).toBe(true);

      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe("append operation", () => {
    it("appends content to a file", async () => {
      const testFile = path.join(tmpDir, "append-test.txt");
      await fs.writeFile(testFile, "line 1\n");

      const block = makeBlock(
        {
          filesystem_operation: "append",
          filesystem_path: testFile,
          filesystem_content: "line 2\n",
          filesystem_bind_value: "result",
        },
        "filesystem",
      );

      await nodeFilesystemExecutor(block, ctx);

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toBe("line 1\nline 2\n");
    });
  });

  describe("error handling", () => {
    it("throws for missing operation", async () => {
      const block = makeBlock(
        { filesystem_path: "/tmp/test.txt" },
        "filesystem",
      );

      await expect(nodeFilesystemExecutor(block, ctx)).rejects.toThrow(
        "filesystem_operation is required",
      );
    });

    it("throws for missing path", async () => {
      const block = makeBlock(
        { filesystem_operation: "read" },
        "filesystem",
      );

      await expect(nodeFilesystemExecutor(block, ctx)).rejects.toThrow(
        "filesystem_path is required",
      );
    });

    it("throws for unknown operation", async () => {
      const block = makeBlock(
        {
          filesystem_operation: "truncate",
          filesystem_path: "/tmp/test.txt",
        },
        "filesystem",
      );

      await expect(nodeFilesystemExecutor(block, ctx)).rejects.toThrow(
        'Unknown filesystem operation: "truncate"',
      );
    });

    it("throws for path traversal", async () => {
      const block = makeBlock(
        {
          filesystem_operation: "read",
          filesystem_path: "../../../etc/passwd",
        },
        "filesystem",
      );

      await expect(nodeFilesystemExecutor(block, ctx)).rejects.toThrow(
        "directory traversal",
      );
    });
  });

  describe("bind value handling", () => {
    it("returns empty object when no bind_value", async () => {
      const testFile = path.join(tmpDir, "no-bind.txt");
      await fs.writeFile(testFile, "test");

      const block = makeBlock(
        {
          filesystem_operation: "read",
          filesystem_path: testFile,
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      expect(result).toEqual({});
    });

    it("strips $state. prefix from bind key", async () => {
      const testFile = path.join(tmpDir, "bind-prefix.txt");
      await fs.writeFile(testFile, "data");

      const block = makeBlock(
        {
          filesystem_operation: "read",
          filesystem_path: testFile,
          filesystem_bind_value: "$state.fileData",
        },
        "filesystem",
      );

      const result = await nodeFilesystemExecutor(block, ctx);
      expect(result.stateDelta).toBeDefined();
      expect(result.stateDelta!.fileData).toBeDefined();
    });
  });
});

/* ────────────────────────────────────────────────────────── */
/*  Image block (node) — requires real sharp                 */
/* ────────────────────────────────────────────────────────── */

describe("nodeImageExecutor", () => {
  let tmpDir: string;
  let ctx: WorkflowContext;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vsync-img-test-"));
    ctx = makeContext();
  });

  describe("error handling", () => {
    it("throws for missing operation", async () => {
      const block = makeBlock({ image_source: "/tmp/test.png" }, "image");

      await expect(nodeImageExecutor(block, ctx)).rejects.toThrow(
        "image_operation is required",
      );
    });

    it("throws for missing source", async () => {
      const block = makeBlock({ image_operation: "resize" }, "image");

      await expect(nodeImageExecutor(block, ctx)).rejects.toThrow(
        "image_source is required",
      );
    });

    it("throws for unknown operation", async () => {
      const block = makeBlock(
        { image_operation: "invert", image_source: "/tmp/test.png" },
        "image",
      );

      await expect(nodeImageExecutor(block, ctx)).rejects.toThrow(
        'Unknown image operation: "invert"',
      );
    });

    it("throws for extract_barcodes (not implemented)", async () => {
      const block = makeBlock(
        { image_operation: "extract_barcodes", image_source: "/tmp/test.png" },
        "image",
      );

      await expect(nodeImageExecutor(block, ctx)).rejects.toThrow(
        "extract_barcodes is not yet implemented",
      );
    });
  });

  describe("resize operation", () => {
    it("resizes an image to specified dimensions", async () => {
      /* Create a test PNG using sharp */
      const sharp = (await import("sharp")).default;
      const testFile = path.join(tmpDir, "test-resize.png");
      await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .png()
        .toFile(testFile);

      const block = makeBlock(
        {
          image_operation: "resize",
          image_source: testFile,
          image_resize: { width: 50, height: 50 },
          image_bind_value: "result",
        },
        "image",
      );

      const result = await nodeImageExecutor(block, ctx);
      expect(result.stateDelta).toBeDefined();

      const data = result.stateDelta!.result as { filePath: string; width: number; height: number };
      expect(data.width).toBe(50);
      expect(data.height).toBe(50);
    });

    it("throws for resize without width or height", async () => {
      const sharp = (await import("sharp")).default;
      const testFile = path.join(tmpDir, "test-resize-err.png");
      await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } },
      })
        .png()
        .toFile(testFile);

      const block = makeBlock(
        {
          image_operation: "resize",
          image_source: testFile,
          image_resize: {},
          image_bind_value: "result",
        },
        "image",
      );

      await expect(nodeImageExecutor(block, ctx)).rejects.toThrow(
        "image_resize requires at least width or height",
      );
    });
  });

  describe("rotate operation", () => {
    it("rotates an image", async () => {
      const sharp = (await import("sharp")).default;
      const testFile = path.join(tmpDir, "test-rotate.png");
      await sharp({
        create: { width: 100, height: 50, channels: 3, background: { r: 0, g: 0, b: 255 } },
      })
        .png()
        .toFile(testFile);

      const block = makeBlock(
        {
          image_operation: "rotate",
          image_source: testFile,
          image_rotate_degrees: 90,
          image_bind_value: "result",
        },
        "image",
      );

      const result = await nodeImageExecutor(block, ctx);
      expect(result.stateDelta).toBeDefined();
      const data = result.stateDelta!.result as { width: number; height: number };
      /* After rotating 90 degrees, width and height swap */
      expect(data.width).toBe(50);
      expect(data.height).toBe(100);
    });
  });

  describe("compress operation", () => {
    it("compresses an image to JPEG", async () => {
      const sharp = (await import("sharp")).default;
      const testFile = path.join(tmpDir, "test-compress.png");
      await sharp({
        create: { width: 200, height: 200, channels: 3, background: { r: 128, g: 128, b: 128 } },
      })
        .png()
        .toFile(testFile);

      const block = makeBlock(
        {
          image_operation: "compress",
          image_source: testFile,
          image_compress_quality: 50,
          image_compress_format: "jpeg",
          image_bind_value: "result",
        },
        "image",
      );

      const result = await nodeImageExecutor(block, ctx);
      expect(result.stateDelta).toBeDefined();
      const data = result.stateDelta!.result as { size: number };
      expect(data.size).toBeGreaterThan(0);
    });

    it("throws for unsupported format", async () => {
      const sharp = (await import("sharp")).default;
      const testFile = path.join(tmpDir, "test-compress-err.png");
      await sharp({
        create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .png()
        .toFile(testFile);

      const block = makeBlock(
        {
          image_operation: "compress",
          image_source: testFile,
          image_compress_format: "bmp",
          image_bind_value: "result",
        },
        "image",
      );

      await expect(nodeImageExecutor(block, ctx)).rejects.toThrow(
        'Unsupported compress format: "bmp"',
      );
    });
  });

  describe("crop operation", () => {
    it("crops an image", async () => {
      const sharp = (await import("sharp")).default;
      const testFile = path.join(tmpDir, "test-crop.png");
      await sharp({
        create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 255, b: 0 } },
      })
        .png()
        .toFile(testFile);

      const block = makeBlock(
        {
          image_operation: "crop",
          image_source: testFile,
          image_crop: { left: 10, top: 10, width: 50, height: 50 },
          image_bind_value: "result",
        },
        "image",
      );

      const result = await nodeImageExecutor(block, ctx);
      const data = result.stateDelta!.result as { width: number; height: number };
      expect(data.width).toBe(50);
      expect(data.height).toBe(50);
    });

    it("throws for crop without dimensions", async () => {
      const block = makeBlock(
        {
          image_operation: "crop",
          image_source: "/tmp/test.png",
          image_crop: null,
        },
        "image",
      );

      await expect(nodeImageExecutor(block, ctx)).rejects.toThrow(
        "image_crop must be an object",
      );
    });
  });

  describe("flip operation", () => {
    it("flips an image horizontally", async () => {
      const sharp = (await import("sharp")).default;
      const testFile = path.join(tmpDir, "test-flip.png");
      await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 128, b: 255 } },
      })
        .png()
        .toFile(testFile);

      const block = makeBlock(
        {
          image_operation: "flip",
          image_source: testFile,
          image_flip_direction: "horizontal",
          image_bind_value: "result",
        },
        "image",
      );

      const result = await nodeImageExecutor(block, ctx);
      expect(result.stateDelta).toBeDefined();
      const data = result.stateDelta!.result as { width: number; height: number };
      expect(data.width).toBe(100);
      expect(data.height).toBe(100);
    });
  });

  describe("source resolution", () => {
    it("resolves source from artifact by ID", async () => {
      const sharp = (await import("sharp")).default;
      const testFile = path.join(tmpDir, "artifact-test.png");
      await sharp({
        create: { width: 80, height: 80, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .png()
        .toFile(testFile);

      const ctxWithArtifact = makeContext({
        artifacts: [
          {
            id: "art-1",
            workflowId: "wf-1",
            type: "image",
            name: "test-image",
            filePath: testFile,
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const block = makeBlock(
        {
          image_operation: "resize",
          image_source: "art-1",
          image_resize: { width: 40 },
          image_bind_value: "result",
        },
        "image",
      );

      const result = await nodeImageExecutor(block, ctxWithArtifact);
      expect(result.stateDelta).toBeDefined();
    });

    it("resolves source from $state reference", async () => {
      const sharp = (await import("sharp")).default;
      const testFile = path.join(tmpDir, "state-test.png");
      await sharp({
        create: { width: 60, height: 60, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .png()
        .toFile(testFile);

      const ctxWithState = makeContext({
        state: { imagePath: testFile },
      });

      const block = makeBlock(
        {
          image_operation: "resize",
          image_source: "$state.imagePath",
          image_resize: { width: 30 },
          image_bind_value: "result",
        },
        "image",
      );

      const result = await nodeImageExecutor(block, ctxWithState);
      expect(result.stateDelta).toBeDefined();
    });
  });
});

/* ────────────────────────────────────────────────────────── */
/*  Factory functions                                        */
/* ────────────────────────────────────────────────────────── */

describe("Factory functions", () => {
  describe("createNodeInterpreter()", () => {
    it("returns an Interpreter instance", () => {
      const interpreter = createNodeInterpreter();
      expect(interpreter).toBeInstanceOf(Interpreter);
    });

    it("has all block types registered", () => {
      const interpreter = createNodeInterpreter();
      const types = interpreter.blockExecutor.getRegisteredTypes();

      /* Data blocks */
      expect(types).toContain("object");
      expect(types).toContain("string");
      expect(types).toContain("array");
      expect(types).toContain("math");
      expect(types).toContain("date");
      expect(types).toContain("normalize");

      /* Flow blocks */
      expect(types).toContain("fetch");
      expect(types).toContain("agent");
      expect(types).toContain("goto");
      expect(types).toContain("sleep");
      expect(types).toContain("code");

      /* Platform blocks */
      expect(types).toContain("image");
      expect(types).toContain("filesystem");
      expect(types).toContain("ftp");
      expect(types).toContain("validation");
      expect(types).toContain("video");
    });

    it("accepts custom config", () => {
      const interpreter = createNodeInterpreter({ maxSteps: 500 });
      expect(interpreter).toBeInstanceOf(Interpreter);
    });
  });

  describe("createMobileInterpreter()", () => {
    it("returns an Interpreter instance", () => {
      const interpreter = createMobileInterpreter();
      expect(interpreter).toBeInstanceOf(Interpreter);
    });

    it("has mobile-specific block types registered", () => {
      const interpreter = createMobileInterpreter();
      const types = interpreter.blockExecutor.getRegisteredTypes();

      /* Mobile-specific */
      expect(types).toContain("image");
      expect(types).toContain("location");
      expect(types).toContain("ui_camera");
      expect(types).toContain("ui_form");
      expect(types).toContain("ui_table");
      expect(types).toContain("ui_details");

      /* Should NOT have filesystem/ftp */
      expect(types).not.toContain("filesystem");
      expect(types).not.toContain("ftp");
    });
  });

  describe("createCloudInterpreter()", () => {
    it("returns an Interpreter instance", () => {
      const interpreter = createCloudInterpreter();
      expect(interpreter).toBeInstanceOf(Interpreter);
    });

    it("has cloud block types registered", () => {
      const interpreter = createCloudInterpreter();
      const types = interpreter.blockExecutor.getRegisteredTypes();

      /* Pure-JS blocks */
      expect(types).toContain("object");
      expect(types).toContain("fetch");
      expect(types).toContain("agent");
      expect(types).toContain("code");

      /* Stubs that throw */
      expect(types).toContain("image");
      expect(types).toContain("filesystem");
      expect(types).toContain("ftp");
      expect(types).toContain("video");
    });
  });
});

/* ────────────────────────────────────────────────────────── */
/*  Cross-adapter consistency                                */
/* ────────────────────────────────────────────────────────── */

describe("Cross-adapter consistency", () => {
  it("all adapters register validation handler", () => {
    const adapters = [new NodeAdapter(), new MobileAdapter(), new CloudAdapter()];

    for (const adapter of adapters) {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);
      expect(executor.getRegisteredTypes()).toContain("validation");
    }
  });

  it("all adapters register video stub", () => {
    const adapters = [new NodeAdapter(), new MobileAdapter(), new CloudAdapter()];

    for (const adapter of adapters) {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);
      expect(executor.getRegisteredTypes()).toContain("video");
    }
  });

  it("video stub throws identical error across all adapters", async () => {
    const adapters = [new NodeAdapter(), new MobileAdapter(), new CloudAdapter()];

    for (const adapter of adapters) {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);

      const block = makeBlock({}, "video");
      const ctx = makeContext();

      await expect(executor.execute(block, ctx)).rejects.toThrow(
        "Video block is planned for a future release",
      );
    }
  });

  it("all adapters register all 6 data block types", () => {
    const adapters = [new NodeAdapter(), new MobileAdapter(), new CloudAdapter()];
    const dataTypes = ["object", "string", "array", "math", "date", "normalize"];

    for (const adapter of adapters) {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);
      const registered = executor.getRegisteredTypes();

      for (const type of dataTypes) {
        expect(registered).toContain(type);
      }
    }
  });

  it("all adapters register all 6 flow block types", () => {
    const adapters = [new NodeAdapter(), new MobileAdapter(), new CloudAdapter()];
    const flowTypes = ["fetch", "agent", "goto", "sleep", "location", "code"];

    for (const adapter of adapters) {
      const executor = new BlockExecutor();
      adapter.registerBlocks(executor);
      const registered = executor.getRegisteredTypes();

      for (const type of flowTypes) {
        expect(registered).toContain(type);
      }
    }
  });

  it("each adapter has a unique platform identifier", () => {
    const platforms = [
      new NodeAdapter().platform,
      new MobileAdapter().platform,
      new CloudAdapter().platform,
    ];

    expect(new Set(platforms).size).toBe(3);
  });

  it("only NodeAdapter has hasFilesystem=true", () => {
    expect(new NodeAdapter().capabilities.hasFilesystem).toBe(true);
    expect(new MobileAdapter().capabilities.hasFilesystem).toBe(false);
    expect(new CloudAdapter().capabilities.hasFilesystem).toBe(false);
  });

  it("only NodeAdapter has hasFtp=true", () => {
    expect(new NodeAdapter().capabilities.hasFtp).toBe(true);
    expect(new MobileAdapter().capabilities.hasFtp).toBe(false);
    expect(new CloudAdapter().capabilities.hasFtp).toBe(false);
  });

  it("only MobileAdapter has hasCamera=true", () => {
    expect(new NodeAdapter().capabilities.hasCamera).toBe(false);
    expect(new MobileAdapter().capabilities.hasCamera).toBe(true);
    expect(new CloudAdapter().capabilities.hasCamera).toBe(false);
  });

  it("only MobileAdapter has hasUi=true", () => {
    expect(new NodeAdapter().capabilities.hasUi).toBe(false);
    expect(new MobileAdapter().capabilities.hasUi).toBe(true);
    expect(new CloudAdapter().capabilities.hasUi).toBe(false);
  });

  it("only MobileAdapter has hasLocation=true", () => {
    expect(new NodeAdapter().capabilities.hasLocation).toBe(false);
    expect(new MobileAdapter().capabilities.hasLocation).toBe(true);
    expect(new CloudAdapter().capabilities.hasLocation).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────── */
/*  Integration: data block execution via adapter            */
/* ────────────────────────────────────────────────────────── */

describe("Integration: data block execution via adapter", () => {
  it("NodeAdapter can execute an object block", async () => {
    const interpreter = createNodeInterpreter();
    const block = makeBlock(
      {
        object_operation: "set",
        object_value: { name: "vsync", version: 1 },
        object_bind_value: "$state.obj",
      },
      "object",
    );
    const ctx = makeContext();

    const result = await interpreter.blockExecutor.execute(block, ctx);
    expect(result.stateDelta!.obj).toEqual({ name: "vsync", version: 1 });
  });

  it("MobileAdapter can execute a math block", async () => {
    const interpreter = createMobileInterpreter();
    const block = makeBlock(
      {
        math_input: 16,
        math_operation: "square_root",
        math_bind_value: "$state.sqrtResult",
      },
      "math",
    );
    const ctx = makeContext();

    const result = await interpreter.blockExecutor.execute(block, ctx);
    expect(result.stateDelta!.sqrtResult).toBe(4);
  });

  it("CloudAdapter can execute a string block", async () => {
    const interpreter = createCloudInterpreter();
    const block = makeBlock(
      {
        string_input: "  hello world  ",
        string_operation: "trim",
        string_bind_value: "$state.trimmed",
      },
      "string",
    );
    const ctx = makeContext();

    const result = await interpreter.blockExecutor.execute(block, ctx);
    expect(result.stateDelta!.trimmed).toBe("hello world");
  });
});
