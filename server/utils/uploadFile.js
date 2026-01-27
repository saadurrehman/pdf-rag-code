/**
 * Upload a file to S3 using the v2 S3 client.
 * Bucket from .env: AWS_S3_BUCKET (or S3_BUCKET_NAME).
 */
import getS3 from './s3Client.js';
import fs from 'fs';

/** Bucket name: AWS_S3_BUCKET or S3_BUCKET_NAME (your .env uses AWS_S3_BUCKET) */
function getBucket() {
  return process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
}

/**
 * Check if S3 is configured (bucket + AWS credentials in .env).
 */
export function isS3Configured() {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    getBucket()
  );
}

/**
 * Upload a local file to S3. Uses AWS_S3_BUCKET / AWS_REGION / AWS_* from .env.
 * @param {string} filePath - Local path to the file
 * @param {string} keyName - Object key in S3, e.g. 'uploads/localfile.txt'
 * @returns {Promise<string>} - The object URL (Location)
 */
async function uploadFile(filePath, keyName) {
  const bucket = getBucket();
  if (!bucket) {
    throw new Error('S3 bucket not set. Add AWS_S3_BUCKET (or S3_BUCKET_NAME) to .env');
  }

  const s3 = getS3();
  const params = {
    Bucket: bucket,
    Key: keyName,
    Body: fs.createReadStream(filePath),
  };

  try {
    const data = await s3.upload(params).promise();
    console.log('[S3] File uploaded:', data.Location);
    return data.Location;
  } catch (err) {
    console.error('[S3] Upload error:', err.code || err.name, err.message);
    throw err;
  }
}

/**
 * Upload a buffer directly to S3 (no file written to disk). Use for in-memory uploads.
 * @param {Buffer} buffer - File contents in memory
 * @param {string} keyName - Object key in S3, e.g. 'pdfs/123-doc.pdf'
 * @param {string} [contentType] - Optional, e.g. 'application/pdf'
 * @returns {Promise<string>} - The object URL (Location)
 */
export async function uploadFromBuffer(buffer, keyName, contentType) {
  const bucket = getBucket();
  if (!bucket) {
    throw new Error('S3 bucket not set. Add AWS_S3_BUCKET (or S3_BUCKET_NAME) to .env');
  }

  const s3 = getS3();
  const params = {
    Bucket: bucket,
    Key: keyName,
    Body: buffer,
    ...(contentType && { ContentType: contentType }),
  };

  try {
    const data = await s3.upload(params).promise();
    console.log('[S3] File uploaded:', data.Location);
    return data.Location;
  } catch (err) {
    console.error('[S3] Upload error:', err.code || err.name, err.message);
    throw err;
  }
}

export default uploadFile;

// Example usage:
// import uploadFile from './utils/uploadFile.js';
// const url = await uploadFile('./localfile.txt', 'uploads/localfile.txt');
