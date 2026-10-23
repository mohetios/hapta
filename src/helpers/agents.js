// The installed AI agent CLIs (Claude Code, Codex) and the choice made in Settings > AI.
// Detected on first use, so startup never waits on the CLIs.
import { reactive } from "vue";
import desktop from "./desktop";
import configRepository from "../repositories/configRepository";

export const agentsState = reactive({ list: null, detecting: false }); // list: null until detected

// { agent, models: { [agent]: model }, effort }; "" means the CLI's own default
export const aiSettings = (store) => ({ agent: "", models: {}, effort: "", ...store.getters.config.ai });

export function saveAiSettings(store, patch) {
  store.commit("updateConfig", { key: "ai", val: { ...aiSettings(store), ...patch } });
  configRepository.update(store.getters.config);
}

export async function detectAgents(store) {
  agentsState.detecting = true;
  agentsState.list = await desktop.detectAgents().catch(() => []);
  agentsState.detecting = false;
  // Keep the saved choice while it is installed, else take the first one found
  const { agent } = aiSettings(store);
  if (agentsState.list.length && !agentsState.list.some((a) => a.id === agent)) {
    saveAiSettings(store, { agent: agentsState.list[0].id });
  }
}

export const ensureDetected = (store) => (agentsState.list === null && !agentsState.detecting ? detectAgents(store) : null);
