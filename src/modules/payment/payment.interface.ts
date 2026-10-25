export interface ICreateCheckoutSession {
  contractId: string;
}

export interface IPaymentListQuery {
  status?:
    | "PENDING"
    | "PROCESSING"
    | "SUCCESS"
    | "FAILED"
    | "CANCELLED"
    | "REFUNDED";
  page?: string;
  limit?: string;
}

export interface ITransactionListQuery {
  page?: string;
  limit?: string;
}
