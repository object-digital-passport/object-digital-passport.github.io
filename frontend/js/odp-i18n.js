/**
 * ODP UI i18n — loads JSON from frontend/localization/<lang>/*.json (deployed as /localization/ on GitHub Pages).
 *
 * Adding a language:
 *   1. create frontend/localization/<code>/ with common.json and one file per page,
 *   2. add one entry to ODP_LOCALES in odp-i18n-boot.js.
 * Nothing else in this file knows a language by name. English is the base set: the selected
 * locale is merged over it, so a missing key — or a missing file — falls back to English rather
 * than rendering blank, which is what makes a partial translation usable.
 *
 * localStorage odp_locale holds the last explicit choice.
 */
(function (global) {
  "use strict";

  var BASE_LOCALE = "en";
  var startup = global.ODPLocale;
  var ODP_LOCALES = startup.entries;
  var englishDefaults = {
    lang: { switchLabel: "Language" },
    theme: {
      switchAria: "Switch color theme",
      switchTitle: "Current theme: {name}",
      nameBlue: "Light (blue)",
      nameDark: "Dark"
    }
  };

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
    startup.save(code);
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
    var requested = startup.initial();
    var names = ["common", opts.page || "index"].concat(opts.mergePages || []);
    var base = new URL("localization/", global.location.href);
    var version = global.ODP_I18N_VERSION || "20260523";
    var englishFiles = new Map();
    var controller = new AbortController();

    function load(locale, name) {
      var url = new URL(locale + "/" + name + ".json", base);
      url.searchParams.set("v", version);
      return global.fetch(url.toString(), { signal: controller.signal })
        .then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        })
        .then(function (file) {
          if (!file || typeof file !== "object" || Array.isArray(file)) throw new Error("Invalid dictionary");
          return file;
        })
        .catch(function (error) {
          if (!controller.signal.aborted) {
            console.warn("[ODP i18n] Could not load " + locale + "/" + name + ".json", error);
          }
          return null;
        });
    }

    function mergeFiles(files, initial) {
      return files.reduce(function (result, file) {
        return deepMerge(result, file);
      }, initial);
    }

    var loading = Promise.all([
      Promise.all(names.map(function (name, index) {
        return load(BASE_LOCALE, name).then(function (file) {
          englishFiles.set(index, file);
        });
      })),
      Promise.all(requested === BASE_LOCALE ? [] : names.map(function (name) {
        return load(requested, name);
      }))
    ]).then(function (files) { return files[1]; });
    var timeout = startup.deadline.then(function () { return []; });

    return Promise.race([loading, timeout]).then(function (translated) {
      _locale = translated.some(function (file) {
        return file && Object.keys(file).length > 0;
      }) ? requested : BASE_LOCALE;
      // Merge by declaration order even though the independent files load in parallel.
      var en = mergeFiles(names.map(function (_, index) { return englishFiles.get(index); }), englishDefaults);
      _merged = mergeFiles(translated, en);

      global.document.documentElement.lang = _locale;
      global.odpT = t;
      global.odpGetLocale = function () { return _locale; };
      global.odpRegistryBannerHtml = odpRegistryBannerHtml;
      global.odpApplyDataI18n = odpApplyDataI18n;
      global.odpRenderLangSwitch = odpRenderLangSwitch;
      global.odpSetLocale = odpSetLocale;
      global.odpRegistryMisconfiguredBannerHtml = odpRegistryBannerHtml;
      if (opts.pageTitleKey) {
        var title = t(opts.pageTitleKey);
        if (title !== opts.pageTitleKey) global.document.title = title;
      }
      odpApplyDataI18n(global.document.body);
      odpApplyReadmeLinks(global.document.body);
      odpRenderLangSwitch("odpLangSwitch");
      if (typeof global.odpRenderThemeSwitch === "function") global.odpRenderThemeSwitch("odpThemeSwitch");
    }).finally(function () {
      controller.abort();
      startup.reveal();
    });
  }

  global.odpInitI18n = odpInitI18n;
  global.odpT = function (k) {
    return k;
  };
  global.odpGetLocale = function () {
    return startup.initial();
  };
  global.ODP_I18N_LOCALES = ODP_LOCALES;
})(typeof window !== "undefined" ? window : globalThis);
