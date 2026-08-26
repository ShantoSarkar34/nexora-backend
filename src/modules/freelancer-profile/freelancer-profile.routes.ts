import { Router } from "express";
import * as freelancerProfileController from "./freelancer-profile.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { authorize } from "../../middleware/authorize";
import validateRequest from "../../middleware/validateRequest";
import {
  createFreelancerProfileSchema,
  updateFreelancerProfileSchema,
  addSkillSchema,
  experienceSchema,
  portfolioSchema,
} from "./freelancer-profile.validation";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("FREELANCER"),
  validateRequest(createFreelancerProfileSchema),
  freelancerProfileController.createFreelancerProfile
);
router.get(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  freelancerProfileController.getMyFreelancerProfile
);
router.patch(
  "/me",
  authenticate,
  authorize("FREELANCER"),
  validateRequest(updateFreelancerProfileSchema),
  freelancerProfileController.updateFreelancerProfile
);
router.post(
  "/skills",
  authenticate,
  authorize("FREELANCER"),
  validateRequest(addSkillSchema),
  freelancerProfileController.addSkill
);
router.delete(
  "/skills/:skillId",
  authenticate,
  authorize("FREELANCER"),
  freelancerProfileController.removeSkill
);
router.post(
  "/experience",
  authenticate,
  authorize("FREELANCER"),
  validateRequest(experienceSchema),
  freelancerProfileController.addExperience
);
router.delete(
  "/experience/:experienceId",
  authenticate,
  authorize("FREELANCER"),
  freelancerProfileController.deleteExperience
);
router.post(
  "/portfolio",
  authenticate,
  authorize("FREELANCER"),
  validateRequest(portfolioSchema),
  freelancerProfileController.addPortfolio
);
router.delete(
  "/portfolio/:portfolioId",
  authenticate,
  authorize("FREELANCER"),
  freelancerProfileController.deletePortfolio
);
router.get("/:userId", freelancerProfileController.getPublicFreelancerProfile);

export default router;
