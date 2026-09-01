/**
 * ODP UI i18n — loads JSON from frontend/localization/<lang>/*.json (deployed as /localization/ on GitHub Pages).
 *
 * Adding a language:
 *   1. create frontend/localization/<code>/ with common.json and one file per page,
 *   2. add one entry to ODP_LOCALES below.
 * Nothing else in this file knows a language by name. English is the base set: the selected
 * locale is merged over it, so a missing key — or a missing file — falls back to English rather
 * than rendering blank, which is what makes a partial translation usable.
 *
 * localStorage odp_locale holds the last explicit choice.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "odp_locale";
  var BASE_LOCALE = "en";
  var ODP_LOCALES = [
    { code: "en", emoji: "🇬🇧", abbr: "EN", label: "English", readmeUrl: "https://github.com/object-digital-passport/specifications/blob/main/README.md" },
    { code: "ru", emoji: "🇷🇺", abbr: "RU", label: "Русский", readmeUrl: "https://github.com/object-digital-passport/specifications/blob/main/README.ru.md" },
  ];

  function odpLocaleEntry(code) {
    for (var i = 0; i < ODP_LOCALES.length; i++) {
      if (ODP_LOCALES[i].code === code) return ODP_LOCALES[i];
    }
    return null;
  }

  var _locale = "en";
  var _merged = {};

  function deepMerge(target, source) {
    if (!source) return target || {};
    var out = {};
    var k;
    for (k in target) out[k] = target[k];
    for (k in source) {
      if (
        source[k] &&
        typeof source[k] === "object" &&
        !Array.isArray(source[k]) &&
        out[k] &&
        typeof out[k] === "object" &&
        !Array.isArray(out[k])
      ) {
        out[k] = deepMerge(out[k], source[k]);
      } else if (source[k] !== undefined && source[k] !== null && source[k] !== "") {
        out[k] = source[k];
      }
    }
    return out;
  }

  /** Prefer last explicit choice (localStorage), then browser language. */
  function odpResolveLocale() {
    try {
      var s = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (s && odpLocaleEntry(s)) return s;
    } catch (e0) {}
    var nav = (global.navigator && global.navigator.language) || BASE_LOCALE;
    nav = String(nav).toLowerCase();
    for (var i = 0; i < ODP_LOCALES.length; i++) {
      if (nav.split("-")[0] === ODP_LOCALES[i].code) return ODP_LOCALES[i].code;
    }
    return BASE_LOCALE;
  }

  /** Clears flash-guard from odp-i18n-boot.js (RU) or no-ops if not pending. */
  function revealI18nUi() {
    try {
      var el = global.document && global.document.documentElement;
      if (!el) return;
      el.classList.remove("odp-i18n-pending");
      el.classList.add("odp-i18n-ready");
    } catch (eR) {}
  }

  global.odpRevealI18nUi = revealI18nUi;

  /** Safari / in-app browser: restore from MetaMask can leave i18n wedged; always unhide chrome. */
  try {
    if (global.addEventListener) {
      global.addEventListener(
        "pageshow",
        function () {
          revealI18nUi();
        },
        false
      );
      global.addEventListener("visibilitychange", function () {
        try {
          if (global.document && !global.document.hidden) revealI18nUi();
        } catch (eV) {}
      });
    }
  } catch (eEv) {}

  function t(key) {
    var parts = String(key).split(".");
    var cur = _merged;
    for (var i = 0; i < parts.length; i++) {
      cur = cur && cur[parts[i]];
    }
    return typeof cur === "string" ? cur : key;
  }

  function odpApplyDataI18n(root) {
    var doc = root || global.document;
    if (!doc || !doc.querySelectorAll) return;
    doc.querySelectorAll("[data-i18n]").forEach(function (el) {
      var k = el.getAttribute("data-i18n");
      if (!k) return;
      var v = t(k);
      if (v !== k) el.textContent = v;
    });
    doc.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-title");
      if (!k) return;
      var v = t(k);
      if (v !== k) el.setAttribute("title", v);
    });
    doc.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-placeholder");
      if (!k) return;
      var v = t(k);
      if (v !== k) el.setAttribute("placeholder", v);
    });
    doc.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var k = el.getAttribute("data-i18n-aria");
      if (!k) return;
      var v = t(k);
      if (v !== k) el.setAttribute("aria-label", v);
    });
  }

  function odpSetLocale(code) {
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, code);
    } catch (e1) {}
    global.location.reload();
  }

  function odpRenderLangSwitch(containerId) {
    var el = global.document && global.document.getElementById(containerId);
    if (!el) return;
    var loc = _locale;
    el.innerHTML = "";
    el.className = (el.className ? el.className + " " : "") + "odp-lang-switch";
    var wrap = global.document.createElement("div");
    wrap.className = "odp-lang-wrap";
    var sel = global.document.createElement("select");
    sel.className = "odp-lang-select";
    sel.id = "odpLangSelect";
    sel.setAttribute("aria-label", t("lang.switchLabel"));
    sel.setAttribute("title", t("lang.switchLabel"));
    ODP_LOCALES.forEach(function (L) {
      var opt = global.document.createElement("option");
      opt.value = L.code;
      opt.textContent = L.emoji + " " + L.abbr;
      opt.setAttribute("title", L.label);
      if (L.code === loc) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () {
      var v = sel.value;
      if (v && v !== loc) odpSetLocale(v);
    });
    wrap.appendChild(sel);
    el.appendChild(wrap);
  }

  function odpReadmeUrlForLocale(locale) {
    var entry = odpLocaleEntry(locale);
    if (entry && entry.readmeUrl) return entry.readmeUrl;
    return odpLocaleEntry(BASE_LOCALE).readmeUrl;
  }

  function odpApplyReadmeLinks(root) {
    var doc = root || global.document;
    if (!doc || !doc.querySelectorAll) return;
    var href = odpReadmeUrlForLocale(_locale);
    doc.querySelectorAll("[data-readme-link]").forEach(function (el) {
      el.setAttribute("href", href);
    });
  }

  /** Registry banner HTML (replaces odpRegistryMisconfiguredBannerHtml when i18n loaded). */
  function odpRegistryBannerHtml(isLocal) {
    if (isLocal) {
      return '<div class="info neutral" style="line-height:1.55">' + t("registry.hintLocal") + "</div>";
    }
    return (
      '<div class="info neutral" style="line-height:1.55">' +
      t("registry.hintProduction") +
      ' <a href="' +
      odpReadmeUrlForLocale(_locale) +
      '" target="_blank" rel="noopener noreferrer" data-readme-link>' +
      t("registry.readmeLink") +
      "</a></div>"
    );
  }

  /**
   * @param {{ page: string, pageTitleKey?: string, mergePages?: string[] }} opts
   * page: creator | passport | verify | index
   * mergePages: extra locale JSON filenames without path, e.g. ["passport"] → en/passport.json
   */
  function odpInitI18n(opts) {
    opts = opts || {};
    var page = opts.page || "index";
    _locale = odpResolveLocale();
    if (_locale !== BASE_LOCALE && global.document && global.document.documentElement) {
      global.document.documentElement.classList.add("odp-i18n-pending");
    }

    if (typeof global.location === "undefined" || !global.location.href) {
      _merged = {};
      global.odpT = t;
      global.odpGetLocale = function () {
        return _locale;
      };
      global.odpRegistryBannerHtml = odpRegistryBannerHtml;
      revealI18nUi();
      return Promise.resolve();
    }

    var i18nPath = "localization/";
    var base = new URL(i18nPath, global.location.href);
    var firstCommonUrl = new URL("en/common.json", base).toString();
    var i18nRevealSafety = global.setTimeout(function () {
      revealI18nUi();
    }, 4000);

    function getI18nVersion() {
      if (global && typeof global.ODP_I18N_VERSION === "string" && global.ODP_I18N_VERSION) {
        return global.ODP_I18N_VERSION;
      }
      return "20260523";
    }

    function versionedI18nUrl(url) {
      var u = new URL(url, global.location && global.location.href ? global.location.href : undefined);
      u.searchParams.set("v", getI18nVersion());
      return u.toString();
    }

    return global
      .fetch(versionedI18nUrl(firstCommonUrl), { cache: "default" })
      .then(function (r) {
        if (!r.ok) throw new Error("i18n fetch failed: " + r.status);
        return r.json();
      })
      .then(function (enCommon) {
        return global
          .fetch(versionedI18nUrl(new URL("en/" + page + ".json", base).toString()), { cache: "default" })
          .then(function (r) {
            if (!r.ok) throw new Error("i18n page fetch failed: " + r.status);
            return r.json();
          })
          .then(function (enPage) {
            var acc = deepMerge(enCommon, enPage);
            var mergeNames = opts.mergePages || [];
            var ei = 0;
            function mergeNextEn(a) {
              if (ei >= mergeNames.length) return Promise.resolve(a);
              var name = mergeNames[ei++];
              return global
                .fetch(versionedI18nUrl(new URL("en/" + name + ".json", base).toString()), { cache: "default" })
                .then(function (r) {
                  if (!r.ok) throw new Error("i18n merge en/" + name + " failed: " + r.status);
                  return r.json();
                })
                .then(function (j) {
                  return mergeNextEn(deepMerge(a, j));
                });
            }
            return mergeNextEn(acc);
          });
      })
      .then(function (enAll) {
        if (_locale === "en") {
          _merged = enAll;
          return Promise.resolve();
        }
        // Every file of the selected locale is optional. A 404 or a parse error yields an empty
        // object, so the English set below shows through — the same fallback a missing key gets,
        // extended to a missing file. Without it, one absent page file would blank the whole UI
        // for anyone adding a language incrementally.
        function localeFile(name) {
          return global
            .fetch(versionedI18nUrl(new URL(_locale + "/" + name + ".json", base).toString()), { cache: "default" })
            .then(function (r) {
              if (!r.ok) throw new Error(_locale + "/" + name + ".json: " + r.status);
              return r.json();
            })
            .catch(function (err) {
              console.warn("[ODP i18n] falling back to English for " + _locale + "/" + name + ".json", err);
              return {};
            });
        }

        var names = ["common", page].concat(opts.mergePages || []);
        var i = 0;
        function mergeNextLocale(acc) {
          if (i >= names.length) return Promise.resolve(acc);
          return localeFile(names[i++]).then(function (j) {
            return mergeNextLocale(deepMerge(acc, j));
          });
        }
        return mergeNextLocale({}).then(function (locAll) {
          _merged = deepMerge(enAll, locAll);
        });
      })
      .then(function () {
        global.document.documentElement.lang = _locale;
        global.odpT = t;
        global.odpGetLocale = function () {
          return _locale;
        };
        global.odpRegistryBannerHtml = odpRegistryBannerHtml;
        global.odpApplyDataI18n = odpApplyDataI18n;
        global.odpRenderLangSwitch = odpRenderLangSwitch;
        global.odpSetLocale = odpSetLocale;
        global.odpRegistryMisconfiguredBannerHtml = function (isLocal) {
          return odpRegistryBannerHtml(isLocal);
        };
        if (opts.pageTitleKey) {
          try {
            global.document.title = t(opts.pageTitleKey);
          } catch (e2) {}
        }
        odpRenderLangSwitch("odpLangSwitch");
        if (typeof global.odpRenderThemeSwitch === "function") global.odpRenderThemeSwitch("odpThemeSwitch");
        odpApplyDataI18n(global.document.body);
        odpApplyReadmeLinks(global.document.body);
      })
      .catch(function (err) {
        console.warn("[ODP i18n] init failed — language switch uses fallback labels", err);
        _merged = {
          lang: { switchLabel: "Language" },
          theme: {
            switchAria: "Switch color theme",
            switchTitle: "Current theme: {name}",
            nameBlue: "Light (blue)",
            nameDark: "Dark",
          },
        };
        global.odpT = t;
        global.odpGetLocale = function () {
          return _locale;
        };
        global.odpApplyDataI18n = odpApplyDataI18n;
        global.odpRenderLangSwitch = odpRenderLangSwitch;
        global.odpSetLocale = odpSetLocale;
        try {
          if (global.document && global.document.documentElement) {
            global.document.documentElement.lang = _locale;
          }
        } catch (eLang) {}
        try {
          odpRenderLangSwitch("odpLangSwitch");
          if (typeof global.odpRenderThemeSwitch === "function") global.odpRenderThemeSwitch("odpThemeSwitch");
        } catch (eSw) {}
      })
      .finally(function () {
        try {
          global.clearTimeout(i18nRevealSafety);
        } catch (eCt) {}
        revealI18nUi();
      });
  }

  global.odpInitI18n = odpInitI18n;
  global.odpT = function (k) {
    return k;
  };
  global.odpGetLocale = function () {
    return odpResolveLocale();
  };
  global.ODP_I18N_LOCALES = ODP_LOCALES;
})(typeof window !== "undefined" ? window : globalThis);
