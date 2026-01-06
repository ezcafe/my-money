/**
 * Multipart Configuration
 * Handles GraphQL multipart requests for file uploads
 */

import type {FastifyInstance} from 'fastify';

/**
 * Add hook to process GraphQL multipart requests (file uploads)
 * This processes the multipart request and converts it to the format Apollo Server expects
 * @param fastify - Fastify instance
 */
export function registerMultipartHandler(fastify: FastifyInstance): void {
  fastify.addHook('preHandler', async (request, reply) => {
    // Only process GraphQL POST requests that are multipart
    // Skip if already processed or not multipart
    if (request.url === '/graphql' && request.method === 'POST' && request.isMultipart()) {
      try {
        const operations: {query?: string; variables?: Record<string, unknown>} = {};
        const map: Record<string, string[]> = {};
        const files: Record<string, {filename: string; mimetype?: string; encoding?: string; createReadStream: () => NodeJS.ReadableStream}> = {};

        const parts = request.parts();

        for await (const part of parts) {
          if (part.type === 'file') {
            // Consume file stream into buffer to allow iterator to continue
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk as Buffer);
            }
            const fileBuffer = Buffer.concat(chunks);
            // Store file data with createReadStream that returns a stream from the buffer
            const {Readable} = await import('stream');
            const fileObj = {
              filename: part.filename ?? 'unknown',
              mimetype: part.mimetype,
              encoding: part.encoding,
              createReadStream: (): NodeJS.ReadableStream => Readable.from(fileBuffer),
            };
            files[part.fieldname] = fileObj;
          } else {
            // Parse operations and map fields
            let value: string;
            // For field parts, check if part has a toBuffer method or value property
            const partWithBuffer = part as unknown as {toBuffer?: () => Promise<Buffer>};
            if (typeof partWithBuffer.toBuffer === 'function') {
              const buffer = await partWithBuffer.toBuffer();
              value = buffer.toString('utf-8');
            } else {
              const partWithValue = part as unknown as {value?: string};
              if (partWithValue.value) {
                value = partWithValue.value;
              } else {
                // Fallback: read from part as stream (part itself should be iterable for field parts)
                const chunks: Buffer[] = [];
                const partAsIterable = part as unknown as AsyncIterable<Buffer>;
                for await (const chunk of partAsIterable) {
                  chunks.push(chunk);
                }
                value = Buffer.concat(chunks).toString('utf-8');
              }
            }

            if (part.fieldname === 'operations') {
              Object.assign(operations, JSON.parse(value));
            } else if (part.fieldname === 'map') {
              Object.assign(map, JSON.parse(value));
            }
          }
        }

        // Replace file placeholders in operations.variables with actual file promises
        if (operations.variables && typeof operations.variables === 'object') {
          const variables = operations.variables;
          for (const [fileKey, filePaths] of Object.entries(map)) {
            // fileKey is the file part fieldname (e.g., "0"), filePaths is array of variable paths (e.g., ["file"])
            if (Array.isArray(filePaths) && filePaths.length > 0 && files[fileKey]) {
              const variablePath = filePaths[0]; // e.g., "file"
              if (!variablePath) {
                continue;
              }
              const pathParts = variablePath.split('.');
              let current: Record<string, unknown> = variables;
              for (let i = 0; i < pathParts.length - 1; i++) {
                const key = pathParts[i];
                if (!key) {
                  continue;
                }
                if (!current[key] || typeof current[key] !== 'object') {
                  current[key] = {};
                }
                current = current[key] as Record<string, unknown>;
              }
              const lastKey = pathParts[pathParts.length - 1];
              if (lastKey) {
                const fileObj = files[fileKey];
                // Create a plain object with explicitly enumerable properties to ensure they survive Apollo Server processing
                const plainFileObj = {
                  filename: fileObj.filename,
                  mimetype: fileObj.mimetype,
                  encoding: fileObj.encoding,
                  createReadStream: fileObj.createReadStream,
                };
                current[lastKey] = Promise.resolve(plainFileObj);
              }
            }
          }
        }

        // Store files in request context BEFORE setting body
        // This ensures files are available even if body gets serialized
        (request as {uploadFiles?: typeof files}).uploadFiles = files;

        // Store file promises in request context so they're accessible to resolvers
        // The file promises are already in operations.variables, so we just need to ensure
        // the body is set correctly for Apollo Server
        request.body = operations;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        fastify.log.error({err: errorObj}, 'Error processing multipart GraphQL request');
        return reply.code(400).send({errors: [{message: 'Failed to process file upload'}]});
      }
    }
  });
}

