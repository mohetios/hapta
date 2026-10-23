<template>
  <div class="modal fade" id="aboutModal" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ $t("about.about") }}</h5>
          <i class="bi-x close-modal" data-bs-dismiss="modal"></i>
        </div>
        <div class="modal-body">
          <div class="d-flex flex-column" style="text-align: center; margin-top: 10px">
            <img
              class="logo align-self-center"
              src="/img/mark-color.png"
              alt="Hapta"
              title="Hapta Logo"
              width="200"
            />
            <img
              class="logo logo-white align-self-center"
              src="/img/mark-white.png"
              alt="Hapta"
              title="Hapta Logo"
              width="200"
            />
            <!-- <h5 style="margin-top: 15px; margin-bottom: 2px;">Hapta</h5> -->
            <span class="mt-3" style="font-size: 0.75rem"
              >{{ $t("about.version") }} {{ version }} •
              <a
                href="https://github.com/mohetios/hapta/releases"
                target="_blank"
                style="font-size: 0.75rem; cursor: pointer; opacity: 0.7; text-decoration: none"
              >
                {{ $t("ui.changeLog") }}
              </a>
            </span>
            <div class="d-flex align-self-center mt-3">
              <a href="https://github.com/mohetios/hapta" target="_blank" :title="$t('about.sourceCode')">
                <i class="bi-github mx-2"></i
              ></a>
              <a href="mailto:mehot1@gmail.com"> <i class="bi-envelope mx-2" :title="$t('about.email')"></i></a>
            </div>
          </div>
          <div class="horizontal-divider mt-3 mb-3"></div>
          <div class="text-center">
            <a href="https://github.com/mohetios" target="_blank" style="text-decoration: none">
              <h6 class="mb-1">{{ $t("about.devName") }}</h6>
              <div style="font-size: 0.7rem; opacity: 0.7">{{ $t("about.dev") }}</div>
            </a>
            <div class="mt-3" style="font-size: 0.7rem; opacity: 0.7">
              <a href="https://github.com/manuelernestog/weektodo" target="_blank">{{ $t("about.basedOn") }}</a>
            </div>
          </div>
          <div class="horizontal-divider mt-3 mb-2"></div>
          <div
            class="text-center px-2 d-flex justify-content-center flex-wrap"
            style="font-size: 0.75rem; opacity: 0.8; line-height: 20px"
          >
            <span class="mx-2">© 2026 mohetios</span>
            <a class="mx-2" style="text-decoration: none" href="https://github.com/mohetios/hapta/blob/main/LICENSE" target="_blank">
              {{ $t("about.license") }}: GPL-3.0
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { version } from "../../package.json";

export default {
  name: "aboutModal",
  data() {
    return {
      version: version,
    };
  },
};
</script>

<style scoped>
.modal-dialog {
  max-width: 360px;
}

a,
a:hover {
  color: unset;
}

.visit-site {
  cursor: pointer;
}
</style>

<style>
.logo-white {
  display: none;
}

.dark-theme {
  .modal-dialog .logo {
    display: none;
  }
  .modal-dialog .logo-white {
    display: block;
    opacity: 0.95;
  }
}
</style>
