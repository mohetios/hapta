import storageRepository from "../repositories/storageRepository";
import dataStore from "../repositories/dataStore";
import { filesFromBackup, backupFromFiles } from "../repositories/plannerFiles";
import { Toast, Modal } from "bootstrap";
import migrations from "../migrations/migrations";
import desktop from "./desktop";

// .wtdb backups keep the old layout, so backups from any version import:
// { config: "<json>", customTodoListIds: "<json>", todoLists, repeating_events, repeating_events_by_date }
export default {
  export() {
    const { customTodoListIds, ...data } = backupFromFiles();
    const backup = {
      config: JSON.stringify(storageRepository.get("config")),
      customTodoListIds: JSON.stringify(customTodoListIds),
      ...data,
    };
    createExportLink("HaptaBackup.wtdb", JSON.stringify(backup));
  },
  import(event) {
    let fr = readFile(event.target.files);
    fr.onload = function () {
      var toast = new Toast(document.getElementById("invalidFile"));
      try {
        var data = JSON.parse(fr.result);
        if ("config" in data) {
          importData(data);
          migrations.migrate();
        } else {
          toast.show();
        }
      } catch {
        toast.show();
      }
    };
  },
  // Deletes all planner data in the data folder and the settings
  clear() {
    storageRepository.clean();
    const configCleared = desktop.isDesktop() ? desktop.clearConfig() : null;
    Promise.all([dataStore.replaceAll(filesFromBackup({})), configCleared]).finally(() => location.reload());
  },
};

function createExportLink(filename, fileBody) {
  var element = document.createElement("a");
  element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(fileBody));
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  setTimeout(function () {
    let exportingModal = Modal.getInstance(document.getElementById("exportingModal"));
    exportingModal.hide();
  }, 1000);
}

function readFile(files) {
  const fileList = files;
  var fr = null;
  if (fileList[0]) {
    fr = new FileReader();
    fr.readAsText(fileList[0]);
  }
  return fr;
}

function importData(data) {
  // Built first: a malformed backup throws before anything is replaced
  const files = filesFromBackup(data);
  const config = JSON.parse(data.config);
  config.importing = true;
  storageRepository.clean();
  storageRepository.set("config", config);
  dataStore.replaceAll(files).then(() => location.reload());
}
