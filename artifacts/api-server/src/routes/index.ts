import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import cartRouter from "./cart";
import bookingsRouter from "./bookings";
import membersRouter from "./members";
import contactRouter from "./contact";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(cartRouter);
router.use(bookingsRouter);
router.use(membersRouter);
router.use(contactRouter);

export default router;
