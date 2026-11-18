import { useCallback, useEffect, useRef, useState } from "react";
import { simulationApi } from "../services/api";
import { SimulationWebSocketClient } from "../services/websocket";
import type {
  BuilderMode,
  ConnectionStatus,
  RequestedEngineMode,
  ServerMessage,
  SimulationState,
} from "../types/simulation";

const INITIAL_GRID_5X5 = [
  [0, 0, 0, 0, 0],
  [0, 1, 0, 1, 0],
  [0, 0, 0, 0, 0],
  [0, 1, 0, 1, 0],
  [0, 0, 0, 0, 0],
];

const EMPTY_STATE: SimulationState = {
  status: "idle",
  builder_mode: "sarsa",
  seed: 42,
  round: 0,
  era: 1,
  size: 5,
  start: [0, 0],
  goal: [4, 4],
  grid: INITIAL_GRID_5X5,
  finished: false,
  last_result: null,
  history: [],
  mode: "DEMO",
  engine_available: false,
  speed: 1.5,
  era_sizes: [5, 7, 10],
  prev_grid: null,
  edit_history: [],
  era_transitions: [],
  error: null,
};

export function useSimulationSocket() {
  const [state, setState] = useState<SimulationState>(EMPTY_STATE);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clientRef = useRef<SimulationWebSocketClient | null>(null);

  const handleServerMessage = useCallback((message: ServerMessage) => {
    if (message.type === "state_snapshot") {
      setState(message.data);
      setActionError(null);
      return;
    }

    if (message.type === "round_update") {
      const payload = message.data;
      setState((prev) => {
        const alreadyRecorded = prev.history.some((h) => h.round === payload.history_item.round);
        return {
          ...prev,
          mode: payload.mode,
          status: payload.status,
          round: payload.result.round,
          era: payload.next_era,
          size: payload.next_size,
          start: payload.next_start,
          goal: payload.next_goal,
          grid: payload.next_grid,
          finished: payload.finished,
          prev_grid: payload.prev_grid,
          last_result: payload.result,
          history: alreadyRecorded ? prev.history : [...prev.history, payload.history_item],
          edit_history: alreadyRecorded ? prev.edit_history : [...prev.edit_history, payload.edit_record],
          era_transitions: payload.era_transitions,
          error: null,
        };
      });
      return;
    }

    if (message.type === "status_change") {
      const payload = message.data;
      setState((prev) => ({
        ...prev,
        mode: payload.mode,
        status: payload.status,
        builder_mode: payload.builder_mode,
        seed: payload.seed,
        speed: payload.speed,
        round: payload.round,
        era: payload.era,
        size: payload.size,
        finished: payload.finished,
        error: payload.error,
      }));
      return;
    }

    if (message.type === "error") {
      setActionError(message.message);
      setState((prev) => ({ ...prev, status: "error", error: message.message }));
    }
  }, []);

  useEffect(() => {
    let active = true;

    simulationApi
      .getState()
      .then((snapshot) => {
        if (active) setState(snapshot);
      })
      .catch(() => {
        // WebSocket reconnect loop handles connection state
      });

    const client = new SimulationWebSocketClient({
      onMessage: handleServerMessage,
      onStatusChange: setConnectionStatus,
    });
    clientRef.current = client;
    client.connect();

    return () => {
      active = false;
      client.disconnect();
      clientRef.current = null;
    };
  }, [handleServerMessage]);

  const runAction = useCallback(async (fn: () => Promise<SimulationState>) => {
    setBusy(true);
    setActionError(null);
    try {
      const next = await fn();
      setState(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "API request failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const start = useCallback(
    (speed?: number, builderMode?: BuilderMode, seed?: number) =>
      runAction(() => simulationApi.start({ speed, builder_mode: builderMode, seed })),
    [runAction],
  );

  const pause = useCallback(() => runAction(() => simulationApi.pause()), [runAction]);
  const resume = useCallback(() => runAction(() => simulationApi.resume()), [runAction]);
  const step = useCallback(() => runAction(() => simulationApi.step()), [runAction]);

  const reset = useCallback(
    (builderMode?: BuilderMode, seed?: number, mode?: RequestedEngineMode) =>
      runAction(() => simulationApi.reset({ builder_mode: builderMode, seed, mode })),
    [runAction],
  );

  const setSpeed = useCallback(async (speed: number) => {
    setState((prev) => ({ ...prev, speed }));
    try {
      const next = await simulationApi.setSpeed(speed);
      setState(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update speed");
    }
  }, []);

  return {
    state,
    connectionStatus,
    actionError,
    busy,
    actions: {
      start,
      pause,
      resume,
      step,
      reset,
      setSpeed,
    },
  };
}
