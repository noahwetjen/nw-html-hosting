import 'dotenv/config';

export type AppConfig = {
  apiKey: string;
  databaseUrl: string;
  port: number;
  publicBaseUrl: string;
  nodeEnv: string;
};

function required(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value) {
    return value;
  }
  if (fallback !== undefined && process.env.NODE_ENV !== 'production') {
    return fallback;
  }
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 3000);
  const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`;

  return {
    apiKey: required('HTML_HOSTING_API_KEY', 'local-dev-key'),
    databaseUrl: required(
      'DATABASE_URL',
      'postgresql://postgres:postgres@localhost:5432/shareable_agent_html'
    ),
    port,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ''),
    nodeEnv: process.env.NODE_ENV ?? 'development'
  };
}
