export type AuthActionResponse = {
  ok?: boolean;
  emailSent?: boolean;
  error?: string;
  notRegistered?: boolean;
  passwordWrong?: boolean;
  useOAuth?: boolean;
  notVerified?: boolean;
  mfaRequired?: boolean;
};
