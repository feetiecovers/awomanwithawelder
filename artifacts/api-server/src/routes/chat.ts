import { Router } from "express";
import { getDesktopAuthHeaders, getDesktopSyncConfig } from "../lib/desktopSync";

const router = Router();

function buildDesktopChatUrl(req: any): string {
  const { desktopBaseUrl } = getDesktopSyncConfig();
  const requestUrl = new URL(req.originalUrl || req.url, "http://local");
  const targetUrl = new URL("/api/chat", desktopBaseUrl);

  requestUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  return targetUrl.toString();
}

async function proxyChatRequest(req: any, res: any) {
  try {
    const headers: Record<string, string> = {
      accept: "application/json",
      ...getDesktopAuthHeaders(),
    };

    let body: string | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      headers["content-type"] = "application/json";
      body = JSON.stringify(req.body ?? {});
    }

    const response = await fetch(buildDesktopChatUrl(req), {
      method: req.method,
      headers,
      body,
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";
    res.status(response.status);
    res.setHeader("content-type", contentType);
    res.send(text);
  } catch (err) {
    req.log.error({ err }, "Failed to proxy chat request to desktop backend");
    res.status(502).json({ error: "Chat service unavailable" });
  }
}

router.get("/chat", proxyChatRequest);
router.post("/chat", proxyChatRequest);
router.delete("/chat", proxyChatRequest);

export default router;
