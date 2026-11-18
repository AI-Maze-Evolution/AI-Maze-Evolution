import type {
  BuilderMode,
  HealthStatus,
  RequestedEngineMode,
  SimulationState,
} from "../types/simulation";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as { detail?: string };
      if (errBody.detail) detail = errBody.detail;
    } catch {
      // ignore json parse failure
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export const simulationApi = {
  getHealth(): Promise<HealthStatus> {
    return requestJson<HealthStatus>("/api/health");
  },

  getState(): Promise<SimulationState> {
    return requestJson<SimulationState>("/api/simulation/state");
  },

  start(params?: {
    speed?: number;
    builder_mode?: BuilderMode;
    seed?: number;
  }): Promise<SimulationState> {
    return requestJson<SimulationState>("/api/simulation/start", {
      method: "POST",
      body: JSON.stringify(params ?? {}),
    });
  },

  pause(): Promise<SimulationState> {
    return requestJson<SimulationState>("/api/simulation/pause", {
      method: "POST",
    });
  },

  resume(): Promise<SimulationState> {
    return requestJson<SimulationState>("/api/simulation/resume", {
      method: "POST",
    });
  },

  step(): Promise<SimulationState> {
    return requestJson<SimulationState>("/api/simulation/step", {
      method: "POST",
    });
  },

  reset(params?: {
    builder_mode?: BuilderMode;
    seed?: number;
    mode?: RequestedEngineMode;
  }): Promise<SimulationState> {
    return requestJson<SimulationState>("/api/simulation/reset", {
      method: "POST",
      body: JSON.stringify(params ?? {}),
    });
  },

  setSpeed(speed: number): Promise<SimulationState> {
    return requestJson<SimulationState>("/api/simulation/speed", {
      method: "POST",
      body: JSON.stringify({ speed }),
    });
  },
};
