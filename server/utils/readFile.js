/**
 * Read a file from S3 using the v2 S3 client.
 * Bucket from .env: AWS_S3_BUCKET (or S3_BUCKET_NAME). Best for text; for binary use data.Body.
 */
import getS3 from './s3Client.js';

function getBucket() {
  return process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
}

/**
 * Read a file from S3 and return its contents as a UTF-8 string.
 * @param {string} keyName - Object key in S3, e.g. 'uploads/localfile.txt'
 * @returns {Promise<string>} - File content as string
 */
async function readFileFromS3(keyName) {
  const bucket = getBucket();
  if (!bucket) {
    throw new Error('S3 bucket not set. Add AWS_S3_BUCKET (or S3_BUCKET_NAME) to .env');
  }

  try {
    const data = await getS3().getObject({ Bucket: bucket, Key: keyName }).promise();
    return data.Body.toString('utf-8');
  } catch (err) {
    console.error('[S3] Read error:', err.code || err.name, err.message);
    throw err;
  }
}

export default readFileFromS3;

// Example usage:
// import readFileFromS3 from './utils/readFile.js';
// const content = await readFileFromS3('uploads/localfile.txt');
