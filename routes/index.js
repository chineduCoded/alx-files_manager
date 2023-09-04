import express from "express";
const router = express.Router();

import AppController from "../controllers/AppController";
import UsersController from "../controllers/UsersController";
import AuthController from "../controllers/AuthController";
import FilesController from "../controllers/FilesController";

router.get("/status", AppController.getStatus);
router.get("/stats", AppController.getStats);
router.post("/users", UsersController.postNew);
router.get("/connect", AuthController.getConnect);
router.get("/disconnect", AuthController.getDisconnect);
router.get("/users/me", UsersController.getMe);
router.post("/files", FilesController.postUpload);

module.exports = router;
