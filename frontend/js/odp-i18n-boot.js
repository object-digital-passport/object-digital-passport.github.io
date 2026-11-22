/** Resolve the locale before the first paint and own the only startup deadline. */
(function (global) {
  "use strict";

  var STORAGE_KEY = "odp_locale";
  var BASE_LOCALE = "en";
  var ODP_LOCALES = [
    { code: "en", emoji: "🇬🇧", abbr: "EN", label: "English", readmeUrl: "https://github.com/object-digital-passport/specifications/blob/main/README.md" },
    { code: "ru", emoji: "🇷🇺", abbr: "RU", label: "Русский", readmeUrl: "https://github.com/object-digital-passport/specifications/blob/main/README.ru.md" },
  ];

  function resolve(supported) {
    var codes = supported || ODP_LOCALES.map(function (entry) { return entry.code; });
    try {
      var saved = global.localStorage.getItem(STORAGE_KEY);
      if (codes.includes(saved)) return saved;
    } catch (_) {}
    var browser = (global.navigator.language || BASE_LOCALE).toLowerCase().split("-")[0];
    return codes.includes(browser) ? browser : BASE_LOCALE;
  }

  function save(locale) {
    try {
      global.localStorage.setItem(STORAGE_KEY, locale);
    } catch (_) {}
  }

  var html = global.document.documentElement;
  var preferred = resolve();
  var expired = false;
  var timer;
  if (preferred !== BASE_LOCALE) html.classList.add("odp-i18n-pending");

  function reveal() {
    global.clearTimeout(timer);
    html.classList.remove("odp-i18n-pending");
  }

  var deadline = new Promise(function (finish) {
    timer = global.setTimeout(function () {
      expired = true;
      reveal();
      finish();
    }, 2800);
  });

  function initial(supported) {
    if (expired || (supported && !supported.includes(preferred))) return BASE_LOCALE;
    return preferred;
  }

  // ODP 0.7 has its dictionaries in the page script, so it can translate the
  // static interface before deferred wallet and registry dependencies run.
  function mountPage(copy, initializeWorkflow) {
    var locale = initial(Object.keys(copy));
    var button = global.document.getElementById("language");

    function translate(key) {
      return copy[locale][key] || copy.en[key];
    }

    function render() {
      html.lang = locale;
      global.document.title = translate("title") + " — ODP 0.7";
      global.document.querySelectorAll("[data-copy]").forEach(function (element) {
        var value = translate(element.dataset.copy);
        if (value !== undefined) element.textContent = value;
      });
      button.textContent = locale === BASE_LOCALE ? "RU" : "EN";
      button.setAttribute("aria-label", button.textContent + " — " + translate("switch"));
    }

    button.addEventListener("click", function () {
      locale = locale === BASE_LOCALE ? "ru" : BASE_LOCALE;
      save(locale);
      render();
    });
    render();
    button.hidden = false;
    reveal();
    var cards = global.document.querySelectorAll("main > .card");
    cards.forEach(function (card) { card.inert = true; });
    global.document.addEventListener("DOMContentLoaded", function () {
      initializeWorkflow({ translate: translate, getLocale: function () { return locale; } });
      cards.forEach(function (card) { card.inert = false; });
    }, { once: true });
  }

  global.ODPLocale = {
    entries: ODP_LOCALES,
    initial: initial,
    save: save,
    reveal: reveal,
    deadline: deadline,
    mountPage: mountPage
  };
})(typeof window !== "undefined" ? window : globalThis);
