export interface ICreateConversation {
  jobId: string;
  otherUserId: string;
}

export interface IConversationListQuery {
  page?: string;
  limit?: string;
}

export interface IMessageListQuery {
  limit: number;
  before?: string;
  after?: string;
}
