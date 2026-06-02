/**
 * Precarga curso, grupo, asunto y cuerpo desde la URL (Plataforma BEX).
 * Agregar en mail_composer.php (gestiondepersonasbex.cl), antes de </body>:
 * <script src="https://SU-PLATAFORMA/mail-composer-prefill.js" defer></script>
 */
(function () {
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

  function setSubject() {
    if (!subject) return;
    var subjectEl = document.getElementById("subject");
    if (subjectEl) subjectEl.value = subject;
  }

  function setBody() {
    if (!body) return;
    var html = body.replace(/\n/g, "<br>");
    if (window.jQuery && jQuery.fn && jQuery.fn.summernote) {
      var $sn = jQuery("#summernote");
      if ($sn.length && $sn.next(".note-editor").length) {
        $sn.summernote("code", html);
        return true;
      }
    }
    var ta = document.querySelector("#summernote textarea, textarea.note-codable");
    if (ta) {
      ta.value = body;
      return true;
    }
    return false;
  }

  function selectGroupByName() {
    if (!grupoName) return;
    var sel = document.getElementById("idgroup");
    if (!sel) return;
    var target = grupoName.trim().toLowerCase();
    for (var i = 0; i < sel.options.length; i++) {
      var opt = sel.options[i];
      var text = (opt.textContent || "").trim().toLowerCase();
      if (text === target || text.indexOf(target) !== -1 || target.indexOf(text) !== -1) {
        sel.value = opt.value;
        if (window.jQuery) jQuery(sel).trigger("change.select2");
        break;
      }
    }
  }

  function waitFor(fn, maxMs, intervalMs) {
    var elapsed = 0;
    var t = setInterval(function () {
      if (fn() || elapsed >= maxMs) {
        clearInterval(t);
      }
      elapsed += intervalMs;
    }, intervalMs);
  }

  function applyCourseAndGroup() {
    if (!courseid) {
      setSubject();
      waitFor(setBody, 15000, 300);
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
        waitFor(function () {
          var sel = document.getElementById("idgroup");
          if (sel && sel.options.length > 1) {
            selectGroupByName();
            return true;
          }
          return false;
        }, 12000, 400);
      }
      setSubject();
      waitFor(setBody, 15000, 300);
    }, 1000);
  }

  waitFor(function () {
    var sel = document.getElementById("courseid");
    var ready = sel && sel.options.length > 1 && sel.options[0].value !== "" && sel.options[0].value !== "Cargando...";
    if (ready) applyCourseAndGroup();
    return ready;
  }, 20000, 250);
})();
