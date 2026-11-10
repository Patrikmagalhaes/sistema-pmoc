import { bigint, boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Tabelas do Better Auth 1.7.10 (03 §2.1, AF-04; DDL em db/migrations/0009_auth.sql).
 * Usadas só pelo adaptador da biblioteca: o resto do sistema lê `app_user`.
 */
const ts = (n: string) => timestamp(n, { withTimezone: true });

export const authUser = pgTable("auth_user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
  emailVerified: boolean("email_verified").notNull(),
  image: text(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
  role: text(),
  banned: boolean(),
  banReason: text("ban_reason"),
  banExpires: ts("ban_expires"),
  twoFactorEnabled: boolean("two_factor_enabled"),
});

export const authSession = pgTable("auth_session", {
  id: text().primaryKey(),
  expiresAt: ts("expires_at").notNull(),
  token: text().notNull(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull(),
  impersonatedBy: text("impersonated_by"),
});

export const authAccount = pgTable("auth_account", {
  id: text().primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text(),
  password: text(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const authVerification = pgTable("auth_verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const authTwoFactor = pgTable("auth_two_factor", {
  id: text().primaryKey(),
  secret: text().notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id").notNull(),
  verified: boolean(),
  failedVerificationCount: integer("failed_verification_count"),
  lockedUntil: ts("locked_until"),
});

export const authRateLimit = pgTable("auth_rate_limit", {
  id: text().primaryKey(),
  key: text().notNull(),
  count: integer().notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/** S-04: com `modelName` customizado, o adaptador Drizzle procura as tabelas pelo nome. */
export const authSchema = {
  auth_user: authUser,
  auth_session: authSession,
  auth_account: authAccount,
  auth_verification: authVerification,
  auth_two_factor: authTwoFactor,
  auth_rate_limit: authRateLimit,
};
