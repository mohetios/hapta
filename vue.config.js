module.exports = {
  pluginOptions: {
    electronBuilder: {
      nodeIntegration: true,
      customFileProtocol: './',
      builderOptions: {
        appId: "com.mohetios.hapta",
        productName: "Hapta",
        publish: ["github"],
        linux: {
          category: "Utility",
          description: "Minimalist weekly planner with Jalali (Persian) calendar and RTL support.",
          target: ["deb", "rpm", "pacman","AppImage"],
          icon: "build/icon.icns",
        },
        win: {
          target: ["nsis"],
        },
        mac: {
          category: "public.app-category.productivity",
          target: ["dmg", "pkg"],
        },
      },
    },
  }
};
