import { S3Client } from "@aws-sdk/client-s3";

let s3Client: S3Client | null = null;

export function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return s3Client;
}

export const S3_BUCKET = process.env.S3_BUCKET!;
export const S3_PUBLIC_URL =
  process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT ?? "";

/** Get a public URL for an uploaded file */
export function getPublicUrl(key: string): string {
  return `${S3_PUBLIC_URL}/${S3_BUCKET}/${key}`;
}
