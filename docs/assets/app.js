/**
 * Tender Monitor — client filters & helpers
 * Paths are relative to each page; dataRoot is set via <body data-root="...">
 */
(function () {
  const body = document.body;
  const dataRoot = (body.getAttribute("data-root") || "data").replace(/\/$/, "");

  function qs(sel, el) { return (el || document).querySelector(sel); }
  function qsa(sel, el) { return Array.from((el || document).querySelectorAll(sel)); }

  // Mobile nav
  const toggle = qs(".nav-toggle");
  const links = qs(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  // Mark active nav by data-page
  const page = body.getAttribute("data-page");
  if (page) {
    qsa(".nav-links a").forEach((a) => {
      if (a.getAttribute("data-nav") === page) a.classList.add("active");
    });
  }

  function tagClass(tag) {
    const t = String(tag).toLowerCase();
    if (t === "lis") return "tag tag-lis";
    if (t === "lims") return "tag tag-lims";
    if (t === "输血" || t.includes("血")) return "tag tag-blood";
    if (t === "实验室" || t.includes("实验室")) return "tag tag-lab";
    return "tag";
  }

  function renderTags(tags) {
    return (tags || []).map((t) => `<span class="${tagClass(t)}">${escapeHtml(t)}</span>`).join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tenderCard(t, detailPrefix) {
    const href = (detailPrefix || "") + (t.detailPath || ("tenders/" + t.id + ".html"));
    return `
<article class="tender-card" data-province="${escapeHtml(t.province || "")}" data-type="${escapeHtml(t.noticeType || "")}" data-tags="${escapeHtml((t.tags || []).join(","))}" data-title="${escapeHtml(t.title || "")}">
  <div>
    <h3><a href="${href}">${escapeHtml(t.title)}</a></h3>
    <div class="meta-row">
      <span>${escapeHtml(t.buyer || "")}</span>
      <span>${escapeHtml(t.region || "")}</span>
      <span>${escapeHtml(t.publishDate || "")}</span>
    </div>
    <div class="tags" style="margin-top:.55rem">${renderTags(t.tags)}</div>
  </div>
  <div class="card-side">
    <div class="budget">${escapeHtml(t.budget || "—")}</div>
    <span class="pill notice">${escapeHtml(t.noticeType || "")}</span>
  </div>
</article>`;
  }

  async function loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to load " + path);
    return res.json();
  }

  // --- Tender list filter (index / today / date pages) ---
  const listEl = qs("#tender-list");
  if (listEl) {
    const source = listEl.getAttribute("data-source") || (dataRoot + "/index.json");
    const detailPrefix = listEl.getAttribute("data-detail-prefix") || "";
    const searchInput = qs("#filter-q");
    const provinceSel = qs("#filter-province");
    const typeSel = qs("#filter-type");
    const countEl = qs("#result-count");
    let items = [];
    let activeTag = "";

    function applyFilters() {
      const q = (searchInput && searchInput.value || "").trim().toLowerCase();
      const prov = provinceSel && provinceSel.value || "";
      const typ = typeSel && typeSel.value || "";
      const filtered = items.filter((t) => {
        if (prov && t.province !== prov) return false;
        if (typ && t.noticeType !== typ) return false;
        if (activeTag && !(t.tags || []).includes(activeTag)) return false;
        if (q) {
          const hay = [t.title, t.buyer, t.region, (t.tags || []).join(" ")].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      listEl.innerHTML = filtered.length
        ? filtered.map((t) => tenderCard(t, detailPrefix)).join("")
        : `<div class="empty">没有匹配的标讯，试试调整筛选条件。</div>`;
      if (countEl) countEl.textContent = `共 ${filtered.length} 条`;
    }

    loadJSON(source)
      .then((data) => {
        items = data.tenders || data.items || [];
        // fill selects
        if (provinceSel) {
          const provinces = [...new Set(items.map((t) => t.province).filter(Boolean))].sort();
          provinces.forEach((p) => {
            const opt = document.createElement("option");
            opt.value = p; opt.textContent = p;
            provinceSel.appendChild(opt);
          });
        }
        if (typeSel) {
          const types = [...new Set(items.map((t) => t.noticeType).filter(Boolean))].sort();
          types.forEach((p) => {
            const opt = document.createElement("option");
            opt.value = p; opt.textContent = p;
            typeSel.appendChild(opt);
          });
        }
        applyFilters();
      })
      .catch((err) => {
        listEl.innerHTML = `<div class="empty">加载失败：${escapeHtml(err.message)}</div>`;
      });

    [searchInput, provinceSel, typeSel].forEach((el) => {
      if (el) el.addEventListener("input", applyFilters);
      if (el) el.addEventListener("change", applyFilters);
    });

    qsa(".chip[data-tag]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const tag = chip.getAttribute("data-tag");
        if (activeTag === tag) {
          activeTag = "";
          chip.classList.remove("active");
        } else {
          activeTag = tag;
          qsa(".chip[data-tag]").forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
        }
        applyFilters();
      });
    });
  }

  // --- Sources page filter ---
  const sourceList = qs("#source-list");
  if (sourceList) {
    const source = sourceList.getAttribute("data-source") || (dataRoot + "/sources.json");
    const searchInput = qs("#filter-q");
    const statusSel = qs("#filter-status");
    const relevanceSel = qs("#filter-relevance");
    const regionSel = qs("#filter-region");
    const countEl = qs("#result-count");
    let items = [];

    function statusPill(s) {
      const map = { verified: "verified", indexed: "indexed", catalog: "catalog", pattern: "pattern" };
      const cls = map[s] || "";
      const label = { verified: "已核验", indexed: "可索引", catalog: "目录", pattern: "模式" }[s] || s;
      return `<span class="pill ${cls}">${escapeHtml(label)}</span>`;
    }
    function relPill(r) {
      const map = { "高": "high", "中": "mid", "低": "low" };
      return `<span class="pill ${map[r] || ""}">相关度 ${escapeHtml(r || "—")}</span>`;
    }

    function render(list) {
      sourceList.innerHTML = list.length
        ? list.map((s) => `
<article class="source-card">
  <div style="display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;align-items:flex-start">
    <h3><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a></h3>
    <div style="display:flex;gap:.35rem;flex-wrap:wrap">${statusPill(s.status)}${relPill(s.relevance)}</div>
  </div>
  <div class="meta-row">
    <span>${escapeHtml(s.region || "")}</span>
    <span>${escapeHtml(s.scope || "")}</span>
    <span>收录 ${escapeHtml(s.addedAt || "")}</span>
  </div>
  <div class="notes">${escapeHtml(s.notes || "")}</div>
</article>`).join("")
        : `<div class="empty">没有匹配的信源。</div>`;
      if (countEl) countEl.textContent = `共 ${list.length} 条`;
    }

    function apply() {
      const q = (searchInput && searchInput.value || "").trim().toLowerCase();
      const st = statusSel && statusSel.value || "";
      const rel = relevanceSel && relevanceSel.value || "";
      const reg = regionSel && regionSel.value || "";
      render(items.filter((s) => {
        if (st && s.status !== st) return false;
        if (rel && s.relevance !== rel) return false;
        if (reg && s.region !== reg) return false;
        if (q) {
          const hay = [s.name, s.region, s.scope, s.notes, (s.types || []).join(" ")].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }));
    }

    loadJSON(source).then((data) => {
      items = Array.isArray(data) ? data : (data.sources || []);
      if (regionSel) {
        [...new Set(items.map((s) => s.region).filter(Boolean))].sort().forEach((r) => {
          const o = document.createElement("option");
          o.value = r; o.textContent = r;
          regionSel.appendChild(o);
        });
      }
      apply();
    }).catch((err) => {
      sourceList.innerHTML = `<div class="empty">加载失败：${escapeHtml(err.message)}</div>`;
    });

    [searchInput, statusSel, relevanceSel, regionSel].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", apply);
      el.addEventListener("change", apply);
    });
  }
})();
