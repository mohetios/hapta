<template>
  <comfirm-modal :id="'clearDataModal'" :title="$t('settings.clearData')" :text="$t('settings.clearDataDetails')"
    :ico="'bi-x-circle'" :okText="$t('settings.clearData')" @on-ok="clearData">
  </comfirm-modal>
</template>
<script>
import comfirmModal from "../../components/comfirmModal.vue";
import exportTool from "../../helpers/exportTool";
import desktop from "../../helpers/desktop";

export default {
  name: "clearDataModal",
  components: {
    comfirmModal
  },
  methods: {
    clearData: function () {
      if (desktop.isDesktop()) {
        desktop.setTrayContextMenuLabel({ open: 'Open', quit: 'Quit' });
        desktop.setDarkTrayIcon(false);
      }
      exportTool.clear();
    },
  },
};
</script>