import ApiError from "./ApiError";
import { JwtPayload } from "./jwt";

export const checkOwnership = (
  resourceOwnerId: string,
  currentUser: JwtPayload
) => {
  if (currentUser.role === "ADMIN") return;
  if (resourceOwnerId !== currentUser.userId) {
    throw new ApiError(
      403,
      "You do not have permission to access this resource"
    );
  }
};
