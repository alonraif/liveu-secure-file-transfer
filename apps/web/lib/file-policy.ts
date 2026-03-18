import path from "node:path";
import { Prisma } from "@prisma/client";

function normalizeAllowedTypes(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function validateFileAgainstPolicy(input: {
  file: File;
  allowedFileTypes?: Prisma.JsonValue | null;
}) {
  const allowedTypes = normalizeAllowedTypes(input.allowedFileTypes);
  if (!allowedTypes || allowedTypes.length === 0) {
    return true;
  }

  const extension = path.extname(input.file.name).toLowerCase();
  const contentType = input.file.type.toLowerCase();

  return allowedTypes.includes(extension) || (!!contentType && allowedTypes.includes(contentType));
}
