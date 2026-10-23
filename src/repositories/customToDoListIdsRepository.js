import storageRepository from "./storageRepository";
import dataFolder from "../helpers/dataFolder";

export default {
    load() {
        let customToDoList = storageRepository.get('customTodoListIds');
        if (customToDoList) {
            return customToDoList;
        } else {
            storageRepository.set('customTodoListIds', []);
            return [];
        }
    },
    update(customToDoList) {
        storageRepository.set('customTodoListIds', customToDoList);
        dataFolder.scheduleSave();
    }
};