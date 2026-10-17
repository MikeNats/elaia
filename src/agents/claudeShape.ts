import { z } from 'zod';

// Loose shapes: Claude adds fields often, and we read only these.
const Block = z.object({
  type: z.string(),
  text: z.string().optional(),
  name: z.string().optional(),
  input: z.unknown().optional(),
  is_error: z.boolean().optional(),
  content: z.unknown().optional(),
  // A tool call's id, and the call a tool result answers: how a started agent is followed.
  id: z.string().optional(),
  tool_use_id: z.string().optional(),
});

export const Line = z.object({
  type: z.string(),
  subtype: z.string().optional(),
  session_id: z.string().optional(),
  // Set on lines a subagent printed through the Task tool.
  parent_tool_use_id: z.string().nullable().optional(),
  result: z.string().optional(),
  message: z
    .object({
      // One API call; its lines repeat the same id and usage.
      id: z.string().optional(),
      content: z.array(Block).or(z.string()),
      usage: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  // On the result line: each model used, with its context size.
  modelUsage: z.record(z.string(), z.object({ contextWindow: z.number().optional() })).optional(),
  is_error: z.boolean().optional(),
  total_cost_usd: z.number().optional(),
  usage: z.record(z.string(), z.unknown()).optional(),
  permission_denials: z
    .array(z.object({ tool_name: z.string(), tool_input: z.unknown() }))
    .optional(),
  // On a rate_limit_event line: each limit window, how much of it is used (0 to 1), and when
  // it resets (seconds since 1970).
  rate_limit_info: z
    .object({
      unifiedWindows: z
        .record(
          z.string(),
          z.object({ utilization: z.number(), resetsAt: z.number().nullable().optional() }),
        )
        .optional(),
    })
    .optional(),
});
export type Line = z.infer<typeof Line>;
