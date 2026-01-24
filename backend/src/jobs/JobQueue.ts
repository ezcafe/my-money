/**
 * Job Queue Service
 * Handles background job processing using BullMQ
 * Note: Requires Redis for BullMQ
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bullmq = require('bullmq') as {
  Queue: new (
    name: string,
    options: {
      connection: { host: string; port: number; password?: string };
      defaultJobOptions?: unknown;
    }
  ) => {
    add: (name: string, data: unknown) => Promise<{ id: string | undefined }>;
    getJob: (id: string) => Promise<{
      id: string | undefined;
      name: string;
      getState: () => Promise<string>;
      progress?: number;
      data?: unknown;
    } | null>;
    close: () => Promise<void>;
    opts: { connection: { host: string; port: number; password?: string } };
  };
  Worker: new (
    name: string,
    processor: (job: {
      id: string | undefined;
      name: string;
      data: unknown;
    }) => Promise<unknown>,
    options: {
      connection: { host: string; port: number; password?: string };
      concurrency?: number;
    }
  ) => {
    on: (
      event: string,
      handler: (
        job: { id: string | undefined; name: string },
        err?: Error
      ) => void
    ) => void;
    close: () => Promise<void>;
  };
  QueueEvents: new (
    name: string,
    options: { connection: { host: string; port: number; password?: string } }
  ) => {
    on: (
      event: string,
      handler: (data: { jobId: string; failedReason?: string }) => void
    ) => void;
    close: () => Promise<void>;
  };
};

const { Queue, Worker, QueueEvents } = bullmq;
import { logInfo, logError } from '../utils/logger';

/**
 * Job queue configuration
 */
interface JobQueueConfig {
  connection: {
    host: string;
    port: number;
    password?: string;
  };
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'exponential';
      delay: number;
    };
  };
}

/**
 * Job types
 */
export enum JobType {
  PDF_PARSE = 'pdf-parse',
  REPORT_GENERATE = 'report-generate',
  BULK_IMPORT = 'bulk-import',
  DATA_ARCHIVAL = 'data-archival',
}

/**
 * Job data interfaces
 */
export interface PDFParseJobData {
  filePath: string;
  workspaceId: string;
  userId: string;
}

export interface ReportGenerateJobData {
  workspaceId: string;
  userId: string;
  filters: Record<string, unknown>;
}

export interface BulkImportJobData {
  filePath: string;
  workspaceId: string;
  userId: string;
  importType: 'csv' | 'pdf';
}

export interface DataArchivalJobData {
  workspaceId?: string;
  retentionDays: number;
}

/**
 * Job Queue Manager
 */
export class JobQueue {
  private queue: InstanceType<typeof Queue>;
  private worker: InstanceType<typeof Worker> | null = null;
  private queueEvents: InstanceType<typeof QueueEvents>;

  constructor(config: JobQueueConfig) {
    this.queue = new Queue('my-money-jobs', {
      connection: config.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        ...config.defaultJobOptions,
      },
    });

    this.queueEvents = new QueueEvents('my-money-jobs', {
      connection: config.connection,
    });

    this.setupEventListeners();
  }

  /**
   * Add job to queue
   */
  async addJob<T extends JobType>(
    jobType: T,
    data: T extends JobType.PDF_PARSE
      ? PDFParseJobData
      : T extends JobType.REPORT_GENERATE
        ? ReportGenerateJobData
        : T extends JobType.BULK_IMPORT
          ? BulkImportJobData
          : T extends JobType.DATA_ARCHIVAL
            ? DataArchivalJobData
            : never
  ): Promise<string> {
    const job = await this.queue.add(jobType, data);
    logInfo('Job added to queue', {
      event: 'job_added',
      jobId: job.id,
      jobType,
    });
    return job.id!;
  }

  /**
   * Setup worker to process jobs
   */
  setupWorker(
    processor: (job: { name: string; data: unknown }) => Promise<unknown>
  ): void {
    if (this.worker) {
      void this.worker.close();
    }

    this.worker = new Worker(
      'my-money-jobs',
      async (job: { id: string | undefined; name: string; data: unknown }) => {
        logInfo('Processing job', {
          event: 'job_processing',
          jobId: job.id,
          jobType: job.name,
        });
        return processor(job);
      },
      {
        connection: this.queue.opts.connection,
        concurrency: 5,
      }
    );

    this.worker.on(
      'completed',
      (job: { id: string | undefined; name: string }) => {
        logInfo('Job completed', {
          event: 'job_completed',
          jobId: job.id,
          jobType: job.name,
        });
      }
    );

    this.worker.on(
      'failed',
      (
        job: { id: string | undefined; name: string } | undefined,
        err?: Error
      ) => {
        logError(
          'Job failed',
          {
            event: 'job_failed',
            jobId: job?.id,
            jobType: job?.name,
          },
          err
        );
      }
    );
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.queueEvents.on('completed', (data: { jobId: string }) => {
      logInfo('Job completed via events', {
        event: 'job_completed_event',
        jobId: data.jobId,
      });
    });

    this.queueEvents.on(
      'failed',
      (data: { jobId: string; failedReason?: string }) => {
        logError(
          'Job failed via events',
          {
            event: 'job_failed_event',
            jobId: data.jobId,
            failedReason: data.failedReason,
          },
          new Error(data.failedReason ?? 'Unknown error')
        );
      }
    );
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    id: string;
    name: string;
    state: string;
    progress?: number;
    data?: unknown;
  } | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();

    return {
      id: job.id!,
      name: job.name,
      state,
      progress: job.progress,
      data: job.data,
    };
  }

  /**
   * Close queue and worker
   */
  async close(): Promise<void> {
    await this.queue.close();
    if (this.worker) {
      await this.worker.close();
    }
    await this.queueEvents.close();
  }
}

/**
 * Create job queue instance
 * Returns null if Redis is not configured
 */
export function createJobQueue(): JobQueue | null {
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT
    ? Number.parseInt(process.env.REDIS_PORT, 10)
    : 6379;
  const redisPassword = process.env.REDIS_PASSWORD;

  if (!redisHost) {
    logInfo('Redis not configured, job queue disabled', {
      event: 'job_queue_disabled',
    });
    return null;
  }

  return new JobQueue({
    connection: {
      host: redisHost,
      port: redisPort,
      password: redisPassword,
    },
  });
}
