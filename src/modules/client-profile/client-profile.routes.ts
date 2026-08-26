import { Router } from "express";
import * as clientProfileController from "./client-profile.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";
import validateRequest from "../../middleware/validateRequest";
import {
  createClientProfileSchema,
  updateClientProfileSchema,
} from "./client-profile.validation";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("CLIENT"),
  validateRequest(createClientProfileSchema),
  clientProfileController.createClientProfile
);
router.get(
  "/me",
  authenticate,
  authorize("CLIENT"),
  clientProfileController.getMyClientProfile
);
router.patch(
  "/me",
  authenticate,
  authorize("CLIENT"),
  validateRequest(updateClientProfileSchema),
  clientProfileController.updateClientProfile
);
router.get("/:userId", clientProfileController.getPublicClientProfile);

export default router;
