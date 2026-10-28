// Origins of the web app that may call the API from the browser (with a Bearer token, so
// every call is preflighted). Not secrets: the same URLs are in docs/deploy.md.
const exact = new Set(['https://daybrief-web.vercel.app', 'http://localhost:8081']);
// Vercel previews of daybrief-web: per-deployment and per-branch (`-git-<branch>-`) URLs.
const preview = /^https:\/\/daybrief-web-[a-z0-9-]+-serprok9694-1239s-projects\.vercel\.app$/;

/** Returns the origin to echo in Access-Control-Allow-Origin, or null to refuse. */
export function allowedOrigin(origin: string): string | null {
  return exact.has(origin) || preview.test(origin) ? origin : null;
}
