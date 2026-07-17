export type HostStatus = {
  platform: string;
  available: boolean;
  appName: string | undefined;
  executable: string | undefined;
  message: string;
};

export type EvalResult = { ok: true; result: string } | { ok: false; error: string; line?: number };

export type OpenProjectResult = {
  path: string;
  opened: true;
};

export interface AeHost {
  status(): Promise<HostStatus>;
  ensureSession(): Promise<void>;
  openProject(absolutePath: string): Promise<OpenProjectResult>;
  evalScript(source: string, timeoutMs: number): Promise<EvalResult>;
}
