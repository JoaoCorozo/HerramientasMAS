/**
 * Pegar al final de ajax/ajax.mail_composer.js en gestiondepersonasbex.cl
 * (después de loadCourses / summernote init).
 *
 * Permite abrir el composer con datos desde la Plataforma BEX, por ejemplo:
 * mail_composer.php?key=...&courseid=44&grupo=Grupo%2005&asunto=...&cuerpo=...
 * (solo precarga campos; no envía correos)
 */
(function applyMailComposerUrlPrefill() {
  var params = new URLSearchParams(window.location.search);
  if (
    !params.has("courseid") &&
    !params.has("curso") &&
    !params.has("asunto") &&
    !params.has("subject") &&
    !params.has("cuerpo") &&
    !params.has("body")
  ) {
    return;
  }

  var courseid = params.get("courseid") || params.get("curso") || "";
  var idgroup = params.get("idgroup") || params.get("grupo_id") || "";
  var grupoName = params.get("grupo") || "";
  var subject = params.get("subject") || params.get("asunto") || "";
  var body = params.get("body") || params.get("cuerpo") || params.get("detalle") || "";
  var autoload = params.get("autoload") === "1";

  function setSubjectAndBody() {
    if (subject) {
      var subjectEl = document.getElementById("subject");
      if (subjectEl) subjectEl.value = subject;
    }
    if (body && window.jQuery && jQuery("#summernote").length) {
      jQuery("#summernote").summernote("code", body.replace(/\n/g, "<br>"));
    }
  }

  function selectGroupByName() {
    if (!grupoName) return Promise.resolve();
    var sel = document.getElementById("idgroup");
    if (!sel) return Promise.resolve();
    var target = grupoName.trim().toLowerCase();
    for (var i = 0; i < sel.options.length; i++) {
      var opt = sel.options[i];
      if ((opt.textContent || "").trim().toLowerCase() === target) {
        sel.value = opt.value;
        if (window.jQuery) jQuery(sel).trigger("change.select2");
        return Promise.resolve();
      }
      if ((opt.textContent || "").toLowerCase().indexOf(target) !== -1) {
        sel.value = opt.value;
        if (window.jQuery) jQuery(sel).trigger("change.select2");
        return Promise.resolve();
      }
    }
    return Promise.resolve();
  }

  function waitForCourseOptions() {
    return new Promise(function (resolve) {
      var tries = 0;
      var t = setInterval(function () {
        var sel = document.getElementById("courseid");
        var ready = sel && sel.options.length > 1 && sel.options[0].value !== "";
        if (ready || tries++ > 40) {
          clearInterval(t);
          resolve();
        }
      }, 200);
    });
  }

  waitForCourseOptions().then(function () {
    if (!courseid) {
      setSubjectAndBody();
      return;
    }
    var courseSel = document.getElementById("courseid");
    if (!courseSel) return;
    courseSel.value = String(courseid);
    if (window.jQuery) jQuery(courseSel).trigger("change.select2");
    courseSel.dispatchEvent(new Event("change", { bubbles: true }));

    setTimeout(function () {
      if (idgroup) {
        var groupSel = document.getElementById("idgroup");
        if (groupSel) {
          groupSel.value = String(idgroup);
          if (window.jQuery) jQuery(groupSel).trigger("change.select2");
        }
      } else {
        selectGroupByName();
      }
      setSubjectAndBody();
      if (autoload) {
        var btn = document.getElementById("btnLoadUsers");
        if (btn) btn.click();
      }
    }, 800);
  });
})();
