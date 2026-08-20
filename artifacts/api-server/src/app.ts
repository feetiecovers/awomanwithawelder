import fs from "fs";
import path from "path";

try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    }
  }
} catch {}

import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { getStripeCredentials } from "./stripeClient";

declare module "express-session" {
  interface SessionData {
    cart: { productId: number; quantity: number; shippingLabel?: string; shippingPrice?: number; configuration?: any }[];
    memberId?: number;
  }
}

const app: Express = express();
const isProduction = process.env.NODE_ENV === "production";
const configuredSameSite = process.env.SESSION_COOKIE_SAME_SITE;
const sessionSameSite =
  configuredSameSite === "lax" || configuredSameSite === "strict" || configuredSameSite === "none"
    ? configuredSameSite
    : isProduction
      ? "none"
      : "lax";
const sessionCookieSecure = process.env.SESSION_COOKIE_SECURE
  ? process.env.SESSION_COOKIE_SECURE === "true"
  : isProduction;

app.set("trust proxy", 1);

// Stripe webhook MUST be registered before express.json() — needs raw Buffer body
app.post(
  ["/api/stripe/webhook", "/api/stripeWebhook", "/stripe-webhook"],
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing stripe-signature" });
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
      return;
    } catch (error: any) {
      logger.error({ err: error }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
      return;
    }
  }
);

app.get("/api/stripe/status", async (_req, res) => {
  try {
    const { webhookSecret } = await getStripeCredentials();
    res.json({
      status: "ok",
      webhookConfigured: Boolean(webhookSecret),
      credentialSource: process.env.STRIPE_SECRET_KEY ? "env" : "replit",
    });
    return;
  } catch (error: any) {
    res.status(503).json({
      status: "error",
      error: error?.message || "Stripe is not configured",
    });
    return;
  }
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(session({
  secret: process.env.SESSION_SECRET || "awww-dev-secret-change-in-prod",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: sessionCookieSecure,
    httpOnly: true,
    sameSite: sessionSameSite,
    domain: process.env.SESSION_COOKIE_DOMAIN || undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use("/api", router);

export default app;
