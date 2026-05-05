// Shared employee dataset + CSV loader for the org-chart visualization experiments.
// Field shape matches org-chart-editable_3.html so the main app's "Export employees CSV"
// can be dropped onto any experiment to swap in your real data.

(function () {
  const ALL_LEVELS = ["L1","L2","L3","L4","L5","L6","L7","M1","M2","M3","M4","E1","E2","E3"];

  // 42-person seed org. Keep small enough to render fast in any viz, big enough
  // to show 4 levels of depth and cross-department clustering.
  const SAMPLE = [
    // C-suite
    { id: "E0001", first: "Alex",     last: "Rivera",   title: "Chief Executive Officer", level: "E3", dept: "Exec",        location: "San Jose",  managerId: null    },
    { id: "E0002", first: "Maya",     last: "Chen",     title: "Chief Technology Officer", level: "E2", dept: "Engineering", location: "San Jose",  managerId: "E0001" },
    { id: "E0003", first: "Devon",    last: "Park",     title: "Chief Product Officer",   level: "E2", dept: "Product",     location: "San Jose",  managerId: "E0001" },
    { id: "E0004", first: "Priya",    last: "Iyer",     title: "Chief Operating Officer", level: "E2", dept: "Operations",  location: "Austin",    managerId: "E0001" },
    { id: "E0005", first: "Nora",     last: "Williams", title: "Chief Financial Officer", level: "E2", dept: "Finance",     location: "New York",  managerId: "E0001" },
    { id: "E0006", first: "Hideo",    last: "Tanaka",   title: "Chief People Officer",    level: "E2", dept: "People",      location: "San Jose",  managerId: "E0001" },

    // VPs under CTO
    { id: "V0101", first: "Lars",     last: "Eriksen",  title: "VP, Platform Engineering", level: "E1", dept: "Engineering", location: "San Jose",  managerId: "E0002" },
    { id: "V0102", first: "Anika",    last: "Kapoor",   title: "VP, ML & Data",            level: "E1", dept: "Engineering", location: "San Jose",  managerId: "E0002" },
    { id: "V0103", first: "Marco",    last: "Russo",    title: "VP, Hardware",             level: "E1", dept: "Engineering", location: "Hsinchu",   managerId: "E0002" },

    // Directors under VPs (Eng)
    { id: "D0201", first: "Sofia",    last: "Lin",      title: "Director, Cloud Infra",    level: "M3", dept: "Engineering", location: "San Jose",  managerId: "V0101" },
    { id: "D0202", first: "Oliver",   last: "Schmidt",  title: "Director, Developer Tools",level: "M3", dept: "Engineering", location: "Berlin",    managerId: "V0101" },
    { id: "D0203", first: "Yuki",     last: "Nakamura", title: "Director, ML Platform",    level: "M3", dept: "Engineering", location: "San Jose",  managerId: "V0102" },
    { id: "D0204", first: "Ravi",     last: "Patel",    title: "Director, Data Science",   level: "M3", dept: "Engineering", location: "Bangalore", managerId: "V0102" },
    { id: "D0205", first: "Wei",      last: "Zhang",    title: "Director, Silicon Design", level: "M3", dept: "Engineering", location: "Hsinchu",   managerId: "V0103" },

    // Managers + ICs under Cloud Infra
    { id: "M0301", first: "Felix",    last: "Brown",    title: "Senior EM, Compute",       level: "M1", dept: "Engineering", location: "San Jose",  managerId: "D0201" },
    { id: "I0401", first: "Liam",     last: "Garcia",   title: "Staff Engineer",           level: "L6", dept: "Engineering", location: "San Jose",  managerId: "M0301" },
    { id: "I0402", first: "Emma",     last: "Johnson",  title: "Senior Engineer",          level: "L4", dept: "Engineering", location: "Remote",    managerId: "M0301" },
    { id: "I0403", first: "Noah",     last: "Müller",   title: "Engineer",                 level: "L3", dept: "Engineering", location: "Berlin",    managerId: "M0301" },

    // ICs under Dev Tools
    { id: "I0411", first: "Olivia",   last: "Smith",    title: "Senior Engineer",          level: "L4", dept: "Engineering", location: "Berlin",    managerId: "D0202" },
    { id: "I0412", first: "Ethan",    last: "Davis",    title: "Engineer",                 level: "L3", dept: "Engineering", location: "Berlin",    managerId: "D0202" },

    // ML Platform team
    { id: "M0302", first: "Ava",      last: "Martinez", title: "EM, ML Infra",             level: "M1", dept: "Engineering", location: "San Jose",  managerId: "D0203" },
    { id: "I0421", first: "Lucas",    last: "Anderson", title: "Senior ML Engineer",       level: "L4", dept: "Engineering", location: "San Jose",  managerId: "M0302" },
    { id: "I0422", first: "Mia",      last: "Kim",      title: "ML Engineer",              level: "L3", dept: "Engineering", location: "San Jose",  managerId: "M0302" },

    // Data Science (Bangalore)
    { id: "I0431", first: "Arjun",    last: "Verma",    title: "Senior Data Scientist",    level: "L4", dept: "Engineering", location: "Bangalore", managerId: "D0204" },
    { id: "I0432", first: "Ananya",   last: "Joshi",    title: "Data Scientist",           level: "L3", dept: "Engineering", location: "Bangalore", managerId: "D0204" },

    // Silicon Design (Hsinchu)
    { id: "I0441", first: "Jin",      last: "Hsu",      title: "Principal Engineer",       level: "L7", dept: "Engineering", location: "Hsinchu",   managerId: "D0205" },
    { id: "I0442", first: "Mei",      last: "Tsai",     title: "Senior Engineer",          level: "L4", dept: "Engineering", location: "Hsinchu",   managerId: "D0205" },

    // Product
    { id: "V0151", first: "Zara",     last: "Khan",     title: "VP, Product",              level: "E1", dept: "Product",     location: "San Jose",  managerId: "E0003" },
    { id: "D0251", first: "Sam",      last: "Reyes",    title: "Director, Product Management", level: "M3", dept: "Product", location: "San Jose", managerId: "V0151" },
    { id: "I0451", first: "Luna",     last: "Costa",    title: "Senior PM",                level: "L4", dept: "Product",     location: "San Jose",  managerId: "D0251" },
    { id: "I0452", first: "Hana",     last: "Sato",     title: "PM",                       level: "L3", dept: "Product",     location: "Tokyo",     managerId: "D0251" },

    // Operations
    { id: "V0161", first: "Pierre",   last: "Lefebvre", title: "VP, Operations",           level: "E1", dept: "Operations",  location: "Austin",    managerId: "E0004" },
    { id: "D0261", first: "Marie",    last: "Dubois",   title: "Director, Supply Chain",   level: "M3", dept: "Operations",  location: "Austin",    managerId: "V0161" },
    { id: "I0461", first: "Otto",     last: "Hansen",   title: "Senior Ops Manager",       level: "L4", dept: "Operations",  location: "Austin",    managerId: "D0261" },

    // Finance
    { id: "V0171", first: "Ingrid",   last: "Larsson",  title: "VP, Finance",              level: "E1", dept: "Finance",     location: "New York",  managerId: "E0005" },
    { id: "D0271", first: "Kenji",    last: "Suzuki",   title: "Director, FP&A",           level: "M3", dept: "Finance",     location: "New York",  managerId: "V0171" },
    { id: "I0471", first: "Elena",    last: "Petrova",  title: "Senior Analyst",           level: "L4", dept: "Finance",     location: "New York",  managerId: "D0271" },

    // People
    { id: "V0181", first: "Sandra",   last: "Brooks",   title: "VP, People",               level: "E1", dept: "People",      location: "San Jose",  managerId: "E0006" },
    { id: "D0281", first: "Karen",    last: "Adams",    title: "Director, Talent",         level: "M3", dept: "People",      location: "San Jose",  managerId: "V0181" },
    { id: "I0481", first: "Linda",    last: "Scott",    title: "Senior Recruiter",         level: "L4", dept: "People",      location: "Remote",    managerId: "D0281" },
    { id: "I0482", first: "Patricia", last: "Allen",    title: "Recruiter",                level: "L3", dept: "People",      location: "Remote",    managerId: "D0281" },
  ];

  // RFC-4180-ish CSV parser, lifted from the main app so dropped exports parse identically.
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], cell = "", inQuotes = false, i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        cell += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(cell); cell = ""; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
      cell += ch; i++;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ""));
  }

  // Parse an exported employees CSV from the main app into the same shape as SAMPLE.
  // Required columns: id, first, last, level, dept, managerId. Extra columns are ignored.
  function employeesFromCSV(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error("CSV has no data rows");
    const header = rows[0].map(c => c.trim().toLowerCase());
    const idx = name => header.indexOf(name);
    const required = ["id", "first", "last", "level", "dept", "managerid"];
    const missing = required.filter(n => idx(n) < 0);
    if (missing.length) throw new Error("Missing columns: " + missing.join(", "));
    const get = (row, name) => { const i = idx(name); return i >= 0 ? (row[i] ?? "").trim() : ""; };
    const out = [];
    const seen = new Set();
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const id = get(row, "id");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        first:    get(row, "first"),
        last:     get(row, "last"),
        title:    get(row, "title")    || `${get(row, "level")} ${get(row, "dept")}`,
        level:    get(row, "level").toUpperCase(),
        dept:     get(row, "dept"),
        location: get(row, "location") || "Unknown",
        managerId: get(row, "managerid") || null,
      });
    }
    // Drop manager refs we don't have, break self-loops
    out.forEach(e => {
      if (e.managerId && !seen.has(e.managerId)) e.managerId = null;
      if (e.id === e.managerId) e.managerId = null;
    });
    return out;
  }

  // Build a tree from the flat employee list. Returns { roots, byId, childrenOf }.
  function buildTree(employees) {
    const byId = new Map(employees.map(e => [e.id, e]));
    const childrenOf = new Map();
    const roots = [];
    employees.forEach(e => {
      if (e.managerId && byId.has(e.managerId)) {
        if (!childrenOf.has(e.managerId)) childrenOf.set(e.managerId, []);
        childrenOf.get(e.managerId).push(e);
      } else {
        roots.push(e);
      }
    });
    return { roots, byId, childrenOf };
  }

  // Department palette — consistent across all 4 experiments so the same person looks
  // the same colour everywhere.
  const DEPT_COLORS = {
    Exec:        "#1e293b",
    Engineering: "#3b82f6",
    Product:     "#8b5cf6",
    Operations:  "#f59e0b",
    Finance:     "#10b981",
    People:      "#ec4899",
  };
  function deptColor(dept) {
    return DEPT_COLORS[dept] || "#64748b";
  }

  // Pretty depth-from-root for visualizations that need it.
  function depthMap(employees) {
    const { byId } = buildTree(employees);
    const cache = new Map();
    function depth(id) {
      if (cache.has(id)) return cache.get(id);
      const e = byId.get(id);
      if (!e || !e.managerId || !byId.has(e.managerId)) { cache.set(id, 0); return 0; }
      const d = depth(e.managerId) + 1;
      cache.set(id, d);
      return d;
    }
    const out = {};
    employees.forEach(e => out[e.id] = depth(e.id));
    return out;
  }

  // Wire a "Load CSV" file input that swaps in employees from a dropped/picked file.
  // Pass it the input element and a callback that re-renders with the new data.
  function attachCSVLoader(inputEl, onLoad) {
    inputEl.addEventListener("change", e => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const emps = employeesFromCSV(String(ev.target.result || ""));
          if (!emps.length) throw new Error("No valid rows");
          onLoad(emps);
        } catch (err) {
          alert("Could not parse CSV: " + err.message);
        }
      };
      reader.readAsText(f);
      e.target.value = "";
    });
  }

  window.OrgShared = {
    SAMPLE,
    ALL_LEVELS,
    DEPT_COLORS,
    deptColor,
    parseCSV,
    employeesFromCSV,
    buildTree,
    depthMap,
    attachCSVLoader,
  };
})();
