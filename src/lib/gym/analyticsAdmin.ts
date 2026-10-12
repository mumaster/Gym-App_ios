import { supabase } from "../../integrations/supabase/client";

export type AnalyticsSummary = {
  days: number;
  events: number;
  sessions: number;
  installs: number;
  returning: number;
  per_day: { day: string; sessions: number }[];
  setup_funnel: { tour: string; step: number; sessions: number }[];
  workouts: Record<string, number>;
  swaps: { exercise: string; count: number }[];
  features: { feature: string; count: number; sessions: number }[];
  screens: { screen: string; count: number }[];
  errors: { name: string; message: string | null; version: number | null; count: number }[];
  versions: { version: number | null; sessions: number }[];
};

type Rpc = (
  name: string,
  params?: Record<string, unknown>,
) => PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;
// The generated Supabase types don't know these functions.
const rpc = (): Rpc => supabase.rpc.bind(supabase) as unknown as Rpc;

/** Whether the signed-in account may open the usage dashboard. */
export async function fetchIsAnalyticsAdmin(): Promise<boolean> {
  try {
    const { data, error } = await rpc()("is_analytics_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function fetchAnalyticsSummary(days: number): Promise<AnalyticsSummary> {
  const { data, error } = await rpc()("analytics_summary", { p_days: days });
  if (error) throw new Error(error.message);
  return data as AnalyticsSummary;
}
