import {
	S3Client,
	GetObjectCommand,
	PutObjectCommand,
	DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "grandeo/env";

// Initialize S3 client
const s3Client = new S3Client({
	region: env.AWS_REGION,
	credentials: {
		accessKeyId: env.AWS_ACCESS_KEY_ID,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
	},
});

/**
 * Get a file from S3 bucket
 * @param key - The key/path of the file in the bucket
 * @returns Promise<Buffer> - The file content as a buffer
 */
export const getFileFromS3 = async (key: string): Promise<Buffer> => {
	try {
		const command = new GetObjectCommand({
			Bucket: env.DATA_BUCKET_NAME,
			Key: key,
		});

		const response = await s3Client.send(command);

		if (!response.Body) {
			throw new Error("No file content received");
		}

		// Convert stream to buffer
		const chunks: Uint8Array[] = [];
		const reader = response.Body.transformToWebStream().getReader();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
		}

		return Buffer.concat(chunks);
	} catch (error) {
		console.error("Error getting file from S3:", error);
		throw error;
	}
};

/**
 * Upload a file to S3 bucket
 * @param key - The key/path where to store the file in the bucket
 * @param fileBuffer - The file content as a buffer
 * @param contentType - The MIME type of the file (optional)
 * @returns Promise<string> - The key of the uploaded file
 */
export const uploadFileToS3 = async (
	key: string,
	fileBuffer: Buffer,
	contentType?: string,
): Promise<string> => {
	try {
		const command = new PutObjectCommand({
			Bucket: env.DATA_BUCKET_NAME,
			Key: key,
			Body: fileBuffer,
			ContentType: contentType,
		});

		await s3Client.send(command);

		return key;
	} catch (error) {
		console.error("Error uploading file to S3:", error);
		throw error;
	}
};

/**
 * Delete a file from S3 bucket
 * @param key - The key/path of the file to delete
 * @returns Promise<void>
 */
export const deleteFileFromS3 = async (key: string): Promise<void> => {
	try {
		const command = new DeleteObjectCommand({
			Bucket: env.DATA_BUCKET_NAME,
			Key: key,
		});

		await s3Client.send(command);
	} catch (error) {
		console.error("Error deleting file from S3:", error);
		throw error;
	}
};
