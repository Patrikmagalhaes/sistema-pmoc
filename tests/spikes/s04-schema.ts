import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const ts = (n: string) => timestamp(n, { withTimezone: true });

export const user = pgTable("auth_user", {
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
export const session = pgTable("auth_session", {
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
export const account = pgTable("auth_account", {
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
export const verification = pgTable("auth_verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});
export const twoFactor = pgTable("auth_two_factor", {
  id: text().primaryKey(),
  secret: text().notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id").notNull(),
  verified: boolean(),
  failedVerificationCount: integer("failed_verification_count"),
  lockedUntil: ts("locked_until"),
});
