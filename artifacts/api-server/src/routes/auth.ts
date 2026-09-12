import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth, publicUser } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/me", requireAuth, (req: Request, res: Response) => {
  res.json(publicUser(req.user!));
});

export default router;
