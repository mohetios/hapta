import repeatingEventHelper from "../../helpers/repeatingEvents";

const state = {
  repeatingEventDateCache: {},
};

const getters = {
  repeatingEventDateCache(state) {
    return state.repeatingEventDateCache;
  },
};

const mutations = {
  resetRepeatingEventDateCache(state) {
    state.repeatingEventDateCache = {};
  },
  loadRepeatingEventDateCache(state, repeatingEventList) {
    var today = new Date();
    var future_date = new Date();

    future_date.setFullYear(today.getFullYear() + 10);
    for (const [id, re] of Object.entries(repeatingEventList)) {
      repeatingEventHelper.occurrenceIds(re, today, future_date).forEach((date) => {
        if (state.repeatingEventDateCache[date]) {
          state.repeatingEventDateCache[date].push(id);
        } else {
          state.repeatingEventDateCache[date] = [id];
        }
      });
    }
  },
  addRepeatingEventToDateCache(state, re) {
    var today = new Date();
    var future_date = new Date();
    future_date.setFullYear(today.getFullYear() + 10);
    repeatingEventHelper.occurrenceIds(re, today, future_date).forEach((date) => {
      if (state.repeatingEventDateCache[date]) {
        state.repeatingEventDateCache[date].push(re.id);
      } else {
        state.repeatingEventDateCache[date] = [re.id];
      }
    });
  },
};

export default {
  namespaced: false,
  state,
  getters,
  mutations,
};
