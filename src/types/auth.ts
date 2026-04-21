export type AuthActionResponse = {
  ok?: boolean;
  emailSent?: boolean;
  cooldownSeconds?: number;
  error?: string;
  notRegistered?: boolean;
  passwordWrong?: boolean;
  useOAuth?: boolean;
  notVerified?: boolean;
  mfaRequired?: boolean;
};
