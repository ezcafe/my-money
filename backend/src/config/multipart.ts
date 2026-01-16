/**
 * Multipart Configuration
 * Handles GraphQL multipart requests for file uploads
 */

import type {Hono} from 'hono';
import type {IncomingMessage} from 'http';
import {MAX_MULTIPART_FILE_SIZE} from '../utils/constants';
import {Readable} from 'stream';
import Busboy from 'busboy';

/**
 * Add middleware to process GraphQL multipart requests (file uploads)
 * This processes the multipart request and converts it to the format Apollo Server expects
 * @param app - Hono app instance
 */
export function registerMultipartHandler(app: Hono): void {
  app.use('/graphql', async (c, next) => {
    // Only process POST requests that are multipart
    if (c.req.method !== 'POST') {
      return next();
    }

    const contentType = c.req.header('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return next();
    }

    try {
      const operations: {query?: string; variables?: Record<string, unknown>} = {};
      const map: Record<string, string[]> = {};
      const files: Record<string, {filename: string; mimetype?: string; encoding?: string; createReadStream: () => NodeJS.ReadableStream}> = {};

      // Get raw request from Hono - try to get Node.js IncomingMessage
      const rawReq = c.req.raw;

      // Convert Web API Request to Node.js stream for busboy
      let nodeStream: NodeJS.ReadableStream;
      let nodeReq: IncomingMessage;

      if (rawReq && 'socket' in rawReq) {
        // Already a Node.js IncomingMessage
        nodeReq = rawReq as unknown as IncomingMessage;
        nodeStream = nodeReq;
      } else if (rawReq?.body) {
        // Web API Request - convert body to Node.js stream
        const webStream = rawReq.body;
        if (!webStream) {
          throw new Error('Request body is missing');
        }

        // Convert Web ReadableStream to Node.js Readable stream
        const reader = (webStream as ReadableStream<Uint8Array>).getReader();
        nodeStream = new Readable({
          async read(): Promise<void> {
            try {
              const {done, value} = await reader.read();
              if (done) {
                this.push(null);
              } else {
                this.push(Buffer.from(value));
              }
            } catch (error) {
              this.destroy(error instanceof Error ? error : new Error(String(error)));
            }
          },
        });

        // Create mock IncomingMessage
        const headers: Record<string, string | string[] | undefined> = {};
        for (const [key, value] of rawReq.headers.entries()) {
          headers[key] = value;
        }
        nodeReq = Object.assign(nodeStream, {
          headers,
          method: rawReq.method,
          url: rawReq.url,
        }) as unknown as IncomingMessage;
      } else {
        throw new Error('Cannot access request body');
      }

      // Parse multipart form data using busboy
      const fields: Record<string, string[]> = {};
      const parsedFiles: Record<string, Array<{buffer: Buffer; filename: string; mimetype?: string}>> = {};

      await new Promise<void>((resolve, reject) => {
        const busboy = Busboy({headers: nodeReq.headers as Record<string, string>});

        busboy.on('field', (name: string, value: string) => {
          fields[name] ??= [];
          fields[name].push(value);
        });

        busboy.on('file', (name: string, file: NodeJS.ReadableStream, info: {filename: string; encoding: string; mimeType: string}) => {
          const chunks: Buffer[] = [];
          file.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          file.on('end', () => {
            const buffer = Buffer.concat(chunks);
            if (buffer.length > MAX_MULTIPART_FILE_SIZE) {
              reject(new Error(`File size exceeds maximum allowed size of ${MAX_MULTIPART_FILE_SIZE / 1024 / 1024}MB`));
              return;
            }
            parsedFiles[name] ??= [];
            parsedFiles[name].push({
              buffer,
              filename: info.filename,
              mimetype: info.mimeType,
            });
          });
        });

        busboy.on('finish', () => {
          resolve();
        });

        busboy.on('error', (err: Error) => {
          reject(err);
        });

        nodeStream.pipe(busboy);
      });

      // Process files
      for (const [fieldname, fileArray] of Object.entries(parsedFiles)) {
        if (fileArray.length > 0) {
          const file = fileArray[0];
          if (file) {
            // Create file object compatible with Apollo Server
            const fileObj = {
              filename: file.filename,
              mimetype: file.mimetype,
              encoding: 'utf-8',
              createReadStream: (): NodeJS.ReadableStream => Readable.from(file.buffer),
            };
            files[fieldname] = fileObj;
          }
        }
      }

      // Process fields (operations and map)
      if (fields.operations?.[0]) {
        Object.assign(operations, JSON.parse(fields.operations[0]));
      }

      if (fields.map?.[0]) {
        Object.assign(map, JSON.parse(fields.map[0]));
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

      // Store files in context for fallback when Promise serialization loses properties
      // Store both in Hono context and as a property on the request for easy access
      (c as {set: (key: string, value: unknown) => void}).set('uploadFiles', files);
      // Also store directly on request object for easier access in resolver
      (c.req as {uploadFiles?: typeof files}).uploadFiles = files;

      // Set body for Apollo Server
      (c.req as {body?: unknown}).body = operations;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      console.error('Error processing multipart GraphQL request:', errorObj);
      return c.json({errors: [{message: 'Failed to process file upload'}]}, 400);
    }

    return next();
  });
}
