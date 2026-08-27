export interface ICreateReview {
  rating: number;
  comment?: string;
}

export interface IReviewListQuery {
  page?: string;
  limit?: string;
}
