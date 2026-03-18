import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { env } from "@/lib/env";

const client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY
  }
});

export async function uploadBuffer(input: {
  objectKey: string;
  body: Buffer;
  contentType?: string | null;
  filename: string;
}) {
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: input.objectKey,
      Body: input.body,
      ContentType: input.contentType ?? "application/octet-stream",
      Metadata: {
        filename: input.filename
      }
    })
  );
}

export async function getObjectStream(
  objectKey: string
): Promise<{ body: Readable; contentType: string; contentLength?: number }> {
  const result = await client.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: objectKey
    })
  );

  if (!result.Body) {
    throw new Error(`Storage object body missing for ${objectKey}`);
  }

  const body =
    result.Body instanceof Readable
      ? result.Body
      : "transformToWebStream" in result.Body
        ? Readable.fromWeb((await result.Body.transformToWebStream()) as any)
        : Readable.from(result.Body as AsyncIterable<Uint8Array>);

  return {
    body,
    contentType: result.ContentType ?? "application/octet-stream",
    contentLength: result.ContentLength
  };
}
