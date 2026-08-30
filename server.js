import http from "node:http";

const PORT = Number(process.env.PORT || 3000);
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    sendJson(res, 200, { ok: true, service: "groq-janitor-proxy" });
    return;
  }

  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    sendJson(res, 404, { error: { message: "Use POST /v1/chat/completions" } });
    return;
  }

  if (!GROQ_API_KEY) {
    sendJson(res, 500, { error: { message: "Missing GROQ_API_KEY env variable" } });
    return;
  }

  try {
    const body = await readBody(req);
    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body
    });

    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end(text);
  } catch (error) {
    sendJson(res, 502, {
      error: {
        message: "Proxy failed to reach Groq",
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Groq Janitor proxy listening on http://localhost:${PORT}`);
});
