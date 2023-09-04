import express from "express";
const router = express.Router();

import AppController from "../controllers/AppController";
import UsersController from "../controllers/UsersController";

router.get("/status", AppController.getStatus);
router.get("/stats", AppController.getStats);
router.post("/users", UsersController.postNew);

export default router;
