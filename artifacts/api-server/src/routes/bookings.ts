import { Router } from "express";
import { db, bookingsTable, productsTable, membersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateBookingBody, GetBookingParams } from "@workspace/api-zod";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.memberId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return next();
}

router.get("/bookings", requireAuth, async (req, res) => {
  try {
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.memberId, req.session.memberId!));
    return res.json(bookings.map(b => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list bookings");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings", requireAuth, async (req, res) => {
  try {
    const parsed = CreateBookingBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const [booking] = await db.insert(bookingsTable).values({
      memberId: req.session.memberId!,
      serviceId: parsed.data.serviceId,
      preferredDate: parsed.data.preferredDate ?? null,
      notes: parsed.data.notes ?? null,
      status: "pending",
    }).returning();

    return res.status(201).json({
      ...booking,
      createdAt: booking.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create booking");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id", requireAuth, async (req, res) => {
  try {
    const parsed = GetBookingParams.safeParse({ id: parseInt(req.params.id) });
    if (!parsed.success) return res.status(400).json({ error: "Invalid ID" });

    const [booking] = await db.select().from(bookingsTable).where(
      and(eq(bookingsTable.id, parsed.data.id), eq(bookingsTable.memberId, req.session.memberId!))
    );
    if (!booking) return res.status(404).json({ error: "Not found" });

    return res.json({ ...booking, createdAt: booking.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to get booking");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
