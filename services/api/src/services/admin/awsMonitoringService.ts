/**
 * Service de monitoring AWS pour le dashboard admin
 * Surveille Lambda, SQS, Athena, budgets, etc.
 */

import { LambdaClient, GetFunctionCommand, ListFunctionsCommand, GetFunctionConcurrencyCommand } from '@aws-sdk/client-lambda';
import { SQSClient, GetQueueAttributesCommand, ListQueuesCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { AthenaClient, GetWorkGroupCommand, ListQueryExecutionsCommand } from '@aws-sdk/client-athena';
import { BudgetsClient, DescribeBudgetCommand, DescribeBudgetsCommand } from '@aws-sdk/client-budgets';

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'eu-west-3' });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'eu-west-3' });
const cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION || 'eu-west-3' });
const athenaClient = new AthenaClient({ region: process.env.AWS_REGION || 'eu-west-3' });
const budgetsClient = new BudgetsClient({ region: process.env.AWS_REGION || 'us-east-1' }); // Budgets API is only in us-east-1

// Extraire PROJECT et STAGE depuis les noms de fonctions Lambda ou utiliser des valeurs par défaut
// Les Lambdas suivent le pattern: ${PROJECT}-${STAGE}-*
const PROJECT = 'adel-ai'; // À extraire depuis les fonctions si nécessaire
const STAGE = 'dev'; // À extraire depuis les fonctions si nécessaire
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID || '956633302249';

export interface LambdaStatus {
  function_name: string;
  state: 'Active' | 'Pending' | 'Inactive' | 'Failed';
  reserved_concurrent_executions: number | null;
  last_modified: string;
  timeout: number;
  memory_size: number;
}

export interface SQSQueueStatus {
  queue_name: string;
  approximate_number_of_messages: number;
  approximate_number_of_messages_not_visible: number;
  approximate_number_of_messages_delayed: number;
  visibility_timeout: number;
  message_retention_period: number;
}

export interface LambdaMetrics {
  function_name: string;
  invocations_24h: number;
  errors_24h: number;
  duration_avg_ms: number;
  throttles_24h: number;
}

export interface AthenaStatus {
  workgroup_name: string;
  state: string;
  bytes_scanned_cutoff_per_query: number;
  queries_24h: number;
  data_scanned_gb_24h: number;
}

export interface BudgetStatus {
  budget_name: string;
  budget_limit: number;
  actual_spend: number;
  forecasted_spend: number;
  time_unit: string;
  threshold_percentage: number;
}

export interface AWSInfrastructureStatus {
  lambdas: LambdaStatus[];
  sqs_queues: SQSQueueStatus[];
  lambda_metrics: LambdaMetrics[];
  athena: AthenaStatus | null;
  budgets: BudgetStatus[];
  summary: {
    total_lambdas: number;
    active_lambdas: number;
    total_queues: number;
    queues_with_messages: number;
    total_dlq_messages: number;
    athena_enabled: boolean;
  };
}

/**
 * Récupérer le statut de toutes les Lambdas du projet
 */
export async function getLambdaStatuses(): Promise<LambdaStatus[]> {
  const functions: LambdaStatus[] = [];
  let nextMarker: string | undefined;

  do {
    const command = new ListFunctionsCommand({
      Marker: nextMarker,
    });

    const response = await lambdaClient.send(command);
    const projectFunctions = (response.Functions || []).filter(fn => 
      fn.FunctionName?.startsWith(`${PROJECT}-${STAGE}-`)
    );

    for (const fn of projectFunctions) {
      if (!fn.FunctionName) continue;

      // Récupérer la concurrency
      let reservedConcurrency: number | null = null;
      try {
        const concurrencyCommand = new GetFunctionConcurrencyCommand({
          FunctionName: fn.FunctionName,
        });
        const concurrencyResponse = await lambdaClient.send(concurrencyCommand);
        reservedConcurrency = concurrencyResponse.ReservedConcurrentExecutions ?? null;
      } catch (error) {
        // Pas de concurrency configurée
      }

      functions.push({
        function_name: fn.FunctionName,
        state: fn.State || 'Active',
        reserved_concurrent_executions: reservedConcurrency,
        last_modified: fn.LastModified || '',
        timeout: fn.Timeout || 0,
        memory_size: fn.MemorySize || 0,
      });
    }

    nextMarker = response.NextMarker;
  } while (nextMarker);

  return functions;
}

/**
 * Récupérer le statut des queues SQS du projet
 */
export async function getSQSQueueStatuses(): Promise<SQSQueueStatus[]> {
  const queues: SQSQueueStatus[] = [];
  let nextToken: string | undefined;

  do {
    const command = new ListQueuesCommand({
      QueueNamePrefix: `${PROJECT}-${STAGE}-`,
      NextToken: nextToken,
    });

    const response = await sqsClient.send(command);
    const queueUrls = response.QueueUrls || [];

    for (const queueUrl of queueUrls) {
      const queueName = queueUrl.split('/').pop() || '';
      
      try {
        const attributesCommand = new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: [
            'ApproximateNumberOfMessages',
            'ApproximateNumberOfMessagesNotVisible',
            'ApproximateNumberOfMessagesDelayed',
            'VisibilityTimeoutSeconds',
            'MessageRetentionPeriod',
          ],
        });

        const attributesResponse = await sqsClient.send(attributesCommand);
        const attrs = attributesResponse.Attributes || {};

        queues.push({
          queue_name: queueName,
          approximate_number_of_messages: parseInt(attrs.ApproximateNumberOfMessages || '0'),
          approximate_number_of_messages_not_visible: parseInt(attrs.ApproximateNumberOfMessagesNotVisible || '0'),
          approximate_number_of_messages_delayed: parseInt(attrs.ApproximateNumberOfMessagesDelayed || '0'),
          visibility_timeout: parseInt(attrs.VisibilityTimeoutSeconds || '0'),
          message_retention_period: parseInt(attrs.MessageRetentionPeriod || '0'),
        });
      } catch (error) {
        console.error(`Error getting queue attributes for ${queueName}:`, error);
      }
    }

    nextToken = response.NextToken;
  } while (nextToken);

  return queues;
}

/**
 * Récupérer les métriques Lambda des 24 dernières heures
 */
export async function getLambdaMetrics(functionNames: string[]): Promise<LambdaMetrics[]> {
  const metrics: LambdaMetrics[] = [];
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24h

  for (const functionName of functionNames) {
    try {
      // Invocations
      const invocationsCommand = new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Invocations',
        Dimensions: [{ Name: 'FunctionName', Value: functionName }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600, // 1 heure
        Statistics: ['Sum'],
      });
      const invocationsResponse = await cloudWatchClient.send(invocationsCommand);
      const invocations = invocationsResponse.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0;

      // Errors
      const errorsCommand = new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Errors',
        Dimensions: [{ Name: 'FunctionName', Value: functionName }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600,
        Statistics: ['Sum'],
      });
      const errorsResponse = await cloudWatchClient.send(errorsCommand);
      const errors = errorsResponse.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0;

      // Duration
      const durationCommand = new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Duration',
        Dimensions: [{ Name: 'FunctionName', Value: functionName }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600,
        Statistics: ['Average'],
      });
      const durationResponse = await cloudWatchClient.send(durationCommand);
      const durationDatapoints = durationResponse.Datapoints || [];
      const durationAvg = durationDatapoints.length > 0
        ? durationDatapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / durationDatapoints.length
        : 0;

      // Throttles
      const throttlesCommand = new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Throttles',
        Dimensions: [{ Name: 'FunctionName', Value: functionName }],
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600,
        Statistics: ['Sum'],
      });
      const throttlesResponse = await cloudWatchClient.send(throttlesCommand);
      const throttles = throttlesResponse.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0;

      metrics.push({
        function_name: functionName,
        invocations_24h: Math.round(invocations),
        errors_24h: Math.round(errors),
        duration_avg_ms: Math.round(durationAvg),
        throttles_24h: Math.round(throttles),
      });
    } catch (error) {
      console.error(`Error getting metrics for ${functionName}:`, error);
    }
  }

  return metrics;
}

/**
 * Récupérer le statut Athena
 */
export async function getAthenaStatus(): Promise<AthenaStatus | null> {
  const workgroupName = `${PROJECT}-${STAGE}-workgroup`;

  try {
    const command = new GetWorkGroupCommand({
      WorkGroup: workgroupName,
    });

    const response = await athenaClient.send(command);
    const workgroup = response.WorkGroup;

    if (!workgroup) return null;

    // Récupérer les métriques des 24h
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    const queriesCommand = new GetMetricStatisticsCommand({
      Namespace: 'AWS/Athena',
      MetricName: 'QueryExecutionCount',
      Dimensions: [{ Name: 'WorkGroup', Value: workgroupName }],
      StartTime: startTime,
      EndTime: endTime,
      Period: 3600,
      Statistics: ['Sum'],
    });
    const queriesResponse = await cloudWatchClient.send(queriesCommand);
    const queries = queriesResponse.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0;

    const dataScannedCommand = new GetMetricStatisticsCommand({
      Namespace: 'AWS/Athena',
      MetricName: 'DataScannedInBytes',
      Dimensions: [{ Name: 'WorkGroup', Value: workgroupName }],
      StartTime: startTime,
      EndTime: endTime,
      Period: 3600,
      Statistics: ['Sum'],
    });
    const dataScannedResponse = await cloudWatchClient.send(dataScannedCommand);
    const dataScannedBytes = dataScannedResponse.Datapoints?.reduce((sum, dp) => sum + (dp.Sum || 0), 0) || 0;
    const dataScannedGB = dataScannedBytes / (1024 * 1024 * 1024);

    return {
      workgroup_name: workgroupName,
      state: workgroup.State || 'UNKNOWN',
      bytes_scanned_cutoff_per_query: workgroup.Configuration?.BytesScannedCutoffPerQuery || 0,
      queries_24h: Math.round(queries),
      data_scanned_gb_24h: Math.round(dataScannedGB * 100) / 100,
    };
  } catch (error) {
    console.error('Error getting Athena status:', error);
    return null;
  }
}

/**
 * Récupérer le statut des budgets AWS
 */
export async function getBudgetStatuses(): Promise<BudgetStatus[]> {
  const budgets: BudgetStatus[] = [];

  try {
    const command = new DescribeBudgetsCommand({
      AccountId: ACCOUNT_ID,
    });

    const response = await budgetsClient.send(command);
    const budgetList = response.Budgets || [];

    for (const budget of budgetList) {
      if (!budget.BudgetName || !budget.BudgetLimit) continue;

      const actualSpend = budget.CalculatedSpend?.ActualSpend?.Amount || '0';
      const forecastedSpend = budget.CalculatedSpend?.ForecastedSpend?.Amount || '0';

      budgets.push({
        budget_name: budget.BudgetName,
        budget_limit: parseFloat(budget.BudgetLimit.Amount || '0'),
        actual_spend: parseFloat(actualSpend),
        forecasted_spend: parseFloat(forecastedSpend),
        time_unit: budget.TimeUnit || 'MONTHLY',
        threshold_percentage: 80, // TODO: Extract from notifications
      });
    }
  } catch (error) {
    console.error('Error getting budgets:', error);
  }

  return budgets;
}

/**
 * Récupérer le statut complet de l'infrastructure AWS
 */
export async function getAWSInfrastructureStatus(): Promise<AWSInfrastructureStatus> {
  const [lambdas, sqsQueues, athena, budgets] = await Promise.all([
    getLambdaStatuses(),
    getSQSQueueStatuses(),
    getAthenaStatus(),
    getBudgetStatuses(),
  ]);

  // Récupérer les métriques Lambda
  const lambdaMetrics = await getLambdaMetrics(lambdas.map(l => l.function_name));

  // Calculer les DLQ messages
  const dlqQueues = sqsQueues.filter(q => q.queue_name.includes('-dlq'));
  const totalDlqMessages = dlqQueues.reduce((sum, q) => sum + q.approximate_number_of_messages, 0);

  return {
    lambdas,
    sqs_queues: sqsQueues,
    lambda_metrics: lambdaMetrics,
    athena,
    budgets,
    summary: {
      total_lambdas: lambdas.length,
      active_lambdas: lambdas.filter(l => l.state === 'Active').length,
      total_queues: sqsQueues.length,
      queues_with_messages: sqsQueues.filter(q => q.approximate_number_of_messages > 0).length,
      total_dlq_messages: totalDlqMessages,
      athena_enabled: athena?.state === 'ENABLED' || false,
    },
  };
}
