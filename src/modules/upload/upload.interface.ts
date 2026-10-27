export type IAttachment = {
  url: string;
  name: string;
  size: number;
  mimeType: string;
};

export type ISignUploadInput = {
  purpose: "submission";
  fileName: string;
  mimeType: string;
  size: number;
};
