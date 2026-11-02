/* Shared Upstash Redis (REST) helper for the API functions.
   Files starting with "_" in /api are not deployed as endpoints. */

// Vercel may add a custom prefix when it connects the database
// (e.g. ONLU_KV_REST_API_URL), so accept any *_REST_API_URL / *_REDIS_REST_URL pair.
function findRedis() {
  const env = process.env;
  const pairs = [["KV_REST_API_URL", "KV_REST_API_TOKEN"], ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]];
  for (const k of Object.keys(env)) {
    const m = k.match(/^(.*)_REST_API_URL$/) || k.match(/^(.*)_REDIS_REST_URL$/);
    if (m) pairs.push([k, k.replace(/_URL$/, "_TOKEN")]);
  }
  for (const [u, t] of pairs) if (env[u] && env[t]) return { url: env[u], token: env[t] };
  return { url: "", token: "" };
}

const { url, token } = findRedis();

async function call(path, body) {
  const r = await fetch(url + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return r.json();
}

// one command: redis(["GET", "key"]) → result
async function redis(command) {
  return (await call("", command)).result;
}

// several commands in one round trip → array of results
async function pipeline(commands) {
  if (!commands.length) return [];
  const out = await call("/pipeline", commands);
  return out.map((x) => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

module.exports = { redis, pipeline, configured: Boolean(url && token), token };
