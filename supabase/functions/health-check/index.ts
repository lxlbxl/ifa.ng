import { serve } from "std/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (_req) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: "healthy",
    checks: {
      database: "unknown",
      auth: "unknown",
      storage: "unknown",
    },
    version: "1.0.0",
    uptime: process.uptime ? process.uptime() : "N/A",
  };

  try {
    // Check database connection
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: dbError } = await supabase.from("profiles").select("id").limit(1);
    checks.checks.database = dbError ? "unhealthy" : "healthy";

    // Check auth service
    const { error: authError } = await supabase.auth.getUser();
    checks.checks.auth = authError && authError.message !== "Auth session missing!" ? "unhealthy" : "healthy";

    // Check storage
    const { error: storageError } = await supabase.storage.listBuckets();
    checks.checks.storage = storageError ? "unhealthy" : "healthy";

    // Overall status
    const isHealthy = Object.values(checks.checks).every((status) => status === "healthy");
    checks.status = isHealthy ? "healthy" : "degraded";

    return new Response(JSON.stringify(checks, null, 2), {
      status: isHealthy ? 200 : 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    checks.status = "unhealthy";
    return new Response(
      JSON.stringify({
        ...checks,
        // do not echo internal error text to an unauthenticated caller
        error: "Health check failed",
      }, null, 2),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  }
});
