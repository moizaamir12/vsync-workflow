import { zValidator } from "@hono/zod-validator";
import type { ZodSchema } from "zod";

/**
 * Thin wrappers around @hono/zod-validator that standardise
 * validation error responses into the { data, error, meta } envelope.
 * Hono's zod-validator already returns 400 on failure — we just
 * reshape the output.
 */

/** Validate the JSON request body against a Zod schema. */
export function validateBody<T extends ZodSchema>(schema: T) {
  return zValidator("json", schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request body validation failed",
            details: result.error.flatten().fieldErrors,
          },
          meta: undefined,
        },
        400,
      );
    }
  });
}

/** Validate URL path parameters against a Zod schema. */
export function validateParams<T extends ZodSchema>(schema: T) {
  return zValidator("param", schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "Path parameter validation failed",
            details: result.error.flatten().fieldErrors,
          },
          meta: undefined,
        },
        400,
      );
    }
  });
}

/** Validate query string parameters against a Zod schema. */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return zValidator("query", schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "Query parameter validation failed",
            details: result.error.flatten().fieldErrors,
          },
          meta: undefined,
        },
        400,
      );
    }
  });
}
