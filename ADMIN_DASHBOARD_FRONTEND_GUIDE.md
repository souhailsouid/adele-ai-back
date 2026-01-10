# 🎨 Dashboard Admin Frontend - Guide Complet

## 🚀 Stack Technique

Selon `.cursorrules`, utilisez :
- **Next.js 14+** (App Router)
- **TypeScript** avec interfaces claires
- **TanStack Query (React Query)** pour le state management
- **Shadcn/UI** pour les composants
- **Tailwind CSS** pour le styling
- **Lucide-React** pour les icons

---

## 📦 Installation des Dépendances

```bash
# Dans votre projet frontend Next.js
npm install @tanstack/react-query
npm install lucide-react
npx shadcn-ui@latest add card table badge button select
```

---

## 🔧 Configuration

### 1. Types TypeScript

Créez `types/admin.ts` :

```typescript
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type DocType = '13F' | '10K' | '10Q' | 'RSS' | 'OTHER';
export type CronStatus = 'SUCCESS' | 'FAILED' | 'RUNNING';

export interface ProcessingJob {
  id: string;
  filename: string;
  status: JobStatus;
  doc_type: DocType | null;
  filing_id: number | null;
  fund_id: number | null;
  retry_count: number;
  max_retries: number;
  error_log: string | null;
  metrics: {
    rows_parsed?: number;
    holdings_count?: number;
    validation_errors?: number;
    [key: string]: any;
  } | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CronJob {
  id: string;
  is_active: boolean;
  last_status: CronStatus | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  run_count: number;
  success_count: number;
  failure_count: number;
  schedule_expression: string | null;
  next_run_at: string | null;
  avg_duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface AdminDashboardMetrics {
  queue: {
    pending: number;
    processing: number;
    completed_today: number;
    failed: number;
    failed_retryable: number;
  };
  crons: {
    total: number;
    active: number;
    inactive: number;
    running: number;
    last_24h_success: number;
    last_24h_failure: number;
  };
  recent_jobs: ProcessingJob[];
  recent_errors: Array<{
    job_id: string;
    filename: string;
    error: string;
    retry_count: number;
    created_at: string;
  }>;
  cron_health: CronJob[];
}
```

### 2. Service API

Créez `lib/admin-api.ts` :

```typescript
import { AdminDashboardMetrics, ProcessingJob, CronJob, JobStatus } from '@/types/admin';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod';

async function getAccessToken(): Promise<string> {
  // Utiliser votre système d'auth (Cognito, Supabase Auth, etc.)
  // Exemple avec AWS Amplify:
  // const session = await Auth.currentSession();
  // return session.getIdToken().getJwtToken();
  
  // Pour Supabase Auth:
  // const { data: { session } } = await supabase.auth.getSession();
  // return session?.access_token || '';
  
  throw new Error('Implement your auth method');
}

async function fetchWithAuth<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const adminApi = {
  // Dashboard Metrics
  getDashboardMetrics: (): Promise<AdminDashboardMetrics> => 
    fetchWithAuth<AdminDashboardMetrics>('/admin/dashboard/metrics'),

  // Queue Management
  getJobs: (status?: JobStatus, limit = 100): Promise<ProcessingJob[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    return fetchWithAuth<ProcessingJob[]>(`/admin/queue/jobs?${params}`);
  },

  getJob: (jobId: string): Promise<ProcessingJob> => 
    fetchWithAuth<ProcessingJob>(`/admin/queue/jobs/${jobId}`),

  getPendingRetries: (limit = 100): Promise<ProcessingJob[]> =>
    fetchWithAuth<ProcessingJob[]>(`/admin/queue/pending-retries?limit=${limit}`),

  getUnparsedFiles: (minutesThreshold = 60): Promise<ProcessingJob[]> =>
    fetchWithAuth<ProcessingJob[]>(`/admin/queue/unparsed-files?minutes_threshold=${minutesThreshold}`),

  // Cron Management
  getCrons: (includeInactive = true): Promise<CronJob[]> =>
    fetchWithAuth<CronJob[]>(`/admin/crons?include_inactive=${includeInactive}`),

  getCron: (cronId: string): Promise<CronJob> =>
    fetchWithAuth<CronJob>(`/admin/crons/${cronId}`),

  setCronActive: async (cronId: string, isActive: boolean): Promise<void> => {
    await fetchWithAuth(`/admin/crons/${cronId}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  },
};
```

### 3. Hooks React Query

Créez `hooks/use-admin-dashboard.ts` :

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { AdminDashboardMetrics, ProcessingJob, CronJob, JobStatus } from '@/types/admin';

// Dashboard Metrics
export const useDashboardMetrics = () => {
  return useQuery<AdminDashboardMetrics>({
    queryKey: ['admin', 'dashboard', 'metrics'],
    queryFn: () => adminApi.getDashboardMetrics(),
    refetchInterval: 30000, // Refresh every 30s
  });
};

// Jobs
export const useJobs = (status?: JobStatus, limit = 100) => {
  return useQuery<ProcessingJob[]>({
    queryKey: ['admin', 'jobs', status, limit],
    queryFn: () => adminApi.getJobs(status, limit),
    refetchInterval: 10000, // Refresh every 10s
  });
};

export const useJob = (jobId: string) => {
  return useQuery<ProcessingJob>({
    queryKey: ['admin', 'jobs', jobId],
    queryFn: () => adminApi.getJob(jobId),
    enabled: !!jobId,
  });
};

export const usePendingRetries = (limit = 100) => {
  return useQuery<ProcessingJob[]>({
    queryKey: ['admin', 'pending-retries', limit],
    queryFn: () => adminApi.getPendingRetries(limit),
    refetchInterval: 15000, // Refresh every 15s
  });
};

export const useUnparsedFiles = (minutesThreshold = 60) => {
  return useQuery<ProcessingJob[]>({
    queryKey: ['admin', 'unparsed-files', minutesThreshold],
    queryFn: () => adminApi.getUnparsedFiles(minutesThreshold),
    refetchInterval: 20000, // Refresh every 20s
  });
};

// Crons
export const useCrons = (includeInactive = true) => {
  return useQuery<CronJob[]>({
    queryKey: ['admin', 'crons', includeInactive],
    queryFn: () => adminApi.getCrons(includeInactive),
    refetchInterval: 30000, // Refresh every 30s
  });
};

export const useCron = (cronId: string) => {
  return useQuery<CronJob>({
    queryKey: ['admin', 'crons', cronId],
    queryFn: () => adminApi.getCron(cronId),
    enabled: !!cronId,
  });
};

export const useSetCronActive = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ cronId, isActive }: { cronId: string; isActive: boolean }) =>
      adminApi.setCronActive(cronId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'crons'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
};
```

---

## 🎨 Composants UI

### 1. Dashboard Page

Créez `app/admin/page.tsx` :

```typescript
'use client';

import { useDashboardMetrics } from '@/hooks/use-admin-dashboard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export default function AdminPage() {
  const { data: metrics, isLoading, error } = useDashboardMetrics();

  if (isLoading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error loading dashboard: {error.message}</div>;
  }

  if (!metrics) {
    return <div className="p-8">No data available</div>;
  }

  return <AdminDashboard metrics={metrics} />;
}
```

### 2. Dashboard Component

Créez `components/admin/AdminDashboard.tsx` :

```typescript
'use client';

import { AdminDashboardMetrics } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface AdminDashboardProps {
  metrics: AdminDashboardMetrics;
}

export const AdminDashboard = ({ metrics }: AdminDashboardProps) => {
  const { queue, crons, recent_jobs, recent_errors, cron_health } = metrics;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      {/* Queue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard
          title="Pending"
          value={queue.pending}
          icon={Clock}
          variant="warning"
        />
        <MetricCard
          title="Processing"
          value={queue.processing}
          icon={Activity}
          variant="info"
        />
        <MetricCard
          title="Completed Today"
          value={queue.completed_today}
          icon={CheckCircle2}
          variant="success"
        />
        <MetricCard
          title="Failed"
          value={queue.failed}
          icon={XCircle}
          variant="destructive"
        />
        <MetricCard
          title="Retryable"
          value={queue.failed_retryable}
          icon={AlertTriangle}
          variant="warning"
        />
      </div>

      {/* Cron Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Active Crons"
          value={crons.active}
          icon={Activity}
          variant="success"
        />
        <MetricCard
          title="Inactive Crons"
          value={crons.inactive}
          icon={XCircle}
          variant="destructive"
        />
        <MetricCard
          title="24h Success"
          value={crons.last_24h_success}
          icon={CheckCircle2}
          variant="success"
        />
        <MetricCard
          title="24h Failures"
          value={crons.last_24h_failure}
          icon={XCircle}
          variant="destructive"
        />
      </div>

      {/* Recent Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <JobsTable jobs={recent_jobs.slice(0, 20)} />
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorsList errors={recent_errors.slice(0, 10)} />
        </CardContent>
      </Card>

      {/* Cron Health */}
      <Card>
        <CardHeader>
          <CardTitle>Cron Health</CardTitle>
        </CardHeader>
        <CardContent>
          <CronsTable crons={cron_health} />
        </CardContent>
      </Card>
    </div>
  );
};

const MetricCard = ({ 
  title, 
  value, 
  icon: Icon, 
  variant 
}: { 
  title: string; 
  value: number; 
  icon: any; 
  variant: 'success' | 'destructive' | 'warning' | 'info' 
}) => {
  const colors = {
    success: 'bg-green-100 text-green-800',
    destructive: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${colors[variant]}`}>{value}</p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
};

const JobsTable = ({ jobs }: { jobs: any[] }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Filename</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Type</th>
            <th className="text-left p-2">Retries</th>
            <th className="text-left p-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b">
              <td className="p-2">{job.filename}</td>
              <td className="p-2">
                <StatusBadge status={job.status} />
              </td>
              <td className="p-2">{job.doc_type || 'N/A'}</td>
              <td className="p-2">
                {job.retry_count}/{job.max_retries}
              </td>
              <td className="p-2 text-sm text-muted-foreground">
                {new Date(job.created_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
  };

  return (
    <Badge className={variants[status] || ''}>
      {status}
    </Badge>
  );
};

const ErrorsList = ({ errors }: { errors: any[] }) => {
  return (
    <div className="space-y-2">
      {errors.map((error, idx) => (
        <div key={idx} className="border rounded p-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{error.filename}</p>
              <p className="text-sm text-muted-foreground mt-1">{error.error}</p>
            </div>
            <Badge variant="destructive">Retry: {error.retry_count}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
};

const CronsTable = ({ crons }: { crons: any[] }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">ID</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Active</th>
            <th className="text-left p-2">Last Run</th>
            <th className="text-left p-2">Success Rate</th>
          </tr>
        </thead>
        <tbody>
          {crons.map((cron) => {
            const successRate = cron.run_count > 0 
              ? Math.round((cron.success_count / cron.run_count) * 100) 
              : 0;
            
            return (
              <tr key={cron.id} className="border-b">
                <td className="p-2 font-medium">{cron.id}</td>
                <td className="p-2">
                  <StatusBadge status={cron.last_status || 'UNKNOWN'} />
                </td>
                <td className="p-2">
                  <Badge variant={cron.is_active ? 'success' : 'destructive'}>
                    {cron.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="p-2 text-sm text-muted-foreground">
                  {cron.last_run_at 
                    ? new Date(cron.last_run_at).toLocaleString()
                    : 'Never'}
                </td>
                <td className="p-2">{successRate}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
```

---

## 📱 Pages Supplémentaires

### Jobs List Page

Créez `app/admin/jobs/page.tsx` :

```typescript
'use client';

import { useJobs, usePendingRetries, useUnparsedFiles } from '@/hooks/use-admin-dashboard';
import { JobStatus } from '@/types/admin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminJobsPage() {
  const { data: pendingJobs } = useJobs('PENDING');
  const { data: processingJobs } = useJobs('PROCESSING');
  const { data: failedJobs } = useJobs('FAILED');
  const { data: pendingRetries } = usePendingRetries();
  const { data: unparsedFiles } = useUnparsedFiles();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Jobs Management</h1>
      
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingJobs?.length || 0})</TabsTrigger>
          <TabsTrigger value="processing">Processing ({processingJobs?.length || 0})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({failedJobs?.length || 0})</TabsTrigger>
          <TabsTrigger value="retries">Pending Retries ({pendingRetries?.length || 0})</TabsTrigger>
          <TabsTrigger value="unparsed">Unparsed ({unparsedFiles?.length || 0})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="pending">
          <JobsTable jobs={pendingJobs || []} />
        </TabsContent>
        <TabsContent value="processing">
          <JobsTable jobs={processingJobs || []} />
        </TabsContent>
        <TabsContent value="failed">
          <JobsTable jobs={failedJobs || []} />
        </TabsContent>
        <TabsContent value="retries">
          <JobsTable jobs={pendingRetries || []} />
        </TabsContent>
        <TabsContent value="unparsed">
          <JobsTable jobs={unparsedFiles || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Crons Management Page

Créez `app/admin/crons/page.tsx` :

```typescript
'use client';

import { useCrons, useSetCronActive } from '@/hooks/use-admin-dashboard';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

export default function AdminCronsPage() {
  const { data: crons } = useCrons(true);
  const { mutate: setCronActive } = useSetCronActive();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Crons Management</h1>
      
      <div className="space-y-4">
        {crons?.map((cron) => (
          <Card key={cron.id}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{cron.id}</CardTitle>
                <Switch
                  checked={cron.is_active}
                  onCheckedChange={(checked) =>
                    setCronActive({ cronId: cron.id, isActive: checked })
                  }
                />
              </div>
            </CardHeader>
            <CardContent>
              {/* Cron details */}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## 🚀 Mise en Place

1. **Configurer l'API URL** dans `.env.local` :
```bash
NEXT_PUBLIC_API_URL=https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod
```

2. **Configurer React Query Provider** dans `app/layout.tsx` :
```typescript
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

3. **Protéger la route admin** avec votre système d'auth (Cognito, Supabase Auth, etc.)

---

## ✅ Résumé

**Stack** :
- Next.js App Router + TypeScript
- TanStack Query pour le state management
- Shadcn/UI pour les composants
- Tailwind CSS pour le styling

**Fonctionnalités** :
- ✅ Dashboard avec métriques en temps réel (auto-refresh)
- ✅ Liste des jobs avec filtres par statut
- ✅ Jobs en attente de retry
- ✅ Fichiers non parsés
- ✅ Gestion des crons (activate/deactivate)
- ✅ Historique des erreurs

Le dashboard est maintenant prêt à consommer les routes `/admin/*` de votre API !
