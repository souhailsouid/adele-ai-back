/**
 * Routes Admin - Dashboard de monitoring
 * Endpoints pour le dashboard admin frontend
 */

import { APIGatewayProxyEventV2 } from "aws-lambda";
import { getDashboardMetrics, getPendingRetries, getUnparsedFiles } from "../services/admin/adminService";
import { getJob, getJobsByStatus, type JobStatus } from "../services/admin/queueService";
import { getCronStatus, getAllCrons, setCronActive } from "../services/admin/cronService";
import { 
  getAWSInfrastructureStatus, 
  getLambdaStatuses, 
  getSQSQueueStatuses, 
  getLambdaMetrics,
  getAthenaStatus,
  getBudgetStatuses 
} from "../services/admin/awsMonitoringService";
import { 
  getAWSInfrastructureStatus, 
  getLambdaStatuses, 
  getSQSQueueStatuses, 
  getLambdaMetrics,
  getAthenaStatus,
  getBudgetStatuses 
} from "../services/admin/awsMonitoringService";

function getPathParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.pathParameters?.[key];
}

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

export const adminRoutes = [
  // ========== Dashboard Metrics ==========
  {
    method: "GET",
    path: "/admin/dashboard/metrics",
    handler: async (event: APIGatewayProxyEventV2) => {
      return await getDashboardMetrics();
    },
  },

  // ========== Queue Management ==========
  {
    method: "GET",
    path: "/admin/queue/jobs",
    handler: async (event: APIGatewayProxyEventV2) => {
      const status = getQueryParam(event, "status") as JobStatus | undefined;
      const limit = getQueryParam(event, "limit") 
        ? parseInt(getQueryParam(event, "limit")!) 
        : 100;

      if (status) {
        return await getJobsByStatus(status, limit);
      }

      // Retourner tous les jobs récents si pas de filtre
      const metrics = await getDashboardMetrics();
      return metrics.recent_jobs.slice(0, limit);
    },
  },

  {
    method: "GET",
    path: "/admin/queue/jobs/{jobId}",
    handler: async (event: APIGatewayProxyEventV2) => {
      const jobId = getPathParam(event, "jobId");
      if (!jobId) throw new Error("Missing jobId parameter");
      
      const job = await getJob(jobId);
      if (!job) {
        throw new Error("Job not found");
      }
      return job;
    },
  },

  {
    method: "GET",
    path: "/admin/queue/pending-retries",
    handler: async (event: APIGatewayProxyEventV2) => {
      const limit = getQueryParam(event, "limit") 
        ? parseInt(getQueryParam(event, "limit")!) 
        : 100;
      return await getPendingRetries(limit);
    },
  },

  {
    method: "GET",
    path: "/admin/queue/unparsed-files",
    handler: async (event: APIGatewayProxyEventV2) => {
      const minutesThreshold = getQueryParam(event, "minutes_threshold") 
        ? parseInt(getQueryParam(event, "minutes_threshold")!) 
        : 60;
      return await getUnparsedFiles(minutesThreshold);
    },
  },

  // ========== Cron Management ==========
  {
    method: "GET",
    path: "/admin/crons",
    handler: async (event: APIGatewayProxyEventV2) => {
      const includeInactive = getQueryParam(event, "include_inactive") !== "false";
      return await getAllCrons(includeInactive);
    },
  },

  {
    method: "GET",
    path: "/admin/crons/{cronId}",
    handler: async (event: APIGatewayProxyEventV2) => {
      const cronId = getPathParam(event, "cronId");
      if (!cronId) throw new Error("Missing cronId parameter");
      
      const cron = await getCronStatus(cronId);
      if (!cron) {
        throw new Error("Cron not found");
      }
      return cron;
    },
  },

  {
    method: "PATCH",
    path: "/admin/crons/{cronId}/active",
    handler: async (event: APIGatewayProxyEventV2) => {
      const cronId = getPathParam(event, "cronId");
      if (!cronId) throw new Error("Missing cronId parameter");

      const body = event.body ? JSON.parse(event.body) : {};
      const isActive = body.is_active !== undefined ? body.is_active : true;

      await setCronActive(cronId, isActive);
      return { success: true, cron_id: cronId, is_active: isActive };
    },
  },

  // ========== AWS Infrastructure Monitoring ==========
  {
    method: "GET",
    path: "/admin/aws/infrastructure",
    handler: async (event: APIGatewayProxyEventV2) => {
      return await getAWSInfrastructureStatus();
    },
  },

  {
    method: "GET",
    path: "/admin/aws/lambdas",
    handler: async (event: APIGatewayProxyEventV2) => {
      return await getLambdaStatuses();
    },
  },

  {
    method: "GET",
    path: "/admin/aws/lambdas/{functionName}/metrics",
    handler: async (event: APIGatewayProxyEventV2) => {
      const functionName = getPathParam(event, "functionName");
      if (!functionName) throw new Error("Missing functionName parameter");
      
      const metrics = await getLambdaMetrics([functionName]);
      return metrics[0] || null;
    },
  },

  {
    method: "GET",
    path: "/admin/aws/sqs/queues",
    handler: async (event: APIGatewayProxyEventV2) => {
      return await getSQSQueueStatuses();
    },
  },

  {
    method: "GET",
    path: "/admin/aws/athena",
    handler: async (event: APIGatewayProxyEventV2) => {
      return await getAthenaStatus();
    },
  },

  {
    method: "GET",
    path: "/admin/aws/budgets",
    handler: async (event: APIGatewayProxyEventV2) => {
      return await getBudgetStatuses();
    },
  },
];
