import { z } from 'zod';

// One limit window of an agent's plan, as its provider reported it: how much is used (0 to 1)
// and when it resets. Any provider fits this shape; each agent adapter fills it in its own way.
export const LimitWindowSchema = z.object({
  id: z.string(),
  label: z.string(),
  used: z.number(),
  resetsAt: z.string().nullable(),
});
export type LimitWindow = z.infer<typeof LimitWindowSchema>;

// The latest limits one provider reported, and when.
export const ProviderLimitsSchema = z.object({
  provider: z.string(),
  at: z.string(),
  windows: z.array(LimitWindowSchema),
});
export type ProviderLimits = z.infer<typeof ProviderLimitsSchema>;
