import * as Schema from 'effect/Schema';
import { Email, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const RegisterBody = Schema.Struct({
  email: Email,
  password: Schema.String.check(Schema.isMinLength(8)),
  name: Schema.String,
  company: optionalNullable(Schema.String),
  invitationToken: optionalNullable(Schema.String),
});
export type RegisterBody = Wire<typeof RegisterBody>;

export const LoginBody = Schema.Struct({
  email: Email,
  password: Schema.String,
  /** TOTP code or recovery code, required only when the account has 2FA enabled. */
  twoFactorCode: optionalNullable(Schema.String),
});
export type LoginBody = Wire<typeof LoginBody>;

export const TwoFactorPasswordBody = Schema.Struct({
  password: Schema.String.check(Schema.isMinLength(1)),
});
export type TwoFactorPasswordBody = Wire<typeof TwoFactorPasswordBody>;

export const TwoFactorCodeBody = Schema.Struct({
  code: Schema.String.check(Schema.isBetweenLength(6, 6)),
});
export type TwoFactorCodeBody = Wire<typeof TwoFactorCodeBody>;

export const ForgotPasswordBody = Schema.Struct({
  email: Email,
});
export type ForgotPasswordBody = Wire<typeof ForgotPasswordBody>;

export const ResetPasswordBody = Schema.Struct({
  token: Schema.String,
  newPassword: Schema.String.check(Schema.isMinLength(8)),
});
export type ResetPasswordBody = Wire<typeof ResetPasswordBody>;

/** `POST /auth/sessions/:sessionId/logout`: a session's uuid. */
export const AuthSessionParams = Schema.Struct({ sessionId: Schema.String.check(Schema.isUUID()) });
export type AuthSessionParams = Wire<typeof AuthSessionParams>;
