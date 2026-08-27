import prisma from "../../config/prismaClient";
import ApiError from "../../utils/ApiError";
import { JwtPayload } from "../../utils/jwt";
import { getPagination, buildMeta } from "../../utils/pagination";
import { ICreateReview, IReviewListQuery } from "./review.interface";

const includeReviewDetails = {
  reviewer: { select: { id: true, name: true } },
  contract: {
    select: { id: true, jobId: true, job: { select: { title: true } } },
  },
};

export const createReview = async (
  contractId: string,
  currentUser: JwtPayload,
  data: ICreateReview
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) throw new ApiError(404, "Contract not found");

  if (contract.status !== "COMPLETED") {
    throw new ApiError(400, "You can only review completed contracts");
  }

  // Reviewee is DERIVED from the contract, never taken from the request body.
  // This is the whole point of the design — the client can't choose who
  // they're "reviewing."
  let revieweeId: string;
  if (contract.clientId === currentUser.userId) {
    revieweeId = contract.freelancerId;
  } else if (contract.freelancerId === currentUser.userId) {
    revieweeId = contract.clientId;
  } else {
    throw new ApiError(403, "You are not a participant in this contract");
  }

  const existing = await prisma.review.findUnique({
    where: {
      contractId_reviewerId: { contractId, reviewerId: currentUser.userId },
    },
  });
  if (existing) {
    throw new ApiError(409, "You have already reviewed this contract");
  }

  return prisma.review.create({
    data: {
      contractId,
      reviewerId: currentUser.userId,
      revieweeId,
      rating: data.rating,
      comment: data.comment,
    },
    include: includeReviewDetails,
  });
};

export const getReviewsForContract = async (
  contractId: string,
  currentUser: JwtPayload
) => {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) throw new ApiError(404, "Contract not found");

  const isParticipant =
    contract.clientId === currentUser.userId ||
    contract.freelancerId === currentUser.userId;
  if (!isParticipant && currentUser.role !== "ADMIN") {
    throw new ApiError(403, "You are not a participant in this contract");
  }

  return prisma.review.findMany({
    where: { contractId },
    include: includeReviewDetails,
  });
};

export const listReviewsForUser = async (
  userId: string,
  query: IReviewListQuery
) => {
  const { skip, take, page, limit } = getPagination(query);

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { revieweeId: userId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: includeReviewDetails,
    }),
    prisma.review.count({ where: { revieweeId: userId } }),
  ]);

  return { reviews, meta: buildMeta(total, page, limit) };
};

export const getRatingSummary = async (userId: string) => {
  const result = await prisma.review.aggregate({
    where: { revieweeId: userId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    averageRating: result._avg.rating
      ? Math.round(result._avg.rating * 10) / 10
      : 0,
    totalReviews: result._count.rating,
  };
};
