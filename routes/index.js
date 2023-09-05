import express from "express";
const router = express.Router();

import AppController from "../controllers/AppController";
import UsersController from "../controllers/UsersController";
import AuthController from "../controllers/AuthController";
import FilesController from "../controllers/FilesController";

// reports endpoints
router.get("/status", AppController.getStatus);
router.get("/stats", AppController.getStats);

// creates new user endpoint
router.post("/users", UsersController.postNew);

// Authentication endpoints
router.get("/connect", AuthController.getConnect);
router.get("/disconnect", AuthController.getDisconnect);
router.get("/users/me", UsersController.getMe);

// Create files endpoint
router.post("/files", FilesController.postUpload);

// File retrieval endpoints
router.get("/files/:id", FilesController.getShow);
router.get("/files", FilesController.getIndex);

// File publish/unpublish endpoints
router.put("/files/:id/publish", FilesController.putPublish);
router.put("/files/:id/unpublish", FilesController.putUnpublish);

module.exports = router;
