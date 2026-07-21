import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getDesktopSyncConfig } from "../lib/desktopSync";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  const { desktopBaseUrl } = getDesktopSyncConfig();
  res.json({
    ...data,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    desktopBaseUrl,
  });
});

export default router;
