export type AuthActionResponse = {
  ok?: boolean;
  emailSent?: boolean;
  error?: string;
  notRegistered?: boolean;
  notVerified?: boolean;
  mfaRequired?: boolean;
};
