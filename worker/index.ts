interface Env {
  ASSETS: Fetcher;
  MMWX_ORIGIN: string;
  PROBE_TOKEN: string;
}

const routes: Record<string, string> = {
  "/api/probe": "/api/public/probe-servers",
  "/api/series": "/api/public/probe-series",
  "/api/stream": "/api/public/probe-ws",
  "/api/forward": "/api/public/probe-forward",
};

function upstreamURL(request: Request, env: Env): URL | null {
  const incoming = new URL(request.url);
  const path = routes[incoming.pathname];
  if (!path) return null;

  const origin = new URL(env.MMWX_ORIGIN);
  if (
    origin.protocol !== "https:" &&
    origin.hostname !== "127.0.0.1" &&
    origin.hostname !== "localhost"
  ) {
    throw new Error("MMWX_ORIGIN must use HTTPS");
  }
  origin.pathname = path;
  origin.search = incoming.search;
  return origin;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incoming = new URL(request.url);
    if (incoming.pathname === "/login") {
      return Response.redirect(
        new URL("/login", env.MMWX_ORIGIN).toString(),
        302,
      );
    }
    const target = upstreamURL(request, env);
    if (!target) return env.ASSETS.fetch(request);
    if (request.method !== "GET")
      return new Response("Method not allowed", { status: 405 });
    if (!env.PROBE_TOKEN) {
      return new Response("Probe access secret is not configured", {
        status: 503,
      });
    }

    const headers = new Headers(request.headers);
    headers.delete("cookie");
    headers.delete("authorization");
    headers.set("X-Forwarded-Host", new URL(request.url).host);
    headers.set("X-MMwx-Probe-Token", env.PROBE_TOKEN);

    const upstream = await fetch(
      new Request(target, { method: "GET", headers }),
    );
    // WebSocket 的 101 Response 必须原样返回，不能重新构造 body/headers。
    if (upstream.status === 101 || upstream.webSocket) return upstream;

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("Cache-Control", "no-store");
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.delete("set-cookie");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
} satisfies ExportedHandler<Env>;
