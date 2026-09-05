const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const candidates = [
      pathname,
      pathname === "/"
        ? "/index.html"
        : pathname.replace(/\/+$/, "") + ".html",
      pathname === "/" ? null : pathname + "/index.html",
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const req = new Request(new URL(candidate, url), request);
      const res = await env.ASSETS.fetch(req).catch(() => null);
      if (res && res.ok) return res;
    }

    const notFound = await env.ASSETS.fetch(
      new URL("/404.html", url)
    ).catch(() => null);
    if (notFound && notFound.ok) {
      return new Response(notFound.body, {
        status: 404,
        headers: notFound.headers,
      });
    }
    return new Response("Not Found", { status: 404 });
  },
};

export default worker;