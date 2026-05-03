import { join, normalize } from "path";

export interface StaticOptions {
  /** Directory to serve static files from (relative to cwd). */
  assets: string;
  /** URL prefix. Default "/". Set to "/static" to serve at /static/*. */
  prefix?: string;
}

// Common MIME types
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".wasm": "application/wasm",
};

function getMimeType(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  const ext = filePath.slice(dot).toLowerCase();
  return MIME[ext] || "application/octet-stream";
}

/**
 * Try to serve a static file for the given URL pathname.
 * Returns a Response if the file exists, or null to fall through to routing.
 */
export async function serveStatic(
  pathname: string,
  options: StaticOptions,
  assetsDir: string
): Promise<Response | null> {
  const prefix = options.prefix ?? "/";

  // Only handle paths under the prefix
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  // Map URL path to filesystem path
  let relativePath = pathname.slice(prefix.length);
  if (relativePath.startsWith("/")) {
    relativePath = relativePath.slice(1);
  }

  // Resolve to absolute path, prevent directory traversal
  const filePath = normalize(join(assetsDir, relativePath));

  // Security: ensure the resolved path is still inside assetsDir
  if (!filePath.startsWith(assetsDir)) {
    return null;
  }

  try {
    const file = Bun.file(filePath);
    // Check existence by reading size (Bun.file is lazy)
    const exists = await file.exists();
    if (!exists) return null;

    return new Response(file, {
      headers: {
        "Content-Type": getMimeType(filePath),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return null;
  }
}

/**
 * Create a static file serving middleware.
 * Prefer using the static option on Application.run() for better performance,
 * but this is available for custom middleware chains.
 */
export function createStaticMiddleware(
  options: StaticOptions,
  assetsDir: string
): import("./middleware").Middleware {
  return async (ctx, next) => {
    const url = new URL(ctx.request.url);
    const response = await serveStatic(url.pathname, options, assetsDir);
    if (response) return response;
    return next();
  };
}
