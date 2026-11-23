/** Resolve the locale before the first paint and own the only startup deadline. */
(function (global) {
  "use strict";

  var STORAGE_KEY = "odp_locale";
  var BASE_LOCALE = "en";
  var ODP_LOCALES = [
    { code: "en", emoji: "🇬🇧", abbr: "EN", label: "English", switchLabel: "Language", readmeUrl: "https://github.com/object-digital-passport/specifications/blob/main/README.md" },
    { code: "ru", emoji: "🇷🇺", abbr: "RU", label: "Русский", switchLabel: "Язык", readmeUrl: "https://github.com/object-digital-passport/specifications/blob/main/README.ru.md" },
  ];

  function resolve() {
    var codes = ODP_LOCALES.map(function (entry) { return entry.code; });
    try {
      var saved = global.localStorage.getItem(STORAGE_KEY);
      if (codes.includes(saved)) return saved;
    } catch (_) {}
    var languages = global.navigator.languages || [global.navigator.language];
    for (var language of languages) {
      var tag = (language || "").toLowerCase();
      while (tag) {
        if (codes.includes(tag)) return tag;
        var separator = tag.lastIndexOf("-");
        tag = separator < 0 ? "" : tag.slice(0, separator);
      }
    }
    return BASE_LOCALE;
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

  function initial() {
    return expired ? BASE_LOCALE : preferred;
  }

  function populatePicker(select) {
    ODP_LOCALES.forEach(function (entry) {
      var option = global.document.createElement("option");
      option.value = entry.code;
      option.textContent = entry.emoji + " " + entry.abbr;
      option.title = entry.label;
      option.setAttribute("aria-label", entry.label);
      option.lang = entry.code;
      select.appendChild(option);
    });
  }

  function labelPicker(select, label) {
    select.setAttribute("aria-label", label);
    select.title = label;
  }

  async function loadPageCopy(locale, page) {
    var controller = new AbortController();
    var timeout = global.setTimeout(function () { controller.abort(); }, 2800);
    try {
      var url = new URL("localization/" + locale + "/" + page + ".json", global.location.href);
      url.searchParams.set("v", "1");
      var response = await global.fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      var dictionary = await response.json();
      if (!dictionary || typeof dictionary !== "object" || Array.isArray(dictionary)) return null;
      var translated = Object.fromEntries(Object.entries(dictionary).filter(function (pair) {
        return typeof pair[1] === "string" && pair[1].trim();
      }));
      return Object.keys(translated).length ? translated : null;
    } catch (_) {
      return null;
    } finally {
      global.clearTimeout(timeout);
    }
  }

  // English and Russian render synchronously. Additional locales reuse the
  // same first-paint deadline as the legacy pages.
  function mountPage(page, copy, initializeWorkflow) {
    var locale = BASE_LOCALE;
    var select = global.document.getElementById("language");
    var cards = global.document.querySelectorAll("main > .card");
    var selection = 0;
    cards.forEach(function (card) { card.inert = true; });
    populatePicker(select);

    function translate(key) {
      return copy[locale][key] || copy.en[key];
    }

    function render(code) {
      locale = copy[code] ? code : BASE_LOCALE;
      html.lang = locale;
      global.document.title = translate("title") + " — ODP 0.7";
      global.document.querySelectorAll("[data-copy]").forEach(function (element) {
        var value = translate(element.dataset.copy);
        if (value !== undefined) element.textContent = value;
      });
      select.value = code;
      var entry = ODP_LOCALES.find(function (item) { return item.code === locale; });
      labelPicker(select, entry.switchLabel || "Language");
      select.closest(".odp-lang-wrap").hidden = false;
    }

    var requested = initial();
    var ready;
    if (copy[requested]) {
      render(requested);
      reveal();
      ready = Promise.resolve();
    } else {
      ready = Promise.race([loadPageCopy(requested, page), deadline]).then(function (dictionary) {
        if (dictionary) copy[requested] = dictionary;
        render(requested);
        reveal();
      });
    }

    select.addEventListener("change", async function () {
      var code = select.value;
      var request = ++selection;
      if (!copy[code]) {
        var dictionary = await loadPageCopy(code, page);
        if (request !== selection) return;
        if (dictionary) copy[code] = dictionary;
      }
      save(code);
      render(code);
      select.dispatchEvent(new Event("odp:localechange"));
    });

    global.document.addEventListener("DOMContentLoaded", function () {
      ready.then(function () {
        initializeWorkflow({ translate: translate, getLocale: function () { return locale; } });
        cards.forEach(function (card) { card.inert = false; });
      });
    }, { once: true });
  }

  global.ODPLocale = {
    entries: ODP_LOCALES,
    initial: initial,
    save: save,
    reveal: reveal,
    deadline: deadline,
    populatePicker: populatePicker,
    labelPicker: labelPicker,
    mountPage: mountPage
  };
})(typeof window !== "undefined" ? window : globalThis);
