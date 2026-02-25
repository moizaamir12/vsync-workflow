import { tool } from "ai";
import { z } from "zod";

/**
 * create_plan — creates a multi-step plan for complex requests.
 * Used when the AI needs 2+ block changes to fulfill a request.
 * The UI displays this as a checklist the user can follow.
 */
export const createPlanTool = tool({
  description:
    "Create a multi-step plan for complex requests that require 2 or more block changes. The plan is shown to the user as a checklist. After creating a plan, execute each step using the edit tools.",
  parameters: z.object({
    steps: z
      .array(z.string())
      .min(2)
      .describe("Human-readable description of each step"),
  }),
  execute: async ({ steps }) => {
    const planId = `plan_${Date.now().toString(36)}`;
    return {
      planId,
      steps,
    };
  },
});
