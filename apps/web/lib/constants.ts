export const SESSION_COOKIE_NAME = "liveu_sft_session";
export const FLASH_SHARE_LINK_COOKIE = "liveu_sft_flash_share_link";
export const SHARE_ACCESS_COOKIE_PREFIX = "liveu_sft_share_access_";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
};
