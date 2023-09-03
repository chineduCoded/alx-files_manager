import express from "express";
const router = express.Router();

import AppController from "./controllers/AppController.js";

router.get("/status", AppController.getStatus);
router.get("/stats", AppController.getStats)

export default router;
