import { Router } from "express";
import { db, membersTable, bookingsTable, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { RegisterMemberBody, LoginMemberBody } from "@workspace/api-zod";
import { mapEntryToCatalogProduct, readStockStore, type CatalogProduct } from "../lib/syncedStock";

const router = Router();
const hasDatabase = Boolean(process.env.DATABASE_URL);

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.memberId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return next();
}

function formatMember(m: { id: number; email: string; name: string; createdAt: Date; passwordHash: string }) {
  return {
    id: m.id,
    email: m.email,
    name: m.name,
    createdAt: m.createdAt.toISOString(),
  };
}

router.post("/members/register", async (req, res) => {
  try {
    const parsed = RegisterMemberBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const existing = await db.select().from(membersTable).where(eq(membersTable.email, parsed.data.email));
    if (existing.length > 0) return res.status(400).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const [member] = await db.insert(membersTable).values({
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
    }).returning();

    req.session.memberId = member.id;
    return res.status(201).json(formatMember(member));
  } catch (err) {
    req.log.error({ err }, "Failed to register member");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/members/login", async (req, res) => {
  try {
    const parsed = LoginMemberBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const [member] = await db.select().from(membersTable).where(eq(membersTable.email, parsed.data.email));
    if (!member) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(parsed.data.password, member.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    req.session.memberId = member.id;
    return res.json(formatMember(member));
  } catch (err) {
    req.log.error({ err }, "Failed to login");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/members/logout", async (req, res) => {
  req.session.destroy(() => {});
  return res.json({ success: true });
});

router.get("/members/me", requireAuth, async (req, res) => {
  try {
    const [member] = await db.select().from(membersTable).where(eq(membersTable.id, req.session.memberId!));
    if (!member) return res.status(401).json({ error: "Not found" });
    return res.json(formatMember(member));
  } catch (err) {
    req.log.error({ err }, "Failed to get current member");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/members/me/bookings", requireAuth, async (req, res) => {
  try {
    if (!hasDatabase) {
      return res.json([]);
    }
    const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.memberId, req.session.memberId!));
    const syncedProducts = (await readStockStore())
      .filter((entry) => entry.showOnWebsite !== false)
      .map(mapEntryToCatalogProduct);
    const products = syncedProducts.length > 0
      ? []
      : await db.select().from(productsTable);
    const productMap = new Map<number, CatalogProduct>();
    for (const product of products) {
      productMap.set(product.id, {
        ...product,
        price: parseFloat(product.price),
        createdAt: product.createdAt.toISOString(),
      });
    }
    for (const product of syncedProducts) {
      productMap.set(product.id, product);
    }

    const result = bookings.map(b => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      service: (() => {
        const p = productMap.get(b.serviceId);
        if (!p) return null;
        return p;
      })(),
    })).filter(b => b.service !== null);

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get member bookings");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
