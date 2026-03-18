import { UserRole, UserStatus } from "@prisma/client";
import { ZodError, z } from "zod";

const passwordSchema = z
  .string()
  .min(12, "Must be at least 12 characters")
  .max(128, "Must be 128 characters or fewer")
  .refine((value) => /[a-z]/.test(value), "Must contain a lowercase letter")
  .refine((value) => /[A-Z]/.test(value), "Must contain an uppercase letter")
  .refine((value) => /\d/.test(value), "Must contain a number");

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Must be at least 3 characters")
  .max(32, "Must be 32 characters or fewer")
  .regex(/^[a-zA-Z0-9._-]+$/, "Use only letters, numbers, dots, dashes, and underscores");

export const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1)
});

export const createUserSchema = z.object({
  email: z.string().trim().email(),
  username: usernameSchema,
  firstName: z.string().trim().max(100).optional().default(""),
  lastName: z.string().trim().max(100).optional().default(""),
  role: z.nativeEnum(UserRole),
  temporaryPassword: passwordSchema,
  forcePasswordReset: z.boolean().optional().default(true)
});

export const updateUserSchema = z.object({
  email: z.string().trim().email(),
  username: usernameSchema,
  firstName: z.string().trim().max(100).optional().default(""),
  lastName: z.string().trim().max(100).optional().default(""),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  forcePasswordReset: z.boolean().optional().default(false)
});

export const resetPasswordSchema = z.object({
  temporaryPassword: passwordSchema,
  forcePasswordReset: z.boolean().optional().default(true)
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: passwordSchema
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

export const shareFormSchema = z.object({
  title: z.string().trim().max(140).optional().default(""),
  message: z.string().trim().max(5000).optional().default(""),
  recipients: z.string().trim().min(3),
  expirationMode: z.enum(["DAYS", "FIRST_DOWNLOAD"]),
  expirationDays: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().min(1).max(365).optional()
  ),
  sharePassword: z.string().max(128).optional().default("").refine((value) => value.length === 0 || value.length >= 8)
});

export function parseRecipients(input: string) {
  return Array.from(
    new Set(
      input
        .split(/[\n,;]/)
        .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
    )
  );
}

const fieldLabels: Record<string, string> = {
  confirmPassword: "Confirm password",
  currentPassword: "Current password",
  email: "Email",
  firstName: "First name",
  lastName: "Last name",
  newPassword: "New password",
  role: "Role",
  temporaryPassword: "Temporary password",
  username: "Username"
};

export function getValidationErrorMessage(error: ZodError) {
  const issue = error.issues[0];
  if (!issue) {
    return "Invalid form submission.";
  }

  const path = typeof issue.path[0] === "string" ? issue.path[0] : null;
  if (!path) {
    return issue.message;
  }

  const label = fieldLabels[path] ?? path;
  return `${label}: ${issue.message}`;
}
