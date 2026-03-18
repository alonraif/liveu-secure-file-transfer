import { cookies } from "next/headers";
import { FLASH_SHARE_LINK_COOKIE } from "@/lib/constants";

export async function getFlashShareLink() {
  const cookieStore = cookies();
  return cookieStore.get(FLASH_SHARE_LINK_COOKIE)?.value ?? null;
}
