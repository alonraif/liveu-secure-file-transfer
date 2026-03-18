import http from "node:http";
import pino from "pino";
import { parseEnv } from "@liveu-sft/config";

const env = parseEnv();
const logger = pino({
  name: "liveu-sft-worker",
  level: process.env.LOG_LEVEL ?? "info"
});

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        ok: true,
        service: "worker",
        timestamp: new Date().toISOString()
      })
    );
    return;
  }

  if (request.url === "/ready") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        ok: true,
        service: "worker",
        jobs: "scheduler-not-yet-enabled"
      })
    );
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: false, error: "Not found" }));
});

const boot = () => {
  logger.info(
    {
      port: env.WORKER_PORT,
      nodeEnv: env.NODE_ENV
    },
    "worker service started"
  );

  setInterval(() => {
    logger.info("worker heartbeat");
  }, 60_000).unref();

  server.listen(env.WORKER_PORT, "0.0.0.0");
};

boot();
