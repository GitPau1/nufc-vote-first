Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  // Basic routes: GET /health-check and GET /health-check/ready
  const path = url.pathname;
  const route = path.replace(/^\/+|\/+$/g, "");

  const startedAt = (globalThis as any).__health_started_at ?? Date.now();
  (globalThis as any).__health_started_at = startedAt;

  const uptimeMs = Date.now() - startedAt;

  const status = {
    ok: true,
    service: "edge-function",
    route,
    uptime_ms: uptimeMs,
    timestamp: new Date().toISOString(),
  };

  return new Response(JSON.stringify(status), {
    status: route.endsWith("ready") || route.includes("/ready") ? 200 : 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
