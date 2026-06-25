import { Router } from "express";
import { db, contactsTable } from "@workspace/db";
import { SubmitContactBody } from "@workspace/api-zod";

const router = Router();

router.post("/contact", async (req, res) => {
  try {
    const parsed = SubmitContactBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    await db.insert(contactsTable).values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      message: parsed.data.message,
    });

    return res.json({ success: true, message: "Thank you! We'll be in touch soon." });
  } catch (err) {
    req.log.error({ err }, "Failed to submit contact");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
