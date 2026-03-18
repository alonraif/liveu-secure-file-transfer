import pino from "pino";

export const logger = pino({
  name: "liveu-sft-web",
  level: process.env.LOG_LEVEL ?? "info"
});
