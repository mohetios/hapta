import repeatingEventRepository from "../../repositories/repeatingEventRepository";
import repeatingEventByDateRepository from "../../repositories/repeatingEventByDateRepository";

const state = {
  repeatingEventList: {},
  repeatingEventByDate: {},
};

const getters = {
  repeatingEventList(state) {
    return state.repeatingEventList;
  },
  repeatingEventByDate(state) {
    return state.repeatingEventByDate;
  },
};

const mutations = {
  loadRepeatingEvent(state, repeatingEvent) {
    state.repeatingEventList[repeatingEvent.id] = repeatingEvent;
  },
  updateRepeatingEvent(state, obj) {
    state.repeatingEventList[obj.key] = obj.val;
  },
  removeRepeatingEvent(state, id) {
    delete state.repeatingEventList[id];
  },
  loadRepeatingEventList(state, repeatingEventList) {
    state.repeatingEventList = repeatingEventList;
  },
  loadRepeatingEventGeneratedByDate(state, obj) {
    state.repeatingEventByDate[obj.key] = obj.val ? obj.val : {};
  },
};

const actions = {
  loadRepeatingEvent({ commit }, repeatingEventId) {
    commit("loadRepeatingEvent", repeatingEventRepository.get(repeatingEventId));
  },
  loadAllRepeatingEvent({ commit }) {
    commit("loadRepeatingEventList", repeatingEventRepository.all());
    return Promise.resolve();
  },
  loadRepeatingEventGeneratedByDate({ commit }, date) {
    commit("loadRepeatingEventGeneratedByDate", { key: date, val: repeatingEventByDateRepository.get(date) });
    return Promise.resolve();
  },
};

export default {
  namespaced: false,
  state,
  getters,
  actions,
  mutations,
};
