import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import cartRouter from "./cart";
import checkoutRouter from "./checkout";
import bookingsRouter from "./bookings";
import membersRouter from "./members";
import contactRouter from "./contact";
import ecommerceStockRouter from "./ecommerceStock";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(productsRouter);
router.use(cartRouter);
router.use(checkoutRouter);
router.use(bookingsRouter);
router.use(membersRouter);
router.use(contactRouter);
router.use(ecommerceStockRouter);
router.use(chatRouter);

export default router;
