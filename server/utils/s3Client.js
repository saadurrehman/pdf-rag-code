/**
 * AWS S3 Client (SDK v2)
 * Credentials are read from .env via process.env.
 * Lazy init: client is created on first use so dotenv has already run when index.js loads.
 * Required in server/.env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION (optional), AWS_S3_BUCKET.
 */
import AWS from 'aws-sdk';

let s3Instance = null;

/** Returns the S3 client, creating it on first call using env vars from .env */
export function getS3() {
  if (!s3Instance) {
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
    });
    s3Instance = new AWS.S3();
  }
  return s3Instance;
}

/** Default export for drop-in usage where getS3() is called instead of using a static client */
export default getS3;
