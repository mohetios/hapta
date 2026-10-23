<template>
  <div class="modal fade" id="aiModal" tabindex="-1" aria-labelledby="aiModalTitle" aria-hidden="true" ref="modal">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="aiModalTitle"><i class="bi-stars me-2"></i>{{ $t("ai.title") }}</h5>
          <i class="bi-x close-modal" data-bs-dismiss="modal"></i>
        </div>
        <div class="modal-body">
          <div v-if="agents.list === null" class="text-muted py-4 text-center">
            <span class="spinner-border spinner-border-sm me-2"></span>{{ $t("ai.detecting") }}
          </div>

          <div v-else-if="!agent" class="py-3">
            <p>{{ $t("ai.noAgents") }}</p>
            <button type="button" class="btn border py-1 px-3" @click="openSettings">
              <i class="bi-gear me-1"></i>{{ $t("ai.openSettings") }}
            </button>
          </div>

          <template v-else>
            <div class="small text-muted mb-2">
              {{ $t("ai.using", [usingLabel]) }} ·
              <a href="#" @click.prevent="openSettings">{{ $t("ai.change") }}</a>
            </div>

            <div class="d-flex flex-wrap gap-2 mb-2">
              <button v-for="s in suggestions" :key="s" type="button" class="btn btn-sm suggestion" :disabled="running"
                @click="prompt = $t(`ai.${s}Prompt`)">
                {{ $t(`ai.${s}`) }}
              </button>
            </div>

            <textarea v-model="prompt" class="form-control mb-2" rows="3" :placeholder="$t('ai.placeholder')"
              :disabled="running" @keydown.ctrl.enter="run" @keydown.meta.enter="run"></textarea>

            <div class="d-flex align-items-center gap-2">
              <button v-if="!running" type="button" class="btn btn-primary py-1 px-3" :disabled="!prompt.trim()"
                @click="run">
                <i class="bi-send me-1"></i>{{ $t("ai.send") }}
              </button>
              <button v-else type="button" class="btn border py-1 px-3" @click="cancel">
                <i class="bi-stop-circle me-1"></i>{{ $t("ai.stop") }}
              </button>
              <small v-if="running" class="text-muted text-truncate">
                <span class="spinner-border spinner-border-sm me-1"></span>{{ $t("ai.working") }} {{ elapsed }}s
                <bdi v-if="lastLine"> · {{ lastLine }}</bdi>
              </small>
              <small v-else class="text-muted">{{ $t("ai.hint") }}</small>
            </div>

            <div v-if="error" class="alert alert-danger mt-3 mb-0 small">
              <div>{{ $t("ai.failed") }}</div>
              <pre class="mb-0 mt-1">{{ error }}</pre>
            </div>
            <div v-else-if="answer" class="answer mt-3" v-html="md.render(answer)"></div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import MarkdownIt from "markdown-it";
import markdownTargetBlankLinks from "../helpers/markdownTargetBlankLinks";
import desktop from "../helpers/desktop";
import dataStore from "../repositories/dataStore";
import { systemPrompt } from "../helpers/aiPrompt";
import { agentsState, aiSettings, ensureDetected } from "../helpers/agents";
import { Modal } from "bootstrap";

export default {
  name: "aiModal",
  data() {
    return {
      agents: agentsState,
      prompt: "",
      running: false,
      started: 0,
      elapsed: 0,
      lastLine: "",
      answer: "",
      error: "",
      suggestions: ["planWeek", "moveUnfinished", "summary", "habit", "focus"],
      md: new MarkdownIt({ linkify: true }),
    };
  },
  mounted() {
    markdownTargetBlankLinks.renderBlankLinks(this.md);
    // Detected when first opened, so startup doesn't wait on the CLIs
    this.$refs.modal.addEventListener("show.bs.modal", () => ensureDetected(this.$store));
  },
  computed: {
    // Chosen in Settings > AI
    settings() {
      return aiSettings(this.$store);
    },
    agent() {
      return this.agents.list?.find((a) => a.id === this.settings.agent);
    },
    usingLabel() {
      const model = this.agent.models.find((m) => m.id === this.settings.models[this.agent.id]);
      return model ? `${this.agent.name} · ${model.label}` : this.agent.name;
    },
  },
  methods: {
    openSettings() {
      Modal.getOrCreateInstance(this.$refs.modal).hide();
      Modal.getOrCreateInstance(document.getElementById("configModal")).show();
      document.getElementById("config-ai-tab").click();
    },
    async run() {
      const prompt = this.prompt.trim();
      if (!prompt || this.running) return;
      this.running = true;
      this.answer = "";
      this.error = "";
      this.lastLine = "";
      this.started = Date.now();
      this.elapsed = 0;
      const timer = setInterval(() => (this.elapsed = Math.round((Date.now() - this.started) / 1000)), 1000);
      const unlisten = await desktop.onAgentOutput((line) => {
        if (line.trim()) this.lastLine = line.trim().slice(0, 120);
      });
      try {
        // The agent reads the files, so they must hold every change made so far
        await dataStore.flush();
        this.answer = await desktop.runAgent({
          agent: this.settings.agent,
          model: this.settings.models[this.settings.agent] || null,
          effort: this.settings.effort || null,
          system: systemPrompt(this.$store.getters.config),
          prompt,
        });
        this.prompt = "";
      } catch (e) {
        this.error = String(e) || this.$t("ai.stopped");
      } finally {
        clearInterval(timer);
        unlisten();
        this.running = false;
      }
    },
    cancel() {
      desktop.cancelAgent();
    },
  },
};
</script>

<style scoped lang="scss">
.suggestion {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 1rem;
  font-size: 0.8rem;

  .dark-theme & {
    border-color: rgba(255, 255, 255, 0.15);
    color: inherit;
  }
}

.answer {
  max-height: 40vh;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background-color: rgba(0, 0, 0, 0.03);

  .dark-theme & {
    background-color: rgba(255, 255, 255, 0.05);
  }

  :deep(p:last-child) {
    margin-bottom: 0;
  }
}

pre {
  white-space: pre-wrap;
  font-size: 0.75rem;
}
</style>
