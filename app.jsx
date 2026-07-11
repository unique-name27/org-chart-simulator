
const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext, memo } = React;
const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, AreaChart, Area, CartesianGrid, Legend, ReferenceLine } = Recharts;
const { Search, ChevronDown, ChevronRight, Users, Building2, MapPin, TrendingUp, AlertTriangle, MessageSquare, GripVertical, Play, Pause, SkipBack, SkipForward, Download, Plus, Eye, EyeOff, Filter, BarChart3, Clock, Zap, Target, Layers, Globe, ChevronLeft, X, Check, Flag, Edit3, Trash2, Move, ArrowRight, Info, AlertCircle, Activity, GitMerge, AlertOctagon, UserPlus, Minus, Printer, Sparkles, FileText } = LucideReact;



// ─── CONSTANTS ───
// All tenure, recency, and flight-risk calculations are relative to this fixed
// reference date so that scores remain stable regardless of when the app is run.
// It matches the data generator's "now" (Jun 1 2025).
const FIXED_NOW = new Date(2025, 5, 1);

const DEPT_COLORS = {
  "IC Design": "#2563eb", "Verification": "#7c3aed", "Physical Design": "#0891b2",
  "Process Engineering": "#059669", "Manufacturing": "#d97706", "Test Engineering": "#dc2626",
  "Product Engineering": "#e11d48", "Applications": "#8b5cf6", "Field Applications": "#6366f1",
  "Supply Chain": "#0d9488", "Quality & Reliability": "#ea580c", "Sales": "#16a34a",
  "Marketing": "#a855f7", "Finance": "#64748b", "HR": "#f59e0b", "Legal": "#6b7280",
  "IT": "#3b82f6", "Facilities": "#78716c", "Corporate Strategy": "#1e40af",
  "Software": "#10b981", "Systems Engineering": "#f43f5e"
};

const BG_COLORS = {
  "Automotive BU": "#2563eb", "Data Center BU": "#7c3aed", "Corporate": "#64748b"
};

const LOC_COLORS = {
  "San Jose HQ": "#2563eb", "Austin": "#059669", "Portland": "#d97706",
  "Shanghai": "#dc2626", "Munich": "#7c3aed", "Bangalore": "#0891b2",
  "Hsinchu": "#e11d48", "Boston": "#16a34a"
};

const FN_COLORS = {
  "Engineering": "#2563eb", "Operations": "#059669", "G&A": "#64748b",
  "Sales & Marketing": "#d97706", "R&D": "#7c3aed"
};

const EXTRA_COLORS = ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f97316","#84cc16","#06b6d4","#f43f5e","#a78bfa","#fb923c"];

const RECRUITER_LEVEL_GROUPS = ["Early Career", "Experienced", "Executive"];
const RECRUITER_LEVEL_MAP    = { "Early Career": ["IC1","IC2"], "Experienced": ["IC3","IC4","IC5","Manager","Director"], "Executive": ["VP","SVP","C-Suite"] };
const RECRUITER_FNS          = ["Engineering", "R&D", "Operations", "G&A", "Sales & Marketing"];
const RECRUITER_COLORS       = ["#2563eb","#7c3aed","#059669","#d97706","#dc2626","#0891b2","#db2777","#16a34a"];
function recruiterColor(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return RECRUITER_COLORS[h % RECRUITER_COLORS.length]; }

const DIM_COLORS = { location: LOC_COLORS, bg: BG_COLORS, fn: FN_COLORS, dept: DEPT_COLORS };

function getDimColor(dim, val, idx) {
  const map = DIM_COLORS[dim];
  if (map && map[val]) return map[val];
  return EXTRA_COLORS[idx % EXTRA_COLORS.length];
}

const LOCATIONS = ["San Jose HQ", "Austin", "Portland", "Shanghai", "Munich", "Bangalore", "Hsinchu", "Boston"];
const COUNTRY_BY_LOCATION = {
  "San Jose HQ": "USA", "Austin": "USA", "Portland": "USA", "Boston": "USA",
  "Shanghai": "China", "Munich": "Germany", "Bangalore": "India", "Hsinchu": "Taiwan",
};
function countryFor(location) { return COUNTRY_BY_LOCATION[location] || "USA"; }
const COUNTRIES = [...new Set(Object.values(COUNTRY_BY_LOCATION))].sort();
const EMPLOYMENT_TYPES = ["FTE", "Contract"];

const SEMI_TITLES = {
  "IC Design": ["RTL Design Engineer", "Sr. Design Engineer", "Principal Design Engineer", "Design Architect", "Analog Design Engineer", "Mixed-Signal Engineer"],
  "Verification": ["Verification Engineer", "Sr. Verification Engineer", "DV Lead", "Formal Verification Engineer", "UVM Engineer", "Emulation Engineer"],
  "Physical Design": ["Physical Design Engineer", "Sr. PD Engineer", "PD Lead", "Layout Engineer", "Timing Engineer", "Power Integrity Engineer"],
  "Process Engineering": ["Process Engineer", "Sr. Process Engineer", "Integration Engineer", "Yield Engineer", "Etch Engineer", "Litho Engineer"],
  "Manufacturing": ["Manufacturing Engineer", "Production Engineer", "Equipment Engineer", "Fab Technician", "Process Technician"],
  "Test Engineering": ["Test Engineer", "Sr. Test Engineer", "ATE Engineer", "Test Development Lead", "Characterization Engineer"],
  "Product Engineering": ["Product Engineer", "Sr. Product Engineer", "Product Engineering Lead", "Silicon Validation Engineer"],
  "Applications": ["Applications Engineer", "Sr. Applications Engineer", "Solutions Architect", "Systems Engineer"],
  "Software": ["Embedded SW Engineer", "Firmware Engineer", "Sr. SW Engineer", "SW Architect", "Driver Developer"],
  "Sales": ["Account Manager", "Sales Director", "Regional Sales Manager", "Business Development Mgr"],
  "Marketing": ["Product Marketing Mgr", "Marketing Analyst", "Content Strategist", "Brand Manager"],
  "Finance": ["Financial Analyst", "Sr. Accountant", "FP&A Manager", "Controller"],
  "HR": ["HR Business Partner", "Recruiter", "Compensation Analyst", "HR Generalist"],
  "Legal": ["Corporate Counsel", "IP Attorney", "Patent Engineer", "Compliance Officer"],
  "IT": ["IT Engineer", "DevOps Engineer", "IT Security Analyst", "Systems Admin"],
  "Quality & Reliability": ["Quality Engineer", "Reliability Engineer", "Failure Analysis Eng", "QA Manager"],
  "Supply Chain": ["Procurement Specialist", "Supply Chain Analyst", "Logistics Coordinator", "Vendor Manager"],
  "Field Applications": ["FAE", "Sr. FAE", "FAE Manager", "Technical Marketing Eng"],
  "Systems Engineering": ["Systems Engineer", "Sr. Systems Engineer", "Systems Architect", "Algorithm Engineer"],
};

// Granular job family ("Discipline") — refines the broad discipline taxonomy using the
// person's title, so Verification splits into Design Verification / Emulation / Formal, etc.
function jobFamily(title, taxo) {
  const t = (title || "").toLowerCase();
  const has = (...ks) => ks.some(k => t.includes(k));
  if (has("chief of staff", "executive assistant", "assistant")) return "Executive Admin";
  switch (taxo) {
    case "Verification":
      if (has("emulation", "fpga", "prototyp")) return "Emulation & Prototyping";
      if (has("formal"))                        return "Formal Verification";
      return "Design Verification";
    case "IC Design":
      if (has("analog", "mixed-signal", "serdes", "pll", "clock")) return "Analog & Mixed-Signal";
      if (has("rtl", "logic"))                                     return "RTL & Logic Design";
      return "IC Design";
    case "Test Engineering":
      if (has("dft", "scan", "atpg"))             return "DFT";
      if (has("characteriz"))                     return "Characterization";
      return "Test Engineering";
    case "Software":             return "Firmware & Software";
    case "Systems Engineering":  return "Systems Architecture";
    case "Product Engineering":  return "Silicon Validation";
    case "Process Engineering":  return "Process & Yield";
    case "HR":                   return "HR & People";
    case "Legal":                return "Legal & IP";
    case "IT":                   return "IT & Security";
    default: return taxo || "General";
  }
}

const FIRST_NAMES = ["James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth","William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Christopher","Karen","Charles","Lisa","Daniel","Nancy","Matthew","Betty","Anthony","Margaret","Mark","Sandra","Steven","Ashley","Andrew","Dorothy","Paul","Kimberly","Joshua","Emily","Kenneth","Donna","Kevin","Michelle","Brian","Carol","George","Amanda","Timothy","Melissa","Ronald","Deborah","Jason","Stephanie","Wei","Li","Chen","Yan","Min","Hui","Raj","Priya","Amit","Neha","Sanjay","Deepa","Lars","Anna","Hans","Katja","Yuki","Sakura","Jin","Mei","Arjun","Ananya","Ravi","Sunita","Marco","Sofia","Pierre","Marie","Otto","Ingrid","Kenji","Hana","Arun","Kavita","Felix","Elena","Liam","Olivia","Noah","Emma","Ethan","Ava","Lucas","Mia","Alex","Zara","Sam","Luna"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Anderson","Taylor","Thomas","Jackson","White","Harris","Martin","Thompson","Moore","Young","Allen","King","Wright","Lopez","Hill","Scott","Green","Adams","Baker","Lee","Kim","Park","Chen","Wang","Li","Zhang","Liu","Wu","Yang","Huang","Singh","Patel","Kumar","Sharma","Gupta","Joshi","Verma","Rao","Müller","Schmidt","Schneider","Fischer","Tanaka","Suzuki","Sato","Nakamura","Fernandez","Costa","Silva","Rossi","Bianchi","Johansson","Larsson","Eriksson","Nielsen","Hansen","Andersen","Petrov","Ivanov","Chang","Lin","Hsu","Tsai","Cheng"];

// ─── DATA GENERATOR ───
function generateSemiCompany() {
  const employees = [];
  let nextId = 1;
  const foundingDate = new Date(2015, 0, 15); // Jan 15, 2015
  const now          = new Date(2025, 5, 1);  // Jun 1, 2025 — fixed "today"

  const rn  = arr => arr[Math.floor(Math.random() * arr.length)];
  const rid = () => `EMP-${String(nextId++).padStart(4, "0")}`;
  const rName = () => ({ first: rn(FIRST_NAMES), last: rn(LAST_NAMES) });
  const addMonths = (d, m) => { const r = new Date(d); r.setMonth(r.getMonth() + m); return r; };
  const fmt  = d => d.toISOString().split("T")[0];

  // ── Hiring velocity by month offset (0 = Jan 2015, 126 = Jun 2025) ─────────
  // Models realistic phases: founding → Series A/B → growth → COVID freeze →
  // post-COVID hypergrowth → 2022 plateau → 2023 layoff freeze → recovery
  function hiringWeight(mo) {
    if (mo <= 5)  return 0.07;                                        // Founding: skeleton crew
    if (mo <= 11) return 0.25 + (mo - 6) * 0.06;                     // Series A ramp (mid-2015)
    if (mo <= 23) return 0.65 + (mo - 12) * 0.07;                    // Series B acceleration (2016)
    if (mo <= 47) {                                                    // 2017-2018: steady, Q4 hiring spikes
      const q4Bonus = (mo % 12) >= 9 ? 0.5 : 0;
      return 1.3 + q4Bonus + Math.sin(mo * 0.55) * 0.25;
    }
    if (mo <= 59) return 1.9 + Math.sin(mo * 0.4) * 0.3;             // 2019: peak pre-COVID
    if (mo <= 62) return 0.6 - (mo - 59) * 0.18;                     // Early 2020: sudden drop
    if (mo <= 68) return 0.04;                                        // COVID freeze: Apr-Sep 2020
    if (mo <= 71) return 0.04 + (mo - 68) * 0.9;                     // Slow restart: Oct-Dec 2020
    if (mo <= 83) return 3.2 + Math.sin(mo * 0.8) * 0.7;             // 2021: hypergrowth surge
    if (mo <= 89) return 2.8 + Math.sin(mo * 0.4) * 0.5;             // H1 2022: still hot
    if (mo <= 95) return 1.8 - (mo - 89) * 0.15;                     // H2 2022: cooling
    if (mo <= 98) return 0.5 - (mo - 95) * 0.13;                     // Jan-Mar 2023: freeze begins
    if (mo <= 104) return 0.06;                                       // Apr-Sep 2023: near halt
    if (mo <= 110) return 0.15 + (mo - 104) * 0.12;                  // Q4 2023: cautious restart
    if (mo <= 120) return 0.9 + (mo - 110) * 0.06;                   // 2024: methodical recovery
    return 1.3 + Math.sin(mo * 0.5) * 0.15;                          // 2025: steady
  }

  // Termination probability based on when someone was hired
  function termProb(startMo) {
    if (startMo <= 12)              return 0.03;  // Early hires: committed
    if (startMo >= 69 && startMo <= 83) return 0.23; // Hypergrowth hires: many later laid off/quit
    if (startMo >= 84 && startMo <= 95) return 0.19; // 2022 cohort: hit by layoffs
    if (startMo >= 96 && startMo <= 104) return 0.05; // Almost nobody hired during freeze
    return 0.09;
  }

  // When did a terminated employee leave?
  function pickEndDate(startDate, startMo) {
    // 2023 layoff wave: anyone hired before the freeze may have been cut Jan-Jul 2023
    if (startMo < 96 && Math.random() < 0.40) {
      const d = addMonths(foundingDate, 96 + Math.floor(Math.random() * 7));
      return d < now ? d : null;
    }
    // Voluntary departure: 6-30 months after start
    const d = addMonths(startDate, 6 + Math.floor(Math.random() * 25));
    return d < now ? d : null;
  }

  // Weighted month picker for IC-level hires (months 18..125)
  const icWeights = [];
  for (let mo = 18; mo <= 125; mo++) icWeights.push({ mo, w: Math.max(0.01, hiringWeight(mo)) });
  const wTotal = icWeights.reduce((s, x) => s + x.w, 0);
  function pickHireMo() {
    let r = Math.random() * wTotal;
    for (const { mo, w } of icWeights) { r -= w; if (r <= 0) return mo; }
    return icWeights[icWeights.length - 1].mo;
  }

  // ── Build helpers ─────────────────────────────────────────────────────────
  const BND = { "C-Suite":"Band-E","SVP":"Band-D","VP":"Band-D","Director":"Band-C","Manager":"Band-B" };
  const rmo = (a,b) => a + Math.floor(Math.random()*(b-a+1));
  function mk(title, dept, fn, bg, mgrId, level, mo, locs) {
    const location = rn(locs||LOCATIONS);
    return {
      id: rid(), ...rName(), title, dept, fn, bg,
      managerId: mgrId, level, band: BND[level]||"Band-2",
      location, country: countryFor(location),
      employmentType: "FTE",
      startDate: fmt(addMonths(foundingDate, mo)),
      endDate: null, status: "Active",
      costCenter: `CC-${dept.slice(0,3).toUpperCase().replace(/ /g,"")}${nextId}`
    };
  }
  const HQ    = ["San Jose HQ"];
  const TECH  = ["San Jose HQ","Austin","Portland","Bangalore","Hsinchu"];
  const OPS   = ["Portland","Austin","Shanghai","Hsinchu","Bangalore"];
  const FIELD = LOCATIONS;

  // ── C-Suite ────────────────────────────────────────────────────────────────
  const CEO  = mk("CEO & Co-Founder",    "Corporate Strategy","G&A",              "Corporate",null,   "C-Suite",0,  HQ);
  const CTO  = mk("CTO & Co-Founder",    "IC Design",        "Engineering",       "Corporate",CEO.id, "C-Suite",0,  HQ);
  const COO  = mk("COO",                 "Manufacturing",    "Operations",        "Corporate",CEO.id, "C-Suite",2,  HQ);
  const CFO  = mk("CFO",                 "Finance",          "G&A",               "Corporate",CEO.id, "C-Suite",2,  HQ);
  const CRO  = mk("CRO",                 "Sales",            "Sales & Marketing", "Corporate",CEO.id, "C-Suite",5,  HQ);
  const CHRO = mk("CHRO",                "HR",               "G&A",               "Corporate",CEO.id, "C-Suite",7,  HQ);
  const CPO  = mk("CPO",                 "Corporate Strategy","G&A",              "Corporate",CEO.id, "C-Suite",10, HQ);
  employees.push(CEO,CTO,COO,CFO,CRO,CHRO,CPO);

  // ── Org topology: [parentExec, svpTitle, svpDept, fn, bg, locs,
  //                   [ [vpTitle, vpDept, [dirTitle, ...]], ... ] ]
  // Directors are created from the explicit list; managers + ICs are generated below.
  const ORG = [
    [CTO,"SVP, Silicon Engineering","IC Design","Engineering","Automotive BU",TECH,[
      ["VP, RTL & Logic Design","IC Design",              ["Director, Advanced Node RTL","Director, CPU Subsystems","Director, IP & Interface Blocks","Director, GPU & NPU Cores","Director, SoC Integration"]],
      ["VP, Analog & Mixed-Signal","IC Design",           ["Director, Analog Front-End","Director, Mixed-Signal IP","Director, High-Speed SerDes","Director, PLL & Clock Distribution"]],
      ["VP, Physical Design","Physical Design",           ["Director, P&R Implementation","Director, Timing Closure","Director, Power Integrity","Director, DFM & Yield","Director, Package & Substrate"]],
    ]],
    [CTO,"SVP, Verification & Validation","Verification","Engineering","Data Center BU",TECH,[
      ["VP, Design Verification","Verification",          ["Director, UVM & Testbench Infra","Director, Formal Verification","Director, Coverage Closure","Director, System-Level Verification"]],
      ["VP, Emulation & Prototyping","Verification",      ["Director, FPGA Prototyping","Director, Emulation Platform","Director, Pre-Silicon SW Validation"]],
      ["VP, Silicon Validation","Product Engineering",    ["Director, Pre-Silicon Validation","Director, Post-Silicon Debug","Director, Characterization Eng","Director, Bring-Up & DVT"]],
    ]],
    [CTO,"SVP, Software & Systems","Software","Engineering","Automotive BU",TECH,[
      ["VP, Embedded Software","Software",                ["Director, Firmware Architecture","Director, Driver Development","Director, BSP & OS","Director, Security & Cryptography SW"]],
      ["VP, Systems Architecture","Systems Engineering",  ["Director, Platform Architecture","Director, Memory & Interconnect","Director, Algorithm Engineering","Director, Functional Safety"]],
    ]],
    [CTO,"SVP, Product & Test Eng","Test Engineering","Engineering","Data Center BU",TECH,[
      ["VP, Test Engineering","Test Engineering",         ["Director, ATE & Test Systems","Director, DFT Architecture","Director, Test Methodology","Director, Production Test Eng"]],
      ["VP, Product Engineering","Product Engineering",   ["Director, Silicon Validation","Director, Application Engineering","Director, Customer Board Support"]],
    ]],
    [COO,"SVP, Manufacturing Ops","Manufacturing","Operations","Corporate",OPS,[
      ["VP, Fab Operations","Manufacturing",              ["Director, Front-End Process","Director, Equipment Engineering","Director, Yield Enhancement","Director, Fab Planning"]],
      ["VP, Assembly & Backend Test","Manufacturing",     ["Director, Backend Operations","Director, Packaging Engineering","Director, Final Test Operations"]],
    ]],
    [COO,"SVP, Supply Chain","Supply Chain","Operations","Corporate",OPS,[
      ["VP, Procurement & Sourcing","Supply Chain",       ["Director, Foundry & EDA Procurement","Director, Component Sourcing","Director, Supplier Development","Director, Contracts"]],
      ["VP, Logistics & Planning","Supply Chain",         ["Director, Demand Planning","Director, Global Logistics","Director, Inventory Management"]],
    ]],
    [COO,"SVP, Quality & Reliability","Quality & Reliability","Operations","Corporate",OPS,[
      ["VP, Quality Engineering","Quality & Reliability", ["Director, Product Quality","Director, FMEA & FTA","Director, Customer Quality Eng","Director, AEC-Q Compliance"]],
      ["VP, Reliability Engineering","Quality & Reliability",["Director, HTOL & Reliability","Director, Failure Analysis","Director, Environmental Qualification"]],
    ]],
    [CFO,"SVP, Finance","Finance","G&A","Corporate",HQ,[
      ["VP, FP&A","Finance",                              ["Director, Corporate FP&A","Director, BU Finance Partners","Director, Investor Relations"]],
      ["VP, Accounting & Tax","Finance",                  ["Director, Revenue & Cost Accounting","Director, Tax & Treasury","Director, Internal Audit & Controls"]],
    ]],
    [CRO,"SVP, Worldwide Sales","Sales","Sales & Marketing","Corporate",FIELD,[
      ["VP, Americas Sales","Sales",                      ["Director, Enterprise & Tier-1 Accounts","Director, Regional Sales West","Director, Regional Sales East","Director, OEM & Channel"]],
      ["VP, Asia Pacific Sales","Sales",                  ["Director, Japan & Korea","Director, Greater China","Director, SE Asia & ANZ","Director, India"]],
      ["VP, EMEA Sales","Sales",                          ["Director, Europe Accounts","Director, MEA"]],
      ["VP, Field Applications","Field Applications",     ["Director, Automotive FAE","Director, Data Center FAE","Director, Industrial FAE","Director, Consumer FAE"]],
    ]],
    [CRO,"SVP, Marketing","Marketing","Sales & Marketing","Corporate",HQ,[
      ["VP, Product Marketing","Marketing",               ["Director, Automotive Segment","Director, Data Center Segment","Director, Consumer & IoT Segment","Director, Industrial Segment"]],
      ["VP, Brand & Communications","Marketing",          ["Director, Brand & PR","Director, Digital & Content","Director, Events & Sponsorships"]],
      ["VP, Applications Engineering","Applications",     ["Director, Reference Design Programs","Director, Customer Solutions","Director, Technical Marketing"]],
    ]],
    [CHRO,"SVP, People Operations","HR","G&A","Corporate",HQ,[
      ["VP, Talent Acquisition","HR",                     ["Director, Technical Recruiting","Director, G&A & Sales Recruiting","Director, University Programs"]],
      ["VP, HR Business Partners","HR",                   ["Director, Engineering HRBP","Director, G&A HRBP","Director, International HRBP"]],
      ["VP, Total Rewards & L&D","HR",                    ["Director, Compensation & Benefits","Director, Learning & Development","Director, DEI Programs"]],
    ]],
    [CPO,"SVP, Corporate Strategy","Corporate Strategy","G&A","Corporate",HQ,[
      ["VP, Corporate Development","Corporate Strategy",  ["Director, M&A","Director, Strategic Partnerships","Director, Venture Investments"]],
      ["VP, IT & Enterprise Systems","IT",                ["Director, IT Infrastructure","Director, Cybersecurity","Director, Enterprise Applications","Director, Cloud & DevOps"]],
      ["VP, Legal & Compliance","Legal",                  ["Director, IP & Patents","Director, Corporate & Contract Law","Director, Export Compliance"]],
    ]],
  ];

  // Build SVP → VP → Director layers
  const svpEmps = [], vpEmps = [], dirEmps = [];
  ORG.forEach(([parent, svpTitle, svpDept, svpFn, svpBg, svpLocs, vpList]) => {
    const svp = mk(svpTitle, svpDept, svpFn, svpBg, parent.id, "SVP", rmo(5,18), svpLocs);
    employees.push(svp); svpEmps.push(svp);
    vpList.forEach(([vpTitle, vpDept, dirTitles]) => {
      const vp = mk(vpTitle, vpDept, svpFn, svpBg, svp.id, "VP", rmo(10,30), svpLocs);
      employees.push(vp); vpEmps.push(vp);
      // Use most (but not always all) director slots for organic variation
      const n = Math.max(1, Math.round(dirTitles.length * (0.65 + Math.random() * 0.35)));
      [...dirTitles].sort(()=>Math.random()-0.5).slice(0,n).forEach(dirTitle => {
        const dir = mk(dirTitle, vpDept, svpFn, svpBg, vp.id, "Director", rmo(14,52), svpLocs);
        employees.push(dir); dirEmps.push(dir);
      });
    });
  });

  // ── Manager layer: 2–5 per Director ───────────────────────────────────────
  const MGR_POOL = {
    "IC Design":            ["Manager, RTL Design","Manager, Analog Circuit Design","Manager, Mixed-Signal","Manager, IP Development","Manager, Front-End Architecture","Manager, Logic Implementation","Manager, SoC Design"],
    "Verification":         ["Manager, UVM Testbench","Manager, Formal Methods","Manager, Regression","Manager, Coverage Analysis","Manager, Emulation Team","Manager, System Verification"],
    "Physical Design":      ["Manager, P&R","Manager, Timing Analysis","Manager, Power Planning","Manager, DRC & LVS","Manager, Physical Verification","Manager, Floorplan"],
    "Software":             ["Manager, Firmware Engineering","Manager, Driver Stack","Manager, BSP Engineering","Manager, Security SW","Manager, Platform SW","Manager, SDK Development"],
    "Systems Engineering":  ["Manager, Systems Architecture","Manager, Algorithm Development","Manager, Platform Definition","Manager, Memory Subsystems","Manager, Interconnect Design"],
    "Test Engineering":     ["Manager, ATE Engineering","Manager, DFT Design","Manager, Test Development","Manager, Characterization","Manager, Production Test","Manager, Test Methodology"],
    "Product Engineering":  ["Manager, Silicon Validation","Manager, Bring-Up Team","Manager, Product Qualification","Manager, Application Notes","Manager, Customer Evaluation"],
    "Manufacturing":        ["Manager, Fab Line Operations","Manager, Equipment Engineering","Manager, Yield Engineering","Manager, Process Control","Manager, Backend Ops","Manager, Packaging Engineering","Manager, Scheduling"],
    "Supply Chain":         ["Manager, Foundry Procurement","Manager, Component Sourcing","Manager, Supplier Quality","Manager, Demand Planning","Manager, Logistics Operations","Manager, Inventory Control","Manager, Contracts"],
    "Quality & Reliability":["Manager, Product Quality","Manager, Reliability Engineering","Manager, Failure Analysis","Manager, Environmental Test","Manager, Customer Quality","Manager, Qual Compliance","Manager, FMEA"],
    "Sales":                ["Manager, Enterprise Accounts","Manager, Regional Sales","Manager, Channel Sales","Manager, Inside Sales","Manager, Sales Operations","Manager, Biz Dev"],
    "Field Applications":   ["Manager, FAE Team West","Manager, FAE Team East","Manager, FAE Team APAC","Manager, Solutions Engineering","Manager, Customer Success"],
    "Marketing":            ["Manager, Product Marketing","Manager, Digital Marketing","Manager, Content Strategy","Manager, Brand Marketing","Manager, Event Marketing","Manager, Analyst Relations"],
    "Applications":         ["Manager, Reference Design","Manager, Eval Kit Programs","Manager, Customer Solutions","Manager, Demo & Benchmarking"],
    "Finance":              ["Manager, FP&A","Manager, BU Finance","Manager, Revenue Recognition","Manager, Tax Operations","Manager, Internal Audit"],
    "HR":                   ["Manager, Technical Recruiting","Manager, G&A Recruiting","Manager, Compensation","Manager, Benefits","Manager, HRBP Programs","Manager, L&D"],
    "IT":                   ["Manager, IT Operations","Manager, Cybersecurity Ops","Manager, Cloud Infrastructure","Manager, Enterprise Apps","Manager, DevOps Platform"],
    "Legal":                ["Manager, IP Portfolio","Manager, Commercial Contracts","Manager, Export Controls","Manager, Corporate Governance"],
    "Corporate Strategy":   ["Manager, M&A Integration","Manager, Strategic Partnerships","Manager, Market Intelligence","Manager, Corporate Planning"],
  };

  const mgrEmps = [];
  dirEmps.forEach(dir => {
    const numMgrs = Math.random() < 0.07 ? 1 : rmo(2, 5);
    const pool = MGR_POOL[dir.dept] || [`Manager, ${dir.dept}`];
    const used = new Set();
    for (let m = 0; m < numMgrs; m++) {
      const avail = pool.filter(t => !used.has(t));
      const title = rn(avail.length ? avail : pool);
      used.add(title);
      const mgrMo = Math.random() < 0.3 ? rmo(69,105) : rmo(18,68);
      const mgr = mk(title, dir.dept, dir.fn, dir.bg, dir.id, "Manager", mgrMo, null);
      mgr.location = dir.location; // managers co-locate with their director
      employees.push(mgr); mgrEmps.push(mgr);
    }
  });

  // ── IC layer: 1–10 per Manager, weighted toward 4–7 ──────────────────────
  function pickSpan() {
    const r = Math.random();
    if (r < 0.04) return 1;  if (r < 0.09) return 2;  if (r < 0.18) return 3;
    if (r < 0.36) return 4;  if (r < 0.57) return 5;  if (r < 0.73) return 6;
    if (r < 0.84) return 7;  if (r < 0.91) return 8;  if (r < 0.96) return 9;
    return 10;
  }
  const IC_LV = ["IC1","IC1","IC2","IC2","IC3","IC3","IC4","IC5"]; // skew junior/mid
  const IC_BD = { "IC1":"Band-1","IC2":"Band-1","IC3":"Band-2","IC4":"Band-3","IC5":"Band-4","IC6":"Band-5" };

  mgrEmps.forEach(mgr => {
    const span = pickSpan();
    const titles = SEMI_TITLES[mgr.dept] || [`${mgr.dept} Specialist`];
    for (let i = 0; i < span; i++) {
      const startMo = pickHireMo();
      const startDate = addMonths(foundingDate, startMo);
      const level = rn(IC_LV);
      let endDate = null, status = "Active";
      if (Math.random() < termProb(startMo)) {
        const d = pickEndDate(startDate, startMo);
        if (d) { endDate = d; status = "Terminated"; }
      }
      const icLoc = Math.random() < 0.78 ? mgr.location : rn(LOCATIONS);
      // ~12% of ICs are contractors — concentrated in offshore locations
      const contractBias = ["Bangalore","Hsinchu","Shanghai"].includes(icLoc) ? 0.20 : 0.08;
      const employmentType = Math.random() < contractBias ? "Contract" : "FTE";
      employees.push({
        id: rid(), ...rName(), dept: mgr.dept, title: rn(titles),
        bg: mgr.bg, fn: mgr.fn, managerId: mgr.id,
        location: icLoc, country: countryFor(icLoc),
        employmentType,
        startDate: fmt(startDate), endDate: endDate ? fmt(endDate) : null, status, level,
        band: IC_BD[level] || "Band-2", costCenter: mgr.costCenter,
      });
    }
  });

  // ── Terminate some managers to model historical attrition (ICs safely reassigned) ─
  mgrEmps.forEach(mgr => {
    const mgrMo = Math.round((new Date(mgr.startDate) - foundingDate) / (1000*60*60*24*30.44));
    if (Math.random() >= termProb(mgrMo) * 0.38) return;
    const d = pickEndDate(new Date(mgr.startDate), mgrMo);
    if (!d) return;
    // Reassign this manager's active ICs to another active manager in the same dept
    const peers = mgrEmps.filter(m => m.id !== mgr.id && m.dept === mgr.dept && m.status === "Active");
    if (!peers.length) return;
    const replacement = rn(peers);
    employees.forEach(e => { if (e.managerId === mgr.id && e.status === "Active") e.managerId = replacement.id; });
    mgr.endDate = fmt(d); mgr.status = "Terminated";
  });

  // ── Inject realistic org weirdness ────────────────────────────────────────
  const bus = ["Automotive BU","Data Center BU"];

  // Weird #1: One Director was previously orphaned; reassign them to their proper VP
  // (same VP as a peer Director) so no level is skipped in the reporting chain.
  if (dirEmps.length >= 6) {
    const orphan = dirEmps[dirEmps.length - 2];
    const anchor = dirEmps[1];
    // Report to the anchor's VP (one level up), not to the peer Director
    orphan.managerId = anchor.managerId;
    orphan.title = `Sr. ${orphan.title}`;
  }

  // Weird #2: 4 long-tenured ICs who were never promoted — stagnation.
  employees
    .filter(e => e.status === "Active" && ["IC3","IC4","IC5"].includes(e.level)
      && new Date(e.startDate) < addMonths(foundingDate, 28))
    .slice(0, 4)
    .forEach(e => { e.level = rn(["IC1","IC2"]); e.band = "Band-1"; });

  // Weird #3: One VP has "Band-C" — startup-era title inflation never cleaned up.
  const titleInflatedVP = employees.find(e => e.level === "VP" && new Date(e.startDate) > new Date("2021-01-01"));
  if (titleInflatedVP) { titleInflatedVP.band = "Band-C"; titleInflatedVP.title = "VP of Partnerships & Ecosystem"; }

  // Weird #4: 3 engineers with hyper-specific consultant-converted-to-FTE titles.
  const consultantTitles = [
    "Applied Research Engineer III (TSMC N3 Programs)",
    "Process Integration Specialist – 3nm Pathfinding",
    "Sr. DFT Architect, Automotive Functional Safety (ISO 26262)",
  ];
  employees.filter(e => e.status === "Active" && e.level === "IC4").slice(0, 3)
    .forEach((e, i) => { e.title = consultantTitles[i]; });

  // Weird #5: 3 active ICs with BU tag mismatched from their manager's BU.
  // Reorg announced but never reflected in the system.
  employees
    .filter(e => e.status === "Active" && e.level.startsWith("IC") && e.bg !== "Corporate")
    .slice(0, 3)
    .forEach((e, i) => { e.bg = bus[(bus.indexOf(e.bg) + 1 + i) % bus.length]; });

  // Weird #6: One IC5 in IC Design carries an unofficial "Acting Manager" title.
  const accidentalMgr = employees.find(e => e.status === "Active" && e.level === "IC5" && e.dept === "IC Design");
  if (accidentalMgr) accidentalMgr.title = "Engineering Manager, Advanced RTL (Acting)";

  // Weird #7: One manager hired within the last 3 years whose two reports have
  // 7+ years tenure — common when a team lead is promoted externally over veterans.
  const freshMgr = mgrEmps.find(m => {
    const mo = (now - new Date(m.startDate)) / (1000*60*60*24*30);
    return mo >= 18 && mo <= 36;
  });
  if (freshMgr) {
    const veterans = employees.filter(e => e.status === "Active" && e.level.startsWith("IC")
      && new Date(e.startDate) < addMonths(foundingDate, 18));
    veterans.slice(0, 2).forEach(v => { v.managerId = freshMgr.id; });
  }

  // Weird #8: Seed 8 confirmed high-flight-risk ICs.
  // Create 2 brand-new managers (hired Jan 2025, <6 mo ago) and assign stagnant
  // IC4/5 employees to them. This produces the combo of:
  //   • 3-5yr tenure (moderate tenureRisk), • IC4+ stagnation, • new manager risk
  // guaranteed to score in the high / upper-medium band.
  const frDirs = dirEmps.filter(d => d.status === "Active").slice(0, 2);
  const flightRiskMgrs = frDirs.map(dir => {
    const nm = mk("Manager, " + dir.dept, dir.dept, dir.fn, dir.bg, dir.id, "Manager", 120, null);
    nm.startDate = "2025-01-15"; // 5 months before "now" (Jun 2025) → mgrRisk=25
    nm.location = dir.location;
    employees.push(nm);
    return nm;
  });
  // Find stagnant IC4/IC5s hired in the 2021 hypergrowth window (3-4yr tenure)
  const stagnantICs = employees.filter(e =>
    e.status === "Active" &&
    ["IC4","IC5"].includes(e.level) &&
    new Date(e.startDate) <= addMonths(foundingDate, 86) &&
    new Date(e.startDate) >= addMonths(foundingDate, 72)
  ).slice(0, 8);
  stagnantICs.forEach((e, i) => {
    e.managerId = flightRiskMgrs[i % 2].id;
    // Ensure startDate is firmly in the 3-5yr stagnation window
    if (new Date(e.startDate) > addMonths(foundingDate, 84)) {
      e.startDate = fmt(addMonths(foundingDate, 78 + (i % 5)));
    }
  });
  // Add 5 additional medium-risk employees: ICs in the 6-18mo new-hire window
  // with a department that had heavy attrition (Software, Verification)
  const newHireRisk = employees.filter(e =>
    e.status === "Active" && e.level.startsWith("IC") &&
    ["Software","Verification"].includes(e.dept)
  ).slice(0, 5);
  const riskStartDates = ["2024-05-10","2024-07-22","2024-09-03","2024-10-14","2024-06-18"];
  newHireRisk.forEach((e, i) => { e.startDate = riskStartDates[i]; });

  // Weird #9: 3 managers with >12 direct reports each (overloaded span hotspots)
  const overloadedMgrs = mgrEmps.filter(m => m.status === "Active").slice(10, 13);
  overloadedMgrs.forEach(mgr => {
    const extras = Math.floor(Math.random() * 4) + 6;
    const titles = SEMI_TITLES[mgr.dept] || [`${mgr.dept} Specialist`];
    for (let i = 0; i < extras; i++) {
      const startMo = rmo(40, 100);
      employees.push({
        id: rid(), ...rName(), dept: mgr.dept, title: rn(titles),
        bg: mgr.bg, fn: mgr.fn, managerId: mgr.id,
        location: mgr.location,
        startDate: fmt(addMonths(foundingDate, startMo)), endDate: null, status: "Active",
        level: rn(["IC2","IC3","IC4"]), band: "Band-2", costCenter: mgr.costCenter,
      });
    }
  });

  // Weird #10: 5 single-report bottlenecks (SPOF chains)
  const spofDirs = dirEmps.filter(d => d.status === "Active").slice(6, 11);
  spofDirs.forEach(dir => {
    const soloMgr = mk("Manager, " + dir.dept, dir.dept, dir.fn, dir.bg, dir.id, "Manager", rmo(24, 80), null);
    soloMgr.location = dir.location;
    employees.push(soloMgr);
    employees.filter(e => e.managerId === dir.id && e.id !== soloMgr.id && e.status === "Active")
      .forEach(e => { e.managerId = soloMgr.id; });
  });

  // Weird #11: Deep chain (depth > 7) — bureaucracy warning
  let deepParent = dirEmps.find(d => d.status === "Active" && d.dept === "Manufacturing");
  if (deepParent) {
    for (let i = 0; i < 4; i++) {
      const deep = mk(`Sub-manager L${i+1}, ` + deepParent.dept, deepParent.dept, deepParent.fn, deepParent.bg, deepParent.id, "Manager", rmo(30, 90), null);
      deep.location = deepParent.location;
      employees.push(deep);
      const titles = SEMI_TITLES[deepParent.dept] || ["Specialist"];
      for (let j = 0; j < rmo(2, 3); j++) {
        employees.push({
          id: rid(), ...rName(), dept: deepParent.dept, title: rn(titles),
          bg: deepParent.bg, fn: deepParent.fn, managerId: deep.id,
          location: deep.location,
          startDate: fmt(addMonths(foundingDate, rmo(50, 110))), endDate: null, status: "Active",
          level: rn(["IC1","IC2","IC3"]), band: "Band-1", costCenter: deep.costCenter,
        });
      }
      deepParent = deep;
    }
  }

  // Weird #12: 6 more stagnant IC4/IC5s in high-attrition depts for flight risk
  employees.filter(e =>
    e.status === "Active" && ["IC3","IC4"].includes(e.level) &&
    ["IC Design","Physical Design","Test Engineering"].includes(e.dept)
  ).slice(0, 6).forEach((e, i) => {
    e.level = "IC5"; e.band = "Band-4";
    e.startDate = fmt(addMonths(foundingDate, 30 + (i * 3)));
  });

  // Weird #13: Rapid growth team — one manager hired 8 people in last 4 months
  const rapidGrowthDir = dirEmps.find(d => d.status === "Active" && d.dept === "Software");
  if (rapidGrowthDir) {
    const rapidMgr = mk("Manager, Platform Engineering", "Software", rapidGrowthDir.fn, rapidGrowthDir.bg, rapidGrowthDir.id, "Manager", 115, null);
    rapidMgr.location = "Austin"; rapidMgr.startDate = "2024-06-01";
    employees.push(rapidMgr);
    for (let i = 0; i < 8; i++) {
      employees.push({
        id: rid(), ...rName(), dept: "Software", title: rn(SEMI_TITLES["Software"]),
        bg: rapidGrowthDir.bg, fn: rapidGrowthDir.fn, managerId: rapidMgr.id,
        location: "Austin",
        startDate: fmt(addMonths(foundingDate, 122 + Math.floor(i / 2))), endDate: null, status: "Active",
        level: rn(["IC1","IC2"]), band: "Band-1", costCenter: rapidMgr.costCenter,
      });
    }
  }

  // Weird #14: 4 more IC employees with very recent starts under new managers
  mgrEmps.filter(m => m.status === "Active" && new Date(m.startDate) > addMonths(foundingDate, 115))
    .slice(0, 4).forEach((mgr, i) => {
      const titles = SEMI_TITLES[mgr.dept] || ["Specialist"];
      for (let j = 0; j < 3; j++) {
        employees.push({
          id: rid(), ...rName(), dept: mgr.dept, title: rn(titles),
          bg: mgr.bg, fn: mgr.fn, managerId: mgr.id, location: mgr.location,
          startDate: fmt(addMonths(foundingDate, 120 + i)), endDate: null, status: "Active",
          level: rn(["IC2","IC3"]), band: "Band-2", costCenter: mgr.costCenter,
        });
      }
    });

  // Weird #15: Managers-only chain — bureaucracy flag
  const bureauDir = dirEmps.find(d => d.status === "Active" && d.dept === "Supply Chain");
  if (bureauDir) {
    const midMgr = mk("Manager, Supply Planning", "Supply Chain", bureauDir.fn, bureauDir.bg, bureauDir.id, "Manager", 40, null);
    midMgr.location = bureauDir.location; employees.push(midMgr);
    for (let i = 0; i < 3; i++) {
      const subMgr = mk(`Lead, Supply Ops ${i+1}`, "Supply Chain", bureauDir.fn, bureauDir.bg, midMgr.id, "Manager", rmo(50,80), null);
      subMgr.location = bureauDir.location; employees.push(subMgr);
      for (let j = 0; j < rmo(2,4); j++) {
        employees.push({
          id: rid(), ...rName(), dept: "Supply Chain", title: rn(SEMI_TITLES["Supply Chain"]),
          bg: bureauDir.bg, fn: bureauDir.fn, managerId: subMgr.id, location: bureauDir.location,
          startDate: fmt(addMonths(foundingDate, rmo(50,110))), endDate: null, status: "Active",
          level: rn(["IC1","IC2","IC3"]), band: "Band-2", costCenter: subMgr.costCenter,
        });
      }
    }
  }

  // Weird #16: Peer-departure wave in Verification — a new external manager was
  // brought in (Jan 2025) as the team unravelled: 5 members left in the past 12 months.
  // The 3 active survivors each see >40% peer departure → disruptionRisk + new-manager
  // risk + high-tenure-risk new-hire window → pushes several into high-risk territory.
  const wavDir = dirEmps.find(d => d.status === "Active" && d.dept === "Verification");
  if (wavDir) {
    const wavMgr = mk("Manager, Silicon Verification", "Verification", wavDir.fn, wavDir.bg, wavDir.id, "Manager", 80, null);
    wavMgr.startDate = "2025-01-20"; // external hire 4.5 months before FIXED_NOW → mgrRisk = 25
    wavMgr.location = wavDir.location; employees.push(wavMgr);
    const vTitles = SEMI_TITLES["Verification"];
    // 5 teammates who departed in the past 12 months (all endDates within 12mo of Jun 2025)
    ["2024-07-05","2024-08-20","2024-10-14","2025-01-08","2025-04-01"].forEach((endDate, i) => {
      employees.push({
        id: rid(), ...rName(), dept: "Verification", title: rn(vTitles),
        bg: wavDir.bg, fn: wavDir.fn, managerId: wavMgr.id, location: wavMgr.location,
        startDate: fmt(addMonths(foundingDate, 45 + i * 8)), endDate, status: "Terminated",
        level: rn(["IC3","IC4"]), band: "Band-2", costCenter: wavMgr.costCenter,
      });
    });
    // 3 active survivors — each sees peers = 5 terminated + 2 other actives = 7 peers,
    // recentDeps = 5, ratio = 5/7 = 0.71 > 0.4 → disruptionRisk = 20
    // startDate in the 6-18mo high-tenure-risk window (80pts)
    ["2024-02-10","2024-04-22","2024-01-07"].forEach(startDate => {
      employees.push({
        id: rid(), ...rName(), dept: "Verification", title: rn(vTitles),
        bg: wavDir.bg, fn: wavDir.fn, managerId: wavMgr.id, location: wavMgr.location,
        startDate, endDate: null, status: "Active",
        level: "IC4", band: "Band-3", costCenter: wavMgr.costCenter,
      });
    });
  }

  // Weird #17: Vesting-cliff cluster in IC Design — 5 IC4s hired 30–34 months ago,
  // sitting in the 18-36mo tenure band (55pts tenureRisk) AND crossing the 30-month
  // threshold where stagnationRisk kicks in (20pts). Classic "next promotion or next exit"
  // signal that often precedes attrition spikes.
  const cliffDir = dirEmps.find(d => d.status === "Active" && d.dept === "IC Design"
    && d.id !== (dirEmps.find(x => x.dept === "IC Design" && x.status === "Active") || {}).id);
  const cliffDirFallback = dirEmps.find(d => d.status === "Active" && d.dept === "IC Design");
  const cliffDirActual = cliffDir || cliffDirFallback;
  if (cliffDirActual) {
    const cliffMgr = mk("Manager, Advanced Node Signoff", "IC Design", cliffDirActual.fn, cliffDirActual.bg, cliffDirActual.id, "Manager", 72, null);
    cliffMgr.location = cliffDirActual.location; employees.push(cliffMgr);
    const cTitles = SEMI_TITLES["IC Design"];
    // Hardcoded start dates: 30-34 months before FIXED_NOW (Jun 2025) = Aug-Dec 2022
    ["2022-12-01","2022-10-15","2022-09-01","2022-08-10","2022-11-20"].forEach(startDate => {
      employees.push({
        id: rid(), ...rName(), dept: "IC Design", title: rn(cTitles),
        bg: cliffDirActual.bg, fn: cliffDirActual.fn, managerId: cliffMgr.id,
        location: cliffDirActual.location,
        startDate, endDate: null, status: "Active",
        level: "IC4", band: "Band-3", costCenter: cliffMgr.costCenter,
      });
    });
  }

  // Weird #18: Counter-offer survivors in Sales — IC5 reps with 48–57 months tenure
  // who have stayed through heavy department attrition. Their combination of
  // peak stagnationRisk (IC5 > 36mo = 60pts) + elevated deptRisk creates a
  // persistent medium-high signal that grows every month no promotion arrives.
  const survDir = dirEmps.find(d => d.status === "Active" && d.dept === "Sales");
  if (survDir) {
    const survMgr = mk("Manager, Strategic Accounts West", "Sales", survDir.fn, survDir.bg, survDir.id, "Manager", 90, null);
    survMgr.location = "San Jose"; employees.push(survMgr);
    const sTitles = SEMI_TITLES["Sales"];
    // 48, 51, 54, 57 months before Jun 2025 = Jun/Mar/Dec 2021, Sep 2020
    ["2021-06-01","2021-03-01","2020-12-01","2020-09-01"].forEach(startDate => {
      employees.push({
        id: rid(), ...rName(), dept: "Sales", title: rn(sTitles),
        bg: survDir.bg, fn: survDir.fn, managerId: survMgr.id, location: survMgr.location,
        startDate, endDate: null, status: "Active",
        level: "IC5", band: "Band-4", costCenter: survMgr.costCenter,
      });
    });
  }

  // Weird #19: External manager placed over veteran engineers — a Director brought
  // in an external hire (Feb 2025) as manager over a team of IC4 veterans with
  // 48–58 months tenure. Each veteran combines mgrRisk (new mgr <6mo = 25pts) +
  // stagnationRisk (IC4 > 36mo = 60pts) + moderate tenureRisk (35pts for 36-60mo).
  const vetDir = dirEmps.find(d => d.status === "Active" && d.dept === "Software"
    && d.id !== rapidGrowthDir?.id);
  if (vetDir) {
    const extMgr = mk("Manager, Platform Architecture", "Software", vetDir.fn, vetDir.bg, vetDir.id, "Manager", 96, null);
    extMgr.startDate = "2025-02-03"; // 4 months before FIXED_NOW → mgrRisk = 25
    extMgr.location = vetDir.location; employees.push(extMgr);
    const swTitles = SEMI_TITLES["Software"];
    // 48–58 months before Jun 2025 = Jun 2021 – Aug 2020
    ["2021-06-01","2021-03-15","2021-01-01","2020-10-20","2020-08-01"].forEach(startDate => {
      employees.push({
        id: rid(), ...rName(), dept: "Software", title: rn(swTitles),
        bg: vetDir.bg, fn: vetDir.fn, managerId: extMgr.id, location: vetDir.location,
        startDate, endDate: null, status: "Active",
        level: "IC4", band: "Band-3", costCenter: extMgr.costCenter,
      });
    });
  }

  // ── Executive Assistants / Chiefs of Staff attached to senior leaders ──
  const csuite = [CEO, CTO, COO, CFO, CRO, CHRO, CPO];
  const assistantLeaders = [
    ...csuite,
    ...svpEmps.filter((_, i) => i % 2 === 0),   // ~half of SVPs
    ...vpEmps.filter((_, i) => i % 5 === 0),     // a handful of VPs
  ];
  assistantLeaders.forEach(leader => {
    const isExec = leader.level === "C-Suite";
    employees.push({
      id: rid(), ...rName(),
      dept: leader.dept,
      title: isExec ? rn(["Chief of Staff", "Executive Assistant", "Sr. Executive Assistant"]) : "Executive Assistant",
      bg: leader.bg, fn: "G&A", managerId: leader.id,
      location: leader.location, country: leader.country || countryFor(leader.location),
      employmentType: "FTE",
      startDate: fmt(addMonths(foundingDate, rmo(6, 90))), endDate: null, status: "Active",
      level: "IC4", band: "Band-3", costCenter: leader.costCenter, isAssistant: true,
    });
  });

  // ── Senior ICs reporting directly to leaders (skip-level: Directors & VPs) ──
  const ADVISOR_TITLES = ["Principal Engineer", "Technical Advisor", "Staff Technical Program Manager",
    "Principal Architect", "Special Projects Lead", "Senior Staff Engineer"];
  const skipLeaders = [
    ...dirEmps.filter((d, i) => d.status === "Active" && i % 3 === 0),
    ...vpEmps.filter((_, i) => i % 3 === 1),
  ];
  skipLeaders.forEach(leader => {
    const n = rmo(1, 2);
    for (let i = 0; i < n; i++) {
      const lvl = rn(["IC4", "IC5", "IC5"]);
      employees.push({
        id: rid(), ...rName(),
        dept: leader.dept, title: rn(ADVISOR_TITLES),
        bg: leader.bg, fn: leader.fn, managerId: leader.id,
        location: leader.location, country: leader.country || countryFor(leader.location),
        employmentType: "FTE",
        startDate: fmt(addMonths(foundingDate, rmo(12, 110))), endDate: null, status: "Active",
        level: lvl, band: lvl === "IC5" ? "Band-4" : "Band-3", costCenter: leader.costCenter,
      });
    }
  });

  // ── Normalize: ensure every employee has country + employmentType ──
  // Late-injected "weirdness" employees skip the mk() helper, so backfill here.
  employees.forEach(e => {
    if (!e.country) e.country = countryFor(e.location);
    if (!e.employmentType) {
      // Contract workers concentrate in offshore tech depts and IC ranks
      const isOffshore = ["Bangalore","Hsinchu","Shanghai"].includes(e.location);
      const isIC       = e.level && e.level.startsWith("IC");
      const bias = isOffshore && isIC ? 0.20 : isIC ? 0.08 : 0.02;
      e.employmentType = Math.random() < bias ? "Contract" : "FTE";
    }
  });

  // ── Derive Business Unit (SVP org) & Department (VP org) from the org chart ──
  // BU = the group under the CTO / C-suite (SVP level); Department = one level deeper
  // (VP org). The original discipline taxonomy is preserved in `taxo` and the legacy
  // product-BU tag in `productBU` so coverage / pipeline / metrics keep working.
  {
    const byId = {};
    employees.forEach(e => { byId[e.id] = e; });
    const cleanOrg = t => (t || "").replace(/^(SVP|EVP|VP)\b[.,]?\s*(of\s+)?/i, "").replace(/\s*&\s*Co-?Founder/i, "").trim() || t;
    const ancestorAtLevel = (e, lvl) => {
      let cur = e, guard = 0;
      while (cur && guard++ < 40) {
        if (cur.level === lvl) return cur;
        cur = cur.managerId ? byId[cur.managerId] : null;
      }
      return null;
    };
    employees.forEach(e => {
      const svp = ancestorAtLevel(e, "SVP");
      const vp  = ancestorAtLevel(e, "VP");
      e.taxo = e.taxo || e.dept;          // preserve discipline taxonomy
      e.productBU = e.productBU || e.bg;  // preserve legacy product-BU tag
      e.bucket = e.bucket || e.fn;        // preserve broad function bucket (Eng/R&D/G&A/...)
      e.bg = svp ? cleanOrg(svp.title) : "Executive Office";
      e.dept = e.level === "C-Suite" ? "Executive Office"
             : vp  ? cleanOrg(vp.title)
             : svp ? cleanOrg(svp.title)
             : "Executive Office";
      e.fn = jobFamily(e.title, e.taxo);  // Discipline = granular job family
    });
    // Stable colors for the derived Business Unit & Department values
    const PALETTE = [...EXTRA_COLORS, ...RECRUITER_COLORS, "#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#e11d48", "#10b981"];
    const hashColor = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PALETTE[h % PALETTE.length]; };
    [...new Set(employees.map(e => e.bg))].forEach(v => { if (v && !BG_COLORS[v]) BG_COLORS[v] = hashColor(v); });
    [...new Set(employees.map(e => e.dept))].forEach(v => { if (v && !DEPT_COLORS[v]) DEPT_COLORS[v] = hashColor(v); });
    [...new Set(employees.map(e => e.fn))].forEach(v => { if (v && !FN_COLORS[v]) FN_COLORS[v] = hashColor(v); });
  }

  return employees;
}

// ─── TREE UTILITIES ───
function buildTree(employees, activeOnly = true) {
  const filtered = activeOnly ? employees.filter(e => e.status === "Active") : employees;
  const map = {};
  filtered.forEach(e => { map[e.id] = { ...e, children: [], _expanded: false, _directReports: 0, _totalReports: 0 }; });
  let root = null;
  const roots = [];
  const orphans = [];
  filtered.forEach(e => {
    const node = map[e.id];
    if (!e.managerId) { roots.push(node); }                     // no manager — a top-level node
    else if (map[e.managerId]) { map[e.managerId].children.push(node); }
    else { orphans.push(node); }                                // manager inactive — collect
  });
  // Pick one primary root. If several people have no manager (e.g. a flat import with no
  // manager column), nest the rest under the most senior so everyone still appears once.
  if (roots.length) {
    roots.sort((a, b) => levelIndex(b.level) - levelIndex(a.level));
    root = roots[0];
    for (let i = 1; i < roots.length; i++) { roots[i].managerId = root.id; root.children.push(roots[i]); }
  } else if (filtered.length) {
    root = map[filtered[0].id]; root.managerId = null;          // everyone in a cycle — promote one
  }
  // Re-parent orphaned employees (manager terminated, no active replacement) to root
  // so every active employee appears exactly once in the tree under a valid parent.
  if (root) {
    orphans.forEach(n => { n.managerId = root.id; root.children.push(n); });
  }
  function countReports(n, visited = new Set()) {
    if (visited.has(n.id)) return 0; // cycle detected — stop recursion
    visited.add(n.id);
    n._directReports = n.children.length;
    n._totalReports = n.children.reduce((s, c) => s + 1 + countReports(c, visited), 0);
    return n._totalReports;
  }
  if (root) countReports(root);
  return { root, map };
}

function getActiveAtDate(employees, date) {
  return employees.filter(e => {
    const start = new Date(e.startDate);
    const end = e.endDate ? new Date(e.endDate) : null;
    return start <= date && (!end || end > date);
  });
}

function getAncestorPath(map, nodeId) {
  const path = [];
  let current = map[nodeId];
  while (current) {
    path.unshift(current);
    current = current.managerId ? map[current.managerId] : null;
  }
  return path;
}

// ─── HOTSPOT DETECTION ───
function detectHotspots(tree) {
  const hotspots = [];
  if (!tree.root) return hotspots;
  function walk(node, depth = 0) {
    if (node._directReports > 10) hotspots.push({ type: "span-high", severity: "critical", nodeId: node.id, msg: `${node.first} ${node.last} has ${node._directReports} direct reports (max recommended: 10)` });
    else if (node._directReports > 7) hotspots.push({ type: "span-high", severity: "warning", nodeId: node.id, msg: `${node.first} ${node.last} has ${node._directReports} direct reports` });
    if (depth > 7) hotspots.push({ type: "depth", severity: "warning", nodeId: node.id, msg: `${node.first} ${node.last} is ${depth} levels deep` });
    if (node.children.length > 0 && node.children.every(c => c.children.length > 0) && !["C-Suite","SVP","VP","Director"].includes(node.level))
      hotspots.push({ type: "bureaucracy", severity: "info", nodeId: node.id, msg: `${node.first} ${node.last} manages only managers (no ICs)` });
    if (node.children.length === 1 && node.children[0].children.length > 3)
      hotspots.push({ type: "spof", severity: "warning", nodeId: node.id, msg: `Single report bottleneck under ${node.first} ${node.last}` });
    const recentHires = node.children.filter(c => {
      const months = (FIXED_NOW - new Date(c.startDate)) / (1000*60*60*24*30);
      return months < 6;
    });
    if (node.children.length > 3 && recentHires.length / node.children.length > 0.5)
      hotspots.push({ type: "rapid-growth", severity: "info", nodeId: node.id, msg: `${node.first}'s team: ${recentHires.length}/${node.children.length} joined < 6 months ago` });
    // Stagnation-cluster: manager has 3+ IC4/IC5 direct reports all stagnant >36 months
    const stagnantSeniors = node.children.filter(c => {
      const tenureMo = (FIXED_NOW - new Date(c.startDate)) / (1000*60*60*24*30);
      return c.level && (c.level === "IC4" || c.level === "IC5" || c.level === "IC6") && tenureMo > 36;
    });
    if (stagnantSeniors.length >= 3)
      hotspots.push({ type: "stagnation-cluster", severity: "warning", nodeId: node.id,
        msg: `${stagnantSeniors.length} senior ICs stagnant >3yr under ${node.first} ${node.last} — promotion pipeline at risk` });
    node.children.forEach(c => walk(c, depth + 1));
  }
  walk(tree.root);
  return hotspots;
}

// ─── INSIGHT ENGINE ───
const TENURE_MS = (d) => (FIXED_NOW - new Date(d)) / (1000 * 60 * 60 * 24 * 30); // months

function computeInsights(allEmployees, tree, filters = {}) {
  const { location = "All", bg = "All", fn = "All", dept = "All", snapshotDate = null } = filters;
  const now = FIXED_NOW;

  // Support historical snapshots
  const baseEmps = snapshotDate
    ? getActiveAtDate(allEmployees, snapshotDate)
    : allEmployees.filter(e => e.status === "Active");

  const workingTree = snapshotDate ? buildTree(baseEmps, false) : tree;

  const passFilter = (e) => {
    if (location !== "All" && e.location !== location) return false;
    if (bg !== "All" && e.bg !== bg) return false;
    if (fn !== "All" && e.fn !== fn) return false;
    if (dept !== "All" && e.dept !== dept) return false;
    return true;
  };

  const filteredIds = new Set(baseEmps.filter(passFilter).map(e => e.id));
  const insights = [];

  // ── 1. SPAN OF CONTROL ──
  Object.values(workingTree.map).forEach(node => {
    if (!filteredIds.has(node.id)) return;
    const drs = node.children.filter(c => filteredIds.has(c.id));
    if (drs.length < 2) return;
    const newHires = drs.filter(c => TENURE_MS(c.startDate) < 6).length;
    const mgrTenureMo = Math.round(TENURE_MS(node.startDate));

    if (drs.length > 12) {
      insights.push({
        id: `span-crit-${node.id}`, category: "span-control", severity: "critical",
        title: "Overloaded Manager",
        subtitle: `${node.first} ${node.last} · ${node.dept}`,
        metric: drs.length, metricLabel: "direct reports",
        benchmark: "6–10", benchmarkLabel: "industry benchmark",
        focusNodeId: node.id, affectedIds: [node.id, ...drs.map(c => c.id)],
        dept: node.dept, location: node.location, bg: node.bg,
        impact: "High",
        narrative: `${node.first} ${node.last} manages ${drs.length} direct reports in ${node.dept} — ${drs.length - 10} above the industry best-practice ceiling of 6–10 for ${node.level} roles. At this span, individual 1:1 time falls below 2 hours per person per quarter, which research links to a 23% increase in team attrition. ${newHires > 0 ? `The presence of ${newHires} employee${newHires > 1 ? "s" : ""} with less than 6 months' tenure amplifies onboarding risk further.` : ""}`,
        recommendation: `Split the team into two pods of ~${Math.ceil(drs.length / 2)}, promoting a senior IC to a Tech-Lead role to carry informal management responsibilities.`,
      });
    } else if (drs.length > 9) {
      insights.push({
        id: `span-warn-${node.id}`, category: "span-control", severity: "warning",
        title: "Wide Span of Control",
        subtitle: `${node.first} ${node.last} · ${node.dept}`,
        metric: drs.length, metricLabel: "direct reports",
        benchmark: "6–10", benchmarkLabel: "industry benchmark",
        focusNodeId: node.id, affectedIds: [node.id, ...drs.map(c => c.id)],
        dept: node.dept, location: node.location, bg: node.bg,
        impact: "Medium",
        narrative: `${node.first} ${node.last} is approaching an unsustainable span with ${drs.length} direct reports. At this level there is roughly 3 hours per person per month for structured 1:1 time — workable but fragile. Any further headcount growth will push this team into the critical zone and is likely to degrade team engagement scores.`,
        recommendation: `Put a headcount freeze on ${node.first}'s team and schedule a structure review before the next planning cycle.`,
      });
    }
  });

  // ── 2. NEW HIRE CONCENTRATION ──
  Object.values(workingTree.map).forEach(node => {
    if (!filteredIds.has(node.id)) return;
    const drs = node.children.filter(c => filteredIds.has(c.id));
    if (drs.length < 4) return;
    const newHires = drs.filter(c => TENURE_MS(c.startDate) < 6);
    const ratio = newHires.length / drs.length;
    if (ratio < 0.5) return;
    insights.push({
      id: `newhire-${node.id}`, category: "new-hire-risk",
      severity: ratio >= 0.65 ? "critical" : "warning",
      title: "New-Hire Concentration Risk",
      subtitle: `${node.first} ${node.last}'s team · ${node.dept}`,
      metric: `${Math.round(ratio * 100)}%`, metricLabel: "of team joined < 6 months ago",
      benchmark: "< 30%", benchmarkLabel: "healthy threshold",
      focusNodeId: node.id, affectedIds: [node.id, ...newHires.map(c => c.id)],
      dept: node.dept, location: node.location, bg: node.bg,
      impact: ratio >= 0.65 ? "High" : "Medium",
      narrative: `${newHires.length} of ${drs.length} direct reports under ${node.first} ${node.last} joined within the last 6 months (${Math.round(ratio * 100)}%). Teams in "storming" mode — where >50% of members are new — typically see a 20–35% productivity dip for 3–6 months and elevated early-attrition risk. The knowledge-transfer burden on tenured staff is significant and often invisible until someone resigns.`,
      recommendation: `Implement a structured buddy programme pairing each new hire with a tenured team member. Temporarily reduce ${node.first}'s project commitments by ~20% to absorb coaching overhead.`,
    });
  });

  // ── 3. NEW MANAGER + LARGE TEAM ──
  Object.values(workingTree.map).forEach(node => {
    if (!filteredIds.has(node.id)) return;
    const drs = node.children.filter(c => filteredIds.has(c.id));
    if (drs.length < 5) return;
    const mgrMo = TENURE_MS(node.startDate);
    if (mgrMo >= 12) return;
    insights.push({
      id: `mgr-new-${node.id}`, category: "manager-risk", severity: "warning",
      title: "New Manager, Large Team",
      subtitle: `${node.first} ${node.last} · ${node.dept}`,
      metric: `${Math.round(mgrMo)}mo`, metricLabel: "management tenure",
      benchmark: "12+ months", benchmarkLabel: "stability threshold",
      focusNodeId: node.id, affectedIds: [node.id, ...drs.map(c => c.id)],
      dept: node.dept, location: node.location, bg: node.bg,
      impact: "Medium",
      narrative: `${node.first} ${node.last} has been managing for only ${Math.round(mgrMo)} months while leading a team of ${drs.length}. The first 12 months are statistically the highest-risk window for new managers: direct-report attrition runs 18% higher and performance ratings decline by ~12% during leadership transitions. Team size amplifies both risks.`,
      recommendation: `Assign an executive mentor or establish a biweekly skip-level check-in for ${node.first} over the next 6 months.`,
    });
  });

  // ── 4. ATTRITION BY DEPARTMENT (last 180 days) ──
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const deptDepartures = {};
  allEmployees.filter(e => e.endDate && new Date(e.endDate) >= sixMonthsAgo && new Date(e.endDate) <= now).forEach(e => {
    if (location !== "All" && e.location !== location) return;
    if (bg !== "All" && e.bg !== bg) return;
    deptDepartures[e.dept] = (deptDepartures[e.dept] || 0) + 1;
  });
  const deptCurrent = {};
  baseEmps.filter(passFilter).forEach(e => { deptCurrent[e.dept] = (deptCurrent[e.dept] || 0) + 1; });

  Object.entries(deptDepartures).forEach(([d, gone]) => {
    const total = (deptCurrent[d] || 0) + gone;
    if (total < 6) return;
    const rate = gone / total;
    if (rate < 0.12) return;
    const deptHead = Object.values(workingTree.map).find(n => n.dept === d && filteredIds.has(n.id) && n.children.length > 0 && ["Director","VP","SVP"].includes(n.level));
    insights.push({
      id: `attrition-${d.replace(/\s/g,"-")}`, category: "attrition",
      severity: rate > 0.2 ? "critical" : "warning",
      title: "Elevated Attrition Signal",
      subtitle: d,
      metric: `${Math.round(rate * 100)}%`, metricLabel: "6-month attrition rate",
      benchmark: "< 10%", benchmarkLabel: "healthy annual rate",
      focusNodeId: deptHead?.id ?? null,
      affectedIds: deptHead ? [deptHead.id] : [],
      dept: d, location: null, bg: null,
      impact: rate > 0.2 ? "High" : "Medium",
      narrative: `${d} has lost ${gone} employees in the last 6 months — an annualised rate of ${Math.round(rate * 100)}%, roughly ${Math.round((rate - 0.1) * 100)} percentage points above the healthy 10% ceiling. Beyond the immediate productivity gap, each departure triggers an estimated 6–9 months of knowledge reconstruction.`,
      recommendation: `Conduct stay interviews with remaining ${d} employees this month. Cross-reference exit survey themes against manager tenure, span of control, and promotion velocity.`,
    });
  });

  // ── 5. ORG DEPTH ──
  const deepNodes = [];
  function walkDepth(node, d) {
    if (!filteredIds.has(node.id)) return;
    if (d > 7) deepNodes.push({ node, d });
    node.children.forEach(c => walkDepth(c, d + 1));
  }
  if (workingTree.root) walkDepth(workingTree.root, 0);
  if (deepNodes.length > 0) {
    const maxD = Math.max(...deepNodes.map(x => x.d));
    const deepest = deepNodes.find(x => x.d === maxD);
    insights.push({
      id: `depth-${deepest.node.id}`, category: "org-depth",
      severity: maxD > 9 ? "warning" : "info",
      title: "Deep Hierarchy",
      subtitle: `${deepNodes.length} node${deepNodes.length > 1 ? "s" : ""} below Level 7`,
      metric: maxD, metricLabel: "max levels from CEO",
      benchmark: "≤ 7", benchmarkLabel: "best practice",
      focusNodeId: deepest.node.id, affectedIds: deepNodes.map(x => x.node.id),
      dept: deepest.node.dept, location: null, bg: null,
      impact: "Medium",
      narrative: `The organisation has ${deepNodes.length} employee${deepNodes.length > 1 ? "s" : ""} ${maxD} or more reporting levels from the CEO. Each additional hierarchy layer adds an estimated 2–3 days to information flow and approval cycles. Organisations with more than 7 levels have been shown to exhibit 35% slower strategic response times than structurally flatter peers, and employees at the bottom of deep chains report significantly lower agency and engagement.`,
      recommendation: `Map every reporting chain beyond Level 6, identify redundant intermediate layers, and explore whether consolidation is viable in the next reorg cycle.`,
    });
  }

  // ── 6. SINGLE POINT OF FAILURE ──
  Object.values(workingTree.map).forEach(node => {
    if (!filteredIds.has(node.id)) return;
    const activeDRs = node.children.filter(c => filteredIds.has(c.id));
    if (activeDRs.length !== 1) return;
    const child = activeDRs[0];
    if (child._totalReports < 5) return;
    insights.push({
      id: `spof-${node.id}`, category: "structure", severity: "warning",
      title: "Single Point of Failure",
      subtitle: `${node.first} ${node.last} → ${child.first} ${child.last}`,
      metric: child._totalReports, metricLabel: "employees in bottleneck subtree",
      benchmark: "2+ reports", benchmarkLabel: "resilience standard",
      focusNodeId: node.id, affectedIds: [node.id, child.id],
      dept: node.dept, location: node.location, bg: node.bg,
      impact: "Medium",
      narrative: `${node.first} ${node.last} has a single direct report — ${child.first} ${child.last} — who manages ${child._totalReports} employees below them. If ${child.first} were to leave, ${node.first} would immediately absorb direct responsibility for an entire subtree. This structure is a single resignation away from an org continuity crisis and creates an implicit promotion pressure on ${child.first} that can accelerate departure.`,
      recommendation: `Restructure so ${node.first} has at least 2 direct reports, or promote a senior IC in ${child.first}'s team to a co-lead role.`,
    });
  });

  // ── 7. SUCCESSION GAPS (C-Suite) ──
  Object.values(workingTree.map).filter(n => n.level === "C-Suite" && filteredIds.has(n.id)).forEach(exec => {
    const readySuccessors = exec.children.filter(c =>
      filteredIds.has(c.id) && ["SVP","VP"].includes(c.level) && TENURE_MS(c.startDate) > 24
    );
    if (readySuccessors.length > 0) return;
    insights.push({
      id: `succession-${exec.id}`, category: "succession", severity: "warning",
      title: "Succession Gap",
      subtitle: `${exec.first} ${exec.last} · ${exec.title}`,
      metric: 0, metricLabel: "ready successors identified",
      benchmark: "≥ 2", benchmarkLabel: "governance standard",
      focusNodeId: exec.id, affectedIds: [exec.id],
      dept: exec.dept, location: exec.location, bg: exec.bg,
      impact: "High",
      narrative: `${exec.first} ${exec.last} (${exec.title}) has no direct report with VP+ level and 2+ years of tenure who could serve as a ready successor. Board governance standards recommend at least two identified successors for each C-suite seat. Recovery from an unplanned executive departure at this level takes an average of 18–24 months and can cause strategic drift, investor concern, and a cascade of downstream attrition.`,
      recommendation: `Initiate a formal succession review for the ${exec.title} role. Identify 1–2 high-potential VP candidates and build 12-month development plans with explicit succession milestones.`,
    });
  });

  // ── 8. RAPID DEPARTMENT GROWTH ──
  const sixMoAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const deptOld = {}, deptNow = {};
  baseEmps.filter(passFilter).forEach(e => {
    deptNow[e.dept] = (deptNow[e.dept] || 0) + 1;
    if (new Date(e.startDate) <= sixMoAgo) deptOld[e.dept] = (deptOld[e.dept] || 0) + 1;
  });
  Object.keys(deptNow).forEach(d => {
    const old = deptOld[d] || 0;
    if (old < 5) return;
    const growth = (deptNow[d] - old) / old;
    if (growth < 0.35) return;
    const head = Object.values(workingTree.map).find(n => n.dept === d && filteredIds.has(n.id) && n.children.length > 0 && ["Director","VP"].includes(n.level));
    insights.push({
      id: `growth-${d.replace(/\s/g,"-")}`, category: "growth", severity: "info",
      title: "Rapid Department Growth",
      subtitle: d,
      metric: `+${Math.round(growth * 100)}%`, metricLabel: "headcount growth (6 months)",
      benchmark: "< 20%", benchmarkLabel: "sustainable pace",
      focusNodeId: head?.id ?? null, affectedIds: head ? [head.id] : [],
      dept: d, location: null, bg: null,
      impact: "Medium",
      narrative: `${d} has grown by ${Math.round(growth * 100)}% in the last 6 months (from ${old} to ${deptNow[d]} employees). While growth signals business momentum, teams scaling faster than 25% per half typically experience onboarding friction, culture dilution, and a 40% higher probability of manager burnout. Infrastructure — tooling, processes, documentation — nearly always lags this growth velocity.`,
      recommendation: `Audit onboarding quality scores for recent ${d} hires, ensure manager capacity is adequate, and verify that team rituals and knowledge-sharing practices have scaled with headcount.`,
    });
  });

  // ── 9. BUREAUCRACY LAYERS (managers managing only managers) ──
  Object.values(workingTree.map).forEach(node => {
    if (!filteredIds.has(node.id)) return;
    if (["C-Suite","SVP"].includes(node.level)) return;
    const activeDRs = node.children.filter(c => filteredIds.has(c.id));
    if (activeDRs.length === 0) return;
    const allAreMgrs = activeDRs.every(c => c.children.filter(gc => filteredIds.has(gc.id)).length > 0);
    if (!allAreMgrs || activeDRs.length < 2) return;
    insights.push({
      id: `bureau-${node.id}`, category: "structure", severity: "info",
      title: "Pure Manager Layer",
      subtitle: `${node.first} ${node.last} · ${node.dept}`,
      metric: activeDRs.length, metricLabel: "managers with no IC direct reports",
      benchmark: "Mixed", benchmarkLabel: "ICs + managers",
      focusNodeId: node.id, affectedIds: [node.id, ...activeDRs.map(c => c.id)],
      dept: node.dept, location: node.location, bg: node.bg,
      impact: "Low",
      narrative: `${node.first} ${node.last} manages ${activeDRs.length} people who are themselves all managers — there are no individual contributors in this direct reporting layer. While appropriate at VP+ levels, this pattern at ${node.level} level often indicates unnecessary management overhead. Decision latency increases with each pure-management layer, and ICs at the bottom report lower connection to strategy.`,
      recommendation: `Review whether this management layer adds distinct value, or whether the org can be flattened to reduce decision latency.`,
    });
  });

  // ── 10. STAGNATION CLUSTERS (3+ senior ICs overdue for promotion under one manager) ──
  Object.values(workingTree.map).forEach(node => {
    if (!filteredIds.has(node.id)) return;
    const stagnantDRs = node.children.filter(c => {
      if (!filteredIds.has(c.id)) return false;
      const tenureMo = (now - new Date(c.startDate)) / (1000*60*60*24*30);
      return (c.level === "IC4" || c.level === "IC5" || c.level === "IC6") && tenureMo > 36;
    });
    if (stagnantDRs.length < 3) return;
    const avgTenureYr = (stagnantDRs.reduce((s, c) => s + (now - new Date(c.startDate)) / (1000*60*60*24*365), 0) / stagnantDRs.length).toFixed(1);
    insights.push({
      id: `stagnation-${node.id}`, category: "attrition", severity: "warning",
      title: "Stagnation Cluster",
      subtitle: `${node.first} ${node.last} · ${node.dept}`,
      metric: stagnantDRs.length, metricLabel: "senior ICs stagnant > 3 years",
      benchmark: "< 2", benchmarkLabel: "recommended per team",
      focusNodeId: node.id, affectedIds: [node.id, ...stagnantDRs.map(c => c.id)],
      dept: node.dept, location: node.location, bg: node.bg,
      impact: "High",
      narrative: `${node.first} ${node.last}'s team has ${stagnantDRs.length} senior ICs (${stagnantDRs.map(c => `${c.first} ${c.last}`).join(", ")}) with an average of ${avgTenureYr} years at IC4+ level, all without a recorded promotion in more than 3 years. Research consistently shows that stagnant senior ICs are 2.3× more likely to accept a competing offer — and the loss of multiple principals simultaneously can cause a knowledge-transfer crisis that stalls roadmap execution for 6–12 months.`,
      recommendation: `Run calibration for all ${stagnantDRs.length} flagged ICs in the next review cycle. Where promotion is warranted, move quickly — delayed promotions after this tenure window have a <40% retention success rate. Where promotion is not warranted, a transparent career-path conversation is still better than silence.`,
    });
  });

  return insights.sort((a, b) => {
    const o = { critical: 0, warning: 1, info: 2 };
    return o[a.severity] - o[b.severity];
  });
}

function computeOrgHealthScore(insights, activeCount) {
  const categories = {
    "span-control":   { weight: 0.28, critPen: 18, warnPen: 7  },
    "attrition":      { weight: 0.25, critPen: 20, warnPen: 8  },
    "succession":     { weight: 0.18, critPen: 15, warnPen: 6  },
    "new-hire-risk":  { weight: 0.14, critPen: 12, warnPen: 5  },
    "structure":      { weight: 0.08, critPen: 10, warnPen: 4  },
    "manager-risk":   { weight: 0.07, critPen: 10, warnPen: 4  },
  };
  const breakdown = {};
  let totalScore = 0;
  Object.entries(categories).forEach(([cat, { weight, critPen, warnPen }]) => {
    const crits = insights.filter(i => i.category === cat && i.severity === "critical").length;
    const warns = insights.filter(i => i.category === cat && i.severity === "warning").length;
    const rawScore = Math.max(0, 100 - crits * critPen - warns * warnPen);
    breakdown[cat] = { score: rawScore, max: 100 };
    totalScore += rawScore * weight;
  });
  // Remaining weights (growth, org-depth, bureaucracy) treated as 100
  const usedWeight = Object.values(categories).reduce((s, c) => s + c.weight, 0);
  totalScore += 100 * (1 - usedWeight);
  return { score: Math.round(Math.max(0, Math.min(100, totalScore))), breakdown };
}

// ─── MINI ORG TREE (compact, read-only — used in focus panels) ───
function MiniOrgTree({ node, highlightIds = new Set(), depth = 0, maxDepth = 3 }) {
  if (!node || depth >= maxDepth) return null;
  const isHighlighted = highlightIds.has(node.id);
  const color = DEPT_COLORS[node.dept] || "#64748b";
  const visibleChildren = node.children.slice(0, 6);
  const overflow = node.children.length - visibleChildren.length;
  return (
    <div>
      <div className="flex items-start" style={{ paddingLeft: depth * 20 }}>
        {depth > 0 && (
          <div className="shrink-0 mr-1.5" style={{ width: 12, height: 20, borderLeft: "1.5px solid #e2e8f0", borderBottom: "1.5px solid #e2e8f0", borderRadius: "0 0 0 4px", marginTop: -4 }}/>
        )}
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-1 flex-1 min-w-0 transition-all"
          style={{
            background: isHighlighted ? `${color}18` : depth === 0 ? "#f8fafc" : "white",
            border: `1.5px solid ${isHighlighted ? color : depth === 0 ? "#e2e8f0" : "#f1f5f9"}`,
            boxShadow: isHighlighted ? `0 0 0 2px ${color}28` : "none",
          }}
        >
          <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white font-bold" style={{ background: color, fontSize: 9 }}>
            {node.first?.[0]}{node.last?.[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-gray-800 truncate">{node.first} {node.last}</div>
            <div className="text-gray-400 truncate" style={{ fontSize: 9 }}>{node.title}</div>
          </div>
          {node.children.length > 0 && (
            <div className="text-gray-400 shrink-0 flex items-center gap-0.5" style={{ fontSize: 9 }}>
              <Users size={8}/>{node._directReports}
            </div>
          )}
        </div>
      </div>
      {visibleChildren.map(child => (
        <MiniOrgTree key={child.id} node={child} highlightIds={highlightIds} depth={depth + 1} maxDepth={maxDepth}/>
      ))}
      {overflow > 0 && (
        <div className="text-gray-400 text-xs py-0.5" style={{ paddingLeft: (depth + 1) * 20 + 24 }}>+{overflow} more…</div>
      )}
    </div>
  );
}

// ─── INSIGHT CARD ───
const SEV = {
  critical: { bg: "#fef2f2", border: "#fca5a5", accent: "#dc2626", label: "CRITICAL", icon: "🔴" },
  warning:  { bg: "#fffbeb", border: "#fde68a", accent: "#d97706", label: "WARNING",  icon: "⚠️" },
  info:     { bg: "#eff6ff", border: "#bfdbfe", accent: "#2563eb", label: "INSIGHT",  icon: "💡" },
};

function InsightCard({ insight, isActive, onSelect, onZoom }) {
  const cfg = SEV[insight.severity];
  return (
    <div
      onClick={onSelect}
      className="mb-2.5 rounded-xl cursor-pointer"
      style={{
        background: isActive ? "#fff" : cfg.bg,
        border: `1.5px solid ${isActive ? "#3b82f6" : cfg.border}`,
        padding: "11px 13px",
        boxShadow: isActive ? "0 4px 20px rgba(59,130,246,0.13)" : "0 1px 3px rgba(0,0,0,0.04)",
        transform: isActive ? "translateX(3px)" : "none",
        transition: "all 0.18s ease",
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span style={{ fontSize: 11 }}>{cfg.icon}</span>
            <span className="text-xs font-bold tracking-wide" style={{ color: cfg.accent }}>{cfg.label}</span>
            <span className="text-gray-300 text-xs">·</span>
            <span className="text-gray-400" style={{ fontSize: 10 }}>{insight.category.replace(/-/g, " ")}</span>
          </div>
          <div className="text-sm font-bold text-gray-900 leading-tight">{insight.title}</div>
          <div className="text-gray-500 truncate" style={{ fontSize: 11 }}>{insight.subtitle}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-black leading-none" style={{ color: cfg.accent }}>{insight.metric}</div>
          <div className="text-gray-400 leading-tight" style={{ fontSize: 9 }}>{insight.metricLabel}</div>
        </div>
      </div>

      {isActive && (
        <div className="mt-2.5 pt-2.5 border-t" style={{ borderColor: cfg.border }}>
          <p className="text-gray-600 leading-relaxed mb-2.5" style={{ fontSize: 11 }}>{insight.narrative}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1 flex-wrap">
              {insight.dept && (
                <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: `${DEPT_COLORS[insight.dept] || "#64748b"}20`, color: DEPT_COLORS[insight.dept] || "#64748b" }}>
                  {insight.dept}
                </span>
              )}
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: insight.impact === "High" ? "#fef2f2" : insight.impact === "Medium" ? "#fffbeb" : "#f0fdf4", color: insight.impact === "High" ? "#dc2626" : insight.impact === "Medium" ? "#d97706" : "#16a34a" }}>
                {insight.impact} impact
              </span>
            </div>
            {insight.focusNodeId && (
              <button onClick={e => { e.stopPropagation(); onZoom(); }} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold transition-colors" style={{ fontSize: 11 }}>
                Zoom to team <ArrowRight size={10}/>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── INSIGHT FOCUS PANEL ───
function InsightFocusPanel({ insight, onZoom }) {
  const { tree, employees } = useContext(AppCtx);
  const cfg = SEV[insight.severity];
  const focusNode = insight.focusNodeId ? tree.map[insight.focusNodeId] : null;

  const teamMetrics = useMemo(() => {
    if (!focusNode) return null;
    const ids = new Set([focusNode.id, ...focusNode.children.map(c => c.id)]);
    const team = employees.filter(e => ids.has(e.id) && e.status === "Active");
    const now = FIXED_NOW;
    const avgTenureYr = team.length ? (team.reduce((s, e) => s + (now - new Date(e.startDate)) / (1000*60*60*24*365), 0) / team.length).toFixed(1) : "–";
    const newHires = team.filter(e => TENURE_MS(e.startDate) < 6).length;
    const depts = [...new Set(team.map(e => e.dept))];
    const locs  = [...new Set(team.map(e => e.location))];
    return { size: team.length, avgTenureYr, newHires, depts, locs };
  }, [focusNode, employees]);

  // Gauge position: figure out where metric sits on a 0–critical scale
  const catBenchmarks = {
    "span-control": { low: 6, high: 13, unit: "" },
    "attrition":    { low: 5, high: 25, unit: "%" },
    "new-hire-risk":{ low: 20, high: 70, unit: "%" },
    "manager-risk": { low: 12, high: 0,  unit: "mo" },
    "succession":   { low: 2, high: 0,   unit: "" },
  };

  return (
    <div className="h-full overflow-auto" style={{ background: "#f8fafc" }}>
      {/* Hero header */}
      <div className="p-6 pb-0">
        <div className="rounded-2xl p-5 mb-4" style={{ background: `linear-gradient(135deg, ${cfg.bg} 0%, white 100%)`, border: `1.5px solid ${cfg.border}` }}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: cfg.accent }}>{cfg.label}</span>
              </div>
              <h2 className="text-2xl font-black text-gray-900 leading-tight">{insight.title}</h2>
              <p className="text-gray-500 mt-0.5">{insight.subtitle}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-5xl font-black leading-none" style={{ color: cfg.accent }}>{insight.metric}</div>
              <div className="text-gray-400 mt-1" style={{ fontSize: 11 }}>{insight.metricLabel}</div>
              <div className="text-gray-400" style={{ fontSize: 10 }}>vs. {insight.benchmark} ({insight.benchmarkLabel})</div>
            </div>
          </div>
          {/* Gradient severity bar */}
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "linear-gradient(90deg, #22c55e 0%, #84cc16 30%, #f59e0b 60%, #ef4444 85%, #991b1b 100%)" }}/>
          <div className="flex justify-between text-gray-400 mt-1" style={{ fontSize: 9 }}>
            <span>Optimal</span><span>Healthy</span><span>Caution</span><span>Critical</span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-4">
        {/* Analysis */}
        <div className="bg-white rounded-xl p-5 border border-gray-100" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><BarChart3 size={14} className="text-blue-500"/> Deep-Dive Analysis</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{insight.narrative}</p>
        </div>

        {/* Team metrics */}
        {teamMetrics && (
          <div className="bg-white rounded-xl p-5 border border-gray-100" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Users size={14} className="text-indigo-500"/> Team Snapshot</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { label: "Team Size", value: teamMetrics.size, icon: Users, color: "#6366f1" },
                { label: "Avg Tenure (yrs)", value: teamMetrics.avgTenureYr, icon: Clock, color: "#059669" },
                { label: "New Hires <6mo", value: teamMetrics.newHires, icon: TrendingUp, color: teamMetrics.newHires > teamMetrics.size * 0.4 ? "#ef4444" : "#d97706" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-lg p-3 text-center" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                  <div className="text-2xl font-black" style={{ color }}>{value}</div>
                  <div className="text-gray-500 mt-0.5" style={{ fontSize: 10 }}>{label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {teamMetrics.depts.map(d => (
                <span key={d} className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${DEPT_COLORS[d] || "#64748b"}18`, color: DEPT_COLORS[d] || "#64748b" }}>{d}</span>
              ))}
              {teamMetrics.locs.map(l => (
                <span key={l} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{l}</span>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        <div className="rounded-xl p-5 border" style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
          <h3 className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: "#0369a1" }}><Zap size={14}/> Recommended Action</h3>
          <p className="text-sm leading-relaxed" style={{ color: "#0c4a6e" }}>{insight.recommendation}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-blue-400">Impact level:</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{
              background: insight.impact === "High" ? "#fef2f2" : insight.impact === "Medium" ? "#fffbeb" : "#f0fdf4",
              color:      insight.impact === "High" ? "#dc2626" : insight.impact === "Medium" ? "#d97706" : "#16a34a",
            }}>{insight.impact}</span>
          </div>
        </div>

        {/* Mini org tree */}
        {focusNode && (
          <div className="bg-white rounded-xl p-5 border border-gray-100" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Layers size={14} className="text-purple-500"/> Reporting Structure</h3>
              <button onClick={onZoom} className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
                Open in Org Chart <ArrowRight size={10}/>
              </button>
            </div>
            <MiniOrgTree node={focusNode} highlightIds={new Set(insight.affectedIds)} maxDepth={3}/>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ORG OVERVIEW (default right panel when no insight is selected) ───
function OrgOverview({ insights, score, breakdown, employees, tree }) {
  const { setView, navigateToDept } = useContext(AppCtx);
  const depts = useMemo(() => {
    const active = employees.filter(e => e.status === "Active");
    return [...new Set(active.map(e => e.dept))].sort().map(d => {
      const ins = insights.filter(i => i.dept === d);
      const crits = ins.filter(i => i.severity === "critical").length;
      const warns = ins.filter(i => i.severity === "warning").length;
      const hc = active.filter(e => e.dept === d).length;
      return { dept: d, hc, crits, warns, health: crits > 0 ? "critical" : warns > 0 ? "warning" : "healthy" };
    });
  }, [insights, employees]);

  const catMaxes = { "span-control": 100, "attrition": 100, "succession": 100, "new-hire-risk": 100, "structure": 100, "manager-risk": 100 };
  const catLabels = { "span-control": "Span Control", "attrition": "Attrition", "succession": "Succession", "new-hire-risk": "New-Hire Stability", "structure": "Structure", "manager-risk": "Manager Health" };
  const catToFilter = { "span-control": "span-control", "attrition": "attrition", "succession": "succession", "new-hire-risk": "new-hire-risk", "structure": "structure", "manager-risk": "manager-risk" };

  return (
    <div className="h-full overflow-auto p-6" style={{ background: "#f8fafc" }}>
      <p className="text-sm text-gray-500 mb-6">Click any insight card on the left for a narrative deep-dive, or click a health bar or department below to explore.</p>

      {/* Health score breakdown */}
      <div className="bg-white rounded-xl p-5 mb-5 border border-gray-100" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <h3 className="text-sm font-bold text-gray-700 mb-4">Health Score Breakdown <span className="text-gray-400 font-normal text-xs ml-1">· click to filter insights</span></h3>
        <div className="space-y-3">
          {Object.entries(breakdown).map(([cat, { score: s }]) => {
            const col = s >= 75 ? "#22c55e" : s >= 50 ? "#f59e0b" : "#ef4444";
            const catInsights = insights.filter(i => i.category === cat);
            return (
              <div key={cat} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors ${catInsights.length > 0 ? "cursor-pointer hover:bg-gray-50" : ""}`}
                onClick={() => { if (catInsights.length > 0 && catInsights[0].focusNodeId) { setView("analytics"); } }}
                title={catInsights.length > 0 ? `${catInsights.length} insight${catInsights.length > 1 ? "s" : ""} — click to view` : "No issues"}>
                <div className="w-36 text-xs text-gray-600 shrink-0">{catLabels[cat] || cat}</div>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s}%`, background: col }}/>
                </div>
                <div className="text-xs font-bold text-gray-700 w-10 text-right" style={{ color: col }}>{s}</div>
                {catInsights.length > 0 && <span className="text-xs text-gray-400 w-5">{catInsights.length}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Department health grid */}
      <div className="bg-white rounded-xl p-5 border border-gray-100" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <h3 className="text-sm font-bold text-gray-700 mb-4">Department Health Map <span className="text-gray-400 font-normal text-xs ml-1">· click to view in org chart</span></h3>
        <div className="grid grid-cols-2 gap-2">
          {depts.map(({ dept: d, hc, crits, warns, health }) => {
            const color = DEPT_COLORS[d] || "#64748b";
            const dot = health === "critical" ? "#ef4444" : health === "warning" ? "#f59e0b" : "#22c55e";
            return (
              <div key={d} className="flex items-center gap-2 p-2.5 rounded-xl transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5"
                style={{ background: `${color}09`, border: `1.5px solid ${color}22` }}
                onClick={() => navigateToDept(d)}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ background: dot }}/>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">{d}</div>
                  <div className="text-gray-400" style={{ fontSize: 10 }}>{hc} people</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {crits > 0 && <span className="text-xs font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">{crits}</span>}
                  {warns > 0 && <span className="text-xs font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">{warns}</span>}
                  {crits === 0 && warns === 0 && <span className="text-xs text-green-600">✓</span>}
                </div>
                <ArrowRight size={10} className="text-gray-300 shrink-0"/>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── ANALYTICS VIEW ───
function AnalyticsView() {
  const { employees, tree, goToInsight } = useContext(AppCtx);

  const [tab, setTab] = useState("insights"); // "insights" | "flight-risk"
  const [filters, setFilters] = useState({ location: "All", bg: "All", fn: "All", dept: "All", snapshotDate: null });
  const [activeInsight, setActiveInsight] = useState(null);
  const [catFilter, setCatFilter] = useState("all");

  const uniqVals = useCallback((field) =>
    [...new Set(employees.filter(e => e.status === "Active").map(e => e[field]))].sort()
  , [employees]);

  const [sevFilter, setSevFilter] = useState("all"); // "all", "critical", "warning", "info"

  const allInsights = useMemo(() => computeInsights(employees, tree, filters), [employees, tree, filters]);
  const { score, breakdown } = useMemo(() => computeOrgHealthScore(allInsights, employees.filter(e => e.status === "Active").length), [allInsights, employees]);

  // 12-month org health trend — pre-compute one snapshot per month going back 11 months from June 2025
  const healthTrend = useMemo(() => {
    const result = [];
    for (let i = 11; i >= 0; i--) {
      const snap = new Date(2025, 5 - i, 1);
      const activeAtSnap = employees.filter(e => {
        const start = new Date(e.startDate);
        const end = e.endDate ? new Date(e.endDate) : null;
        return start <= snap && (!end || end > snap);
      });
      const snapInsights = computeInsights(employees, tree, { snapshotDate: snap });
      const { score: s } = computeOrgHealthScore(snapInsights, activeAtSnap.length);
      result.push({ month: snap.toLocaleDateString("en-US", { month: "short" }), score: s });
    }
    return result;
  }, [employees, tree]);

  const visibleInsights = useMemo(() => {
    let list = allInsights;
    if (catFilter !== "all") list = list.filter(i => i.category === catFilter);
    if (sevFilter !== "all") list = list.filter(i => i.severity === sevFilter);
    return list;
  }, [allInsights, catFilter, sevFilter]);

  const scoreColor = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 80 ? "Healthy" : score >= 60 ? "Needs Attention" : "At Risk";

  const zoomToInsight = useCallback((insight) => {
    goToInsight(insight);
  }, [goToInsight]);

  const CATS = [
    ["all","All"], ["span-control","Span"], ["attrition","Attrition"],
    ["new-hire-risk","New Hires"], ["succession","Succession"],
    ["growth","Growth"], ["structure","Structure"], ["manager-risk","Managers"],
    ["org-depth","Org Depth"],
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Analytics sub-tabs: Insights · Flight Risk ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-2 flex gap-1 shrink-0">
        {[["insights", "Insights", Zap], ["flight-risk", "Flight Risk", AlertTriangle]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${tab === id ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            <Icon size={13}/>{label}
          </button>
        ))}
      </div>

      {tab === "flight-risk" && <div className="flex-1 overflow-hidden"><FlightRiskView/></div>}

      {tab === "insights" && <>
      {/* ── Top bar: health score + filters ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-6 shrink-0 flex-wrap" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {/* Score */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative w-16 h-16">
            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#f1f5f9" strokeWidth="7"/>
              <circle cx="32" cy="32" r="26" fill="none" stroke={scoreColor} strokeWidth="7"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - score / 100)}`}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }}/>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-lg font-black leading-none" style={{ color: scoreColor }}>{score}</div>
              <div className="text-gray-400 leading-none" style={{ fontSize: 7 }}>/ 100</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 font-medium">Org Health Score<Help text="Analytics — an Org Health Score (0–100) plus a ranked feed of detected issues (span-of-control, attrition, succession, structure). Click any insight to jump to the affected team; filter by category or severity, or scrub a snapshot date to see the score over time." side="bottom" width={300} /></div>
            <div className="text-sm font-bold" style={{ color: scoreColor }}>{scoreLabel}</div>
            {filters.snapshotDate && (
              <div className="text-xs text-blue-500 mt-0.5">📅 Snapshot: {new Date(filters.snapshotDate).toLocaleDateString("en-US", { year: "numeric", month: "short" })}</div>
            )}
          </div>
          {/* 12-month sparkline */}
          <div className="ml-3 flex flex-col justify-center" style={{ width: 120 }}>
            <div className="text-xs text-gray-400 mb-1" style={{ fontSize: 9 }}>12-month trend</div>
            {(() => {
              const vals = healthTrend.map(d => d.score);
              const min = Math.min(...vals), max = Math.max(...vals);
              const range = Math.max(max - min, 10);
              const W = 120, H = 36, pad = 3;
              const pts = vals.map((v, i) => {
                const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
                const y = H - pad - ((v - min) / range) * (H - pad * 2);
                return `${x},${y}`;
              }).join(" ");
              const lastScore = vals[vals.length - 1];
              const firstScore = vals[0];
              const trending = lastScore > firstScore + 2 ? "#16a34a" : lastScore < firstScore - 2 ? "#dc2626" : "#d97706";
              return (
                <svg width={W} height={H} style={{ overflow: "visible" }}>
                  <polyline points={pts} fill="none" stroke={trending} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
                  {healthTrend.map((d, i) => {
                    const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
                    const y = H - pad - ((d.score - min) / range) * (H - pad * 2);
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r={i === vals.length - 1 ? 3 : 2} fill={trending} opacity={i === vals.length - 1 ? 1 : 0.4}/>
                        {i === 0 || i === vals.length - 1 ? (
                          <text x={x} y={i === 0 ? y - 4 : y - 4} textAnchor={i === 0 ? "start" : "end"} fill="#94a3b8" style={{ fontSize: 7 }}>{d.score}</text>
                        ) : null}
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
            <div className="flex justify-between text-gray-300 mt-0.5" style={{ fontSize: 8 }}>
              <span>{healthTrend[0]?.month}</span><span>{healthTrend[healthTrend.length-1]?.month}</span>
            </div>
          </div>
        </div>

        {/* Severity pills */}
        <div className="flex gap-3 border-l border-gray-100 pl-6 shrink-0">
          {[["critical","🔴","#dc2626","#fef2f2"], ["warning","⚠️","#d97706","#fffbeb"], ["info","💡","#2563eb","#eff6ff"]].map(([sev, icon, color, bg]) => {
            const n = allInsights.filter(i => i.severity === sev).length;
            const isActive = sevFilter === sev;
            return (
              <div key={sev} className={`text-center px-3 py-1 rounded-lg cursor-pointer transition-all hover:shadow-md ${isActive ? "ring-2 ring-offset-1" : ""}`}
                style={{ background: bg, ...(isActive ? { ringColor: color } : {}) }}
                onClick={() => setSevFilter(prev => prev === sev ? "all" : sev)}>
                <div className="text-xl font-black" style={{ color }}>{n}</div>
                <div className="text-gray-500 capitalize" style={{ fontSize: 10 }}>{isActive ? `✓ ${sev}` : sev}</div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 border-l border-gray-100 pl-6 flex-wrap ml-auto">
          <span className="text-xs font-semibold text-gray-500 shrink-0">Focus lens:</span>
          {["location","bg","fn","dept"].map(field => {
            const labels = { location: "Location", bg: "Business Unit", fn: "Discipline", dept: "Department" };
            return (
              <select key={field} value={filters[field]}
                onChange={e => { setFilters(f => ({ ...f, [field]: e.target.value })); setActiveInsight(null); }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600">
                <option value="All">All {labels[field]}s</option>
                {uniqVals(field).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            );
          })}
          <input type="month"
            value={filters.snapshotDate ? new Date(filters.snapshotDate).toISOString().slice(0, 7) : ""}
            onChange={e => { setFilters(f => ({ ...f, snapshotDate: e.target.value ? new Date(e.target.value + "-01") : null })); setActiveInsight(null); }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
            title="Snapshot date — view historical org health"
          />
          {(filters.location !== "All" || filters.bg !== "All" || filters.fn !== "All" || filters.dept !== "All" || filters.snapshotDate) && (
            <button onClick={() => { setFilters({ location: "All", bg: "All", fn: "All", dept: "All", snapshotDate: null }); setActiveInsight(null); }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
              Clear ×
            </button>
          )}
        </div>
      </div>

      {/* ── Body: insight feed (left) + focus panel (right) ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: insight feed */}
        <div className="w-80 shrink-0 border-r border-gray-100 flex flex-col bg-gray-50">
          {/* Category filter */}
          <div className="px-3 pt-3 pb-2 flex gap-1 flex-wrap border-b border-gray-100 bg-white">
            {CATS.map(([k, label]) => (
              <button key={k} onClick={() => setCatFilter(k)}
                className="text-xs px-2 py-1 rounded-full transition-all"
                style={{
                  background: catFilter === k ? "#1e293b" : "#f1f5f9",
                  color:      catFilter === k ? "white"   : "#64748b",
                  fontWeight: catFilter === k ? 700 : 400,
                }}>
                {label} {k === "all" ? `(${allInsights.length})` : `(${allInsights.filter(i => i.category === k).length})`}
              </button>
            ))}
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-3">
            {visibleInsights.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-10">
                <div className="text-3xl mb-2">✅</div>
                No issues found for this filter
              </div>
            ) : visibleInsights.map(ins => (
              <InsightCard
                key={ins.id}
                insight={ins}
                isActive={activeInsight?.id === ins.id}
                onSelect={() => setActiveInsight(prev => prev?.id === ins.id ? null : ins)}
                onZoom={() => zoomToInsight(ins)}
              />
            ))}
          </div>
        </div>

        {/* Right: focus panel or overview */}
        <div className="flex-1 overflow-hidden" style={{ animation: "chartFadeIn 0.2s ease" }} key={activeInsight?.id ?? "overview"}>
          {activeInsight
            ? <InsightFocusPanel insight={activeInsight} onZoom={() => zoomToInsight(activeInsight)}/>
            : <OrgOverview insights={allInsights} score={score} breakdown={breakdown} employees={employees} tree={tree}/>
          }
        </div>
      </div>
      </>}
    </div>
  );
}

// ─── FLIGHT RISK ENGINE ───
// Deterministic pseudo-random seeded by employee ID (stable across re-renders)
function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return (h >>> 0) / 4294967296;
}

const LEVEL_ORDER = ["IC1","IC2","IC3","IC4","IC5","IC6","Manager","Director","VP","SVP","C-Suite"];
function levelIndex(level) { return LEVEL_ORDER.indexOf(level) === -1 ? 3 : LEVEL_ORDER.indexOf(level); }

// Pre-computed lookup maps passed into computeFlightRisk for O(n) total instead of O(n²)
// Returns { score: number, reasons: string[] }
function computeFlightRisk(emp, empById, deptStats, mgrPeers) {
  const now = new Date(2025, 5, 1);
  const tenureMonths = (now - new Date(emp.startDate)) / (1000 * 60 * 60 * 24 * 30.44);
  const reasons = [];

  // 1. Tenure risk
  let tenureRisk;
  if (tenureMonths < 2) { tenureRisk = 15; }
  else if (tenureMonths < 6) { tenureRisk = 45; reasons.push(`very new hire (${Math.round(tenureMonths)}mo)`); }
  else if (tenureMonths <= 18) { tenureRisk = 80; reasons.push(`joined ${Math.round(tenureMonths)}mo ago (high-risk window)`); }
  else if (tenureMonths <= 36) { tenureRisk = 55; reasons.push(`hit ${Math.round(tenureMonths)}mo (2–3yr transition window)`); }
  else if (tenureMonths <= 60) { tenureRisk = 35; }
  else { tenureRisk = 20; }

  // 2. Stagnation risk
  const lvl = levelIndex(emp.level);
  let stagnationRisk = 0;
  if (emp.level.startsWith("IC") && lvl >= 4 && tenureMonths > 36) {
    stagnationRisk = 60;
    reasons.push(`${emp.level} stagnant ${Math.round(tenureMonths / 12 * 10) / 10}yr — overdue for promo`);
  } else if (emp.level.startsWith("IC") && lvl >= 3 && tenureMonths > 48) {
    stagnationRisk = 40;
    reasons.push(`${emp.level} stagnant ${Math.round(tenureMonths / 12 * 10) / 10}yr`);
  } else if (emp.level.startsWith("IC") && lvl >= 3 && tenureMonths > 30) {
    stagnationRisk = 20;
    reasons.push(`${emp.level} for ${Math.round(tenureMonths)}mo — approaching stagnation`);
  }

  // 3. Department attrition risk (uses pre-computed map — O(1))
  const ds = deptStats[emp.dept] || { active: 0, terminated: 0 };
  const deptTotal = ds.active + ds.terminated;
  const deptAttritionRate = deptTotal > 0 ? ds.terminated / deptTotal : 0;
  const deptRisk = Math.min(50, deptAttritionRate * 200);
  if (deptAttritionRate > 0.15) reasons.push(`${emp.dept} has high attrition (${Math.round(deptAttritionRate * 100)}%)`);

  // 4. Manager risk (O(1) lookup)
  const mgr = empById[emp.managerId];
  let mgrRisk = 0;
  if (mgr) {
    const mgrTenure = (now - new Date(mgr.startDate)) / (1000 * 60 * 60 * 24 * 30.44);
    if (mgrTenure < 6) { mgrRisk = 25; reasons.push(`new manager ${mgr.first} ${mgr.last} (<6mo)`); }
    else if (mgrTenure < 12) { mgrRisk = 15; reasons.push(`manager ${mgr.first} ${mgr.last} still ramping (<1yr)`); }
  }

  // 5. Team disruption (uses pre-computed peer list — O(peers))
  const peers = (mgrPeers[emp.managerId] || []).filter(e => e.id !== emp.id);
  const recentDeps = peers.filter(e => {
    if (!e.endDate) return false;
    return (now - new Date(e.endDate)) / (1000 * 60 * 60 * 24 * 30.44) <= 12;
  });
  const disruptionRisk = peers.length > 2 && recentDeps.length / peers.length > 0.4 ? 20 : 0;
  if (disruptionRisk > 0) reasons.push(`${recentDeps.length} teammate${recentDeps.length > 1 ? "s" : ""} left in past year`);

  // 6. Seeded noise (stable across renders)
  const noise = (seededRandom(emp.id) - 0.5) * 12;

  const raw = tenureRisk * 0.38 + stagnationRisk * 0.28 + deptRisk * 0.18 + mgrRisk * 0.14 + disruptionRisk * 0.1 + noise;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return { score, reasons };
}

function flightRiskLabel(score) {
  if (score >= 45) return "high";
  if (score >= 24) return "medium";
  return "low";
}

const RISK_COLORS = { high: "#dc2626", medium: "#d97706", low: "#16a34a" };
const RISK_BG    = { high: "#fef2f2", medium: "#fffbeb", low: "#f0fdf4" };

// Single O(n) pass builds lookup tables, then scores every active employee
function computeAllFlightRisks(employees) {
  const empById  = {};
  const deptStats = {}; // dept → { active, terminated }
  const mgrPeers  = {}; // managerId → [emp, ...]

  employees.forEach(e => {
    empById[e.id] = e;
    if (!deptStats[e.dept]) deptStats[e.dept] = { active: 0, terminated: 0 };
    if (e.status === "Terminated") deptStats[e.dept].terminated++;
    else deptStats[e.dept].active++;
    if (e.managerId) {
      if (!mgrPeers[e.managerId]) mgrPeers[e.managerId] = [];
      mgrPeers[e.managerId].push(e);
    }
  });

  const out = {};
  employees.forEach(e => {
    if (e.status === "Active") out[e.id] = computeFlightRisk(e, empById, deptStats, mgrPeers);
    // out[e.id] is now { score, reasons }
  });
  return out;
}

// ─── FLIGHT RISK VIEW ───
function FlightRiskView() {
  const { employees, navigateTo, setView, setDetailPanel, setFocusRoot } = useContext(AppCtx);
  const [sortBy, setSortBy] = useState("score");
  const [filterDept, setFilterDept] = useState("All");

  const flightRisks = useMemo(() => computeAllFlightRisks(employees), [employees]);
  const activeEmps  = useMemo(() => employees.filter(e => e.status === "Active"), [employees]);
  const depts       = useMemo(() => [...new Set(activeEmps.map(e => e.dept))].sort(), [activeEmps]);

  const ranked = useMemo(() => {
    let list = activeEmps.map(e => {
      const fr = flightRisks[e.id] || { score: 0, reasons: [] };
      return { ...e, score: fr.score, reasons: fr.reasons, risk: flightRiskLabel(fr.score) };
    });
    if (filterDept !== "All") list = list.filter(e => e.dept === filterDept);
    if (sortBy === "score") list.sort((a,b) => b.score - a.score);
    else if (sortBy === "dept") list.sort((a,b) => a.dept.localeCompare(b.dept) || b.score - a.score);
    else if (sortBy === "level") list.sort((a,b) => levelIndex(b.level) - levelIndex(a.level) || b.score - a.score);
    return list;
  }, [activeEmps, flightRisks, sortBy, filterDept]);

  const highRisk   = ranked.filter(e => e.risk === "high").length;
  const medRisk    = ranked.filter(e => e.risk === "medium").length;
  const lowRisk    = ranked.filter(e => e.risk === "low").length;

  // Manager risk summary
  const mgrRisk = useMemo(() => {
    const mgrs = {};
    ranked.forEach(e => {
      if (!e.managerId) return;
      if (!mgrs[e.managerId]) mgrs[e.managerId] = { scores: [], name: "" };
      mgrs[e.managerId].scores.push(e.score);
    });
    return Object.entries(mgrs)
      .map(([id, { scores }]) => {
        const mgr = employees.find(e => e.id === id);
        if (!mgr) return null;
        return { id, name: `${mgr.first} ${mgr.last}`, dept: mgr.dept, avgRisk: Math.round(scores.reduce((a,b)=>a+b,0)/scores.length), teamSize: scores.length };
      })
      .filter(Boolean)
      .sort((a,b) => b.avgRisk - a.avgRisk)
      .slice(0, 10);
  }, [ranked, employees]);

  // Distribution histogram buckets
  const histBuckets = useMemo(() => {
    const buckets = Array(10).fill(0);
    ranked.forEach(e => { const bi = Math.min(9, Math.floor(e.score / 10)); buckets[bi]++; });
    return buckets.map((count,i) => ({ range: `${i*10}-${i*10+9}`, count }));
  }, [ranked]);

  const [riskFilter, setRiskFilter] = useState("all"); // "all", "high", "medium"

  const visibleRanked = useMemo(() => {
    if (riskFilter === "all") return ranked.filter(e => e.risk !== "low");
    return ranked.filter(e => e.risk === riskFilter);
  }, [ranked, riskFilter]);

  return (
    <div className="p-6 h-full overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Flight Risk Dashboard<Help text="Ranks active employees by attrition risk, scored from tenure, role stagnation, recent manager changes, and peer departures. Sort or filter the list and click anyone to open them in the org chart." side="bottom" width={300} /></h2>
          <p className="text-sm text-gray-500">Attrition risk scores computed from tenure, stagnation, team disruption & manager signals</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "High Risk", count: highRisk, pct: Math.round(highRisk/ranked.length*100), color: "#dc2626", bg: "#fef2f2", filter: "high" },
          { label: "Medium Risk", count: medRisk, pct: Math.round(medRisk/ranked.length*100), color: "#d97706", bg: "#fffbeb", filter: "medium" },
          { label: "Low Risk", count: lowRisk, pct: Math.round(lowRisk/ranked.length*100), color: "#16a34a", bg: "#f0fdf4", filter: "low" },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-4 border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${riskFilter === k.filter ? "ring-2 ring-offset-1" : ""}`}
            style={{ background: k.bg, borderColor: k.color+"33", ...(riskFilter === k.filter ? { ringColor: k.color } : {}) }}
            onClick={() => setRiskFilter(prev => prev === k.filter ? "all" : k.filter)}>
            <div className="text-3xl font-black" style={{ color: k.color }}>{k.count}</div>
            <div className="text-sm font-semibold text-gray-700">{k.label}</div>
            <div className="text-xs text-gray-500">{k.pct}% of active workforce</div>
            {riskFilter === k.filter && <div className="text-xs mt-1 font-medium" style={{ color: k.color }}>✓ Filtered — click to clear</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Histogram */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Risk Score Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={histBuckets} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="range" tick={{ fontSize: 8 }} interval={0}/>
              <YAxis tick={{ fontSize: 9 }}/>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={v => [v, "Employees"]}/>
              <Bar dataKey="count" radius={[3,3,0,0]}>
                {histBuckets.map((_, i) => (
                  <Cell key={i} fill={i >= 7 ? "#dc2626" : i >= 4 ? "#d97706" : "#16a34a"} fillOpacity={0.8}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Highest-risk managers */}
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Highest-Risk Teams (by manager avg)</h3>
          <div className="space-y-2">
            {mgrRisk.slice(0, 6).map(m => (
              <div key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
                onClick={() => { navigateTo(m.id); setView("org-chart"); }}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-800 truncate hover:text-blue-600">{m.name}</div>
                  <div className="text-xs text-gray-400 truncate">{m.dept} · {m.teamSize} reports</div>
                </div>
                <div className="w-16 h-1.5 bg-gray-100 rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${m.avgRisk}%`, background: m.avgRisk >= 65 ? "#dc2626" : m.avgRisk >= 35 ? "#d97706" : "#16a34a" }}/>
                </div>
                <div className="text-xs font-bold w-6 text-right" style={{ color: m.avgRisk >= 65 ? "#dc2626" : m.avgRisk >= 35 ? "#d97706" : "#16a34a" }}>{m.avgRisk}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ranked table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex items-center gap-3">
          <h3 className="text-sm font-bold text-gray-700 flex-1">At-Risk Employees</h3>
          <button onClick={() => {
            const atRisk = ranked.filter(e => e.risk !== "low");
            const cols = ["Name","Dept","Level","Manager","Risk Score","Risk Level","Reasons"];
            const rows = atRisk.map(e => {
              const mgr = employees.find(m => m.id === e.managerId);
              return [csvCell(`${e.first} ${e.last}`), csvCell(e.dept), csvCell(e.level),
                csvCell(mgr ? mgr.first + " " + mgr.last : "—"), csvCell(e.score), csvCell(e.risk.toUpperCase()),
                csvCell(e.reasons.join("; "))].join(",");
            });
            const blob = new Blob([[cols.join(","), ...rows].join("\n")], { type: "text/csv" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "flight-risk-report.csv"; a.click();
          }} className="flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
            <Download size={10}/>Export Risk List
          </button>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
            <option value="All">All Depts</option>
            {depts.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
            <option value="score">Sort: Risk Score</option>
            <option value="dept">Sort: Department</option>
            <option value="level">Sort: Level</option>
          </select>
        </div>
        <div className="overflow-auto max-h-80">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 text-gray-500 font-semibold">Employee</th>
                <th className="text-left px-4 py-2 text-gray-500 font-semibold">Dept</th>
                <th className="text-left px-4 py-2 text-gray-500 font-semibold">Level</th>
                <th className="text-left px-4 py-2 text-gray-500 font-semibold">Why</th>
                <th className="text-right px-4 py-2 text-gray-500 font-semibold">Risk</th>
              </tr>
            </thead>
            <tbody>
              {visibleRanked.map(e => {
                return (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => { navigateTo(e.id); setView("org-chart"); }}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full text-white flex items-center justify-center font-bold shrink-0" style={{ background: DEPT_COLORS[e.dept]||"#64748b", fontSize: 9 }}>{e.first[0]}{e.last[0]}</div>
                        <span className="font-medium text-gray-800 hover:text-blue-600">{e.first} {e.last}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{e.dept}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{displayLevel(e.level)}</td>
                    <td className="px-4 py-2 text-gray-500" style={{ maxWidth: 220 }}>
                      {e.reasons.length > 0
                        ? <ul className="list-none space-y-0.5">{e.reasons.map((r, i) => (
                            <li key={i} className="text-gray-500 flex items-start gap-1" style={{ fontSize: 10 }}>
                              <span className="text-amber-400 mt-0.5 shrink-0">▸</span>{r}
                            </li>
                          ))}</ul>
                        : <span className="text-gray-300" style={{ fontSize: 10 }}>—</span>
                      }
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <div className="w-12 h-1.5 bg-gray-100 rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${e.score}%`, background: RISK_COLORS[e.risk] }}/>
                        </div>
                        <span className="font-bold w-5 text-right" style={{ color: RISK_COLORS[e.risk] }}>{e.score}</span>
                        <span className="px-1.5 py-0.5 rounded text-white text-xs font-semibold" style={{ background: RISK_COLORS[e.risk], fontSize: 9 }}>
                          {e.risk.toUpperCase()}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ANIMATED NUMBER HOOK ───
function useAnimatedNumber(target, duration = 500) {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const frameRef = useRef(null);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const startValue = displayRef.current;
    if (startValue === target) return;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (target - startValue) * eased);
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return display;
}

// ─── MODE SYSTEM ───
// simple = org chart only, clean UI
// advanced = headcount planning, analytics, dashboards, flight risk, timeline
// expert = recruiting capacity, pipeline, diff
const MODES = ["simple", "advanced", "expert"];
const MODE_LEVEL = { simple: 0, advanced: 1, expert: 2 };
function atLeast(current, required) { return MODE_LEVEL[current] >= MODE_LEVEL[required]; }
// Minimum mode required to display each view — used to redirect on mode downgrade
const VIEW_MIN_MODE = { "org-chart": "simple", "slides": "simple", "timeline": "advanced", "dashboards": "advanced", "headcount": "advanced", "analytics": "advanced", "pipeline": "expert" };
const VIEW_LABEL = { "org-chart": "Org Chart", "timeline": "Timeline", "dashboards": "Dashboards", "headcount": "Headcount Plan", "analytics": "Analytics", "pipeline": "Product Pipeline" };

const MODE_META = {
  simple:   { label: "Simple",   color: "#2563eb", desc: "Org chart & people search" },
  advanced: { label: "Advanced", color: "#7c3aed", desc: "Dashboards, analytics & headcount planning" },
  expert:   { label: "Expert",   color: "#dc2626", desc: "Recruiting capacity & product pipeline" },
};

// ─── TOOLTIP ───
function Tip({ text, children, side = "top", width = "auto" }) {
  const [show, setShow] = useState(false);
  const pos = {
    top:    "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    right:  "left-full ml-2 top-1/2 -translate-y-1/2",
    left:   "right-full mr-2 top-1/2 -translate-y-1/2",
  }[side];
  const arrow = {
    top:    "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900",
    bottom: "absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900",
    right:  "absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900",
    left:   "absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900",
  }[side];
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && text && (
        <div className={`absolute z-[9999] pointer-events-none ${pos}`} style={{ width }}>
          <div className="bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-xl leading-relaxed" style={{ whiteSpace: width === "auto" ? "nowrap" : "normal" }}>
            {text}
          </div>
          <div className={arrow}/>
        </div>
      )}
    </div>
  );
}

// ─── APP-WIDE CONTEXT ───
// All inner components use this instead of being nested inside OrgChartApp.
// This prevents React from unmounting/remounting them on every state change,
// which was the root cause of timeline jumping and drag-and-drop breaking.
// ─── INITIAL ANNOTATION GENERATOR ───
const HOTSPOT_NOTES = [
  "Flagged in Q3 planning review — needs reorg discussion",
  "HR aware, no action taken yet. Follow up needed by EOQ.",
  "Team lead capacity concern raised by skip-level feedback",
  "Excessive meeting load reported — blocking IC productivity",
  "Multiple escalations from this team in past 90 days",
  "Pending headcount approval to split this team",
  "Manager expressed burnout risk in last 1:1",
  "Cross-functional dependencies causing bottleneck here",
  "Action item from leadership offsite: restructure by Q1",
  "Director flagged as single point of failure for release sign-off",
  "Retention bonus approved but not yet communicated",
  "Team morale survey score dropped 18pts quarter-over-quarter",
];
const FLIGHT_RISK_NOTES = [
  "Passed over for promo last cycle — consider retention package",
  "Competing offer rumored from [REDACTED]. Urgent.",
  "Key domain expert — losing them would delay tape-out 6+ weeks",
  "Has expressed interest in internal transfer to Data Center BU",
  "1:1 notes suggest dissatisfaction with project direction",
  "Spouse relocating — may need remote work arrangement",
  "Vesting cliff approaching in 4 months — critical retention window",
  "Mentor/mentee pair — if they leave, 3 others likely follow",
  "Completed external interviews per LinkedIn activity",
  "Only person who understands legacy SerDes IP — knowledge risk",
  "Requested sabbatical, denied. Flight risk elevated.",
  "Performance review was strong but comp adjustment was below market",
  "Has been in same role 4+ years — discuss growth path ASAP",
  "Recently lost trusted manager — adjustment period ongoing",
];
function generateInitialAnnotations(employees, tree, flightRisks) {
  const annots = {};
  const rn = arr => arr[Math.floor(Math.random() * arr.length)];
  // Annotate hotspot nodes
  const hotspots = detectHotspots(tree);
  hotspots.forEach(h => {
    if (Math.random() < 0.55) {
      if (!annots[h.nodeId]) annots[h.nodeId] = [];
      annots[h.nodeId].push({
        text: rn(HOTSPOT_NOTES),
        type: h.severity === "critical" ? "hotspot" : Math.random() < 0.5 ? "flag" : "note",
        date: new Date(2025, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)).toISOString(),
      });
    }
  });
  // Annotate high & medium flight risk nodes
  Object.entries(flightRisks).forEach(([id, { score }]) => {
    const label = flightRiskLabel(score);
    if (label === "high" && Math.random() < 0.6) {
      if (!annots[id]) annots[id] = [];
      annots[id].push({
        text: rn(FLIGHT_RISK_NOTES),
        type: Math.random() < 0.5 ? "flag" : "hotspot",
        date: new Date(2025, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)).toISOString(),
      });
    } else if (label === "medium" && Math.random() < 0.25) {
      if (!annots[id]) annots[id] = [];
      annots[id].push({
        text: rn(FLIGHT_RISK_NOTES),
        type: "note",
        date: new Date(2025, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)).toISOString(),
      });
    }
  });
  return annots;
}

const AppCtx = createContext(null);

// Inline help dot — only renders when tutorialMode is on. Hover shows the explanation
// in the existing dark Tip tooltip. Use width="auto" for short blurbs that should not
// wrap, or pass a number/CSS length when the text is long enough to need wrapping.
function Help({ text, side = "top", width = 260 }) {
  const ctx = useContext(AppCtx);
  if (!ctx?.tutorialMode || !text) return null;
  const w = typeof width === "number" ? `${width}px` : width;
  return (
    <Tip text={text} side={side} width={w}>
      <span
        role="img"
        aria-label="Help"
        className="inline-flex items-center justify-center w-4 h-4 ml-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold cursor-help hover:bg-blue-200 transition-colors align-middle"
        style={{ lineHeight: 1 }}>
        ?
      </span>
    </Tip>
  );
}

// Cmd/Ctrl+K command palette: fuzzy search across name, title, dept, location, id.
// Listens to its own keydown (arrow nav, Enter, Esc) and is opened/closed via context.
function CommandPalette() {
  const ctx = useContext(AppCtx);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  // Reset state every time the palette opens
  useEffect(() => {
    if (ctx?.cmdkOpen) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [ctx?.cmdkOpen]);

  const matches = useMemo(() => {
    if (!ctx) return [];
    const employees = ctx.activeEmployees || [];
    if (!q) return employees.slice(0, 8); // Default: first few people
    const lq = q.toLowerCase();
    return employees.map(e => {
      const name = `${e.first} ${e.last}`.toLowerCase();
      let s = 0;
      if (name === lq)              s += 200;
      else if (name.startsWith(lq)) s += 120;
      else if (name.includes(lq))   s += 60;
      if (e.title?.toLowerCase().includes(lq))    s += 35;
      if (e.dept?.toLowerCase() === lq)           s += 80;
      else if (e.dept?.toLowerCase().includes(lq)) s += 25;
      if (e.location?.toLowerCase().includes(lq)) s += 20;
      if (e.id?.toLowerCase().includes(lq))       s += 15;
      if (e.level?.toLowerCase() === lq)          s += 30;
      return { e, s };
    }).filter(r => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 12);
  }, [q, ctx?.activeEmployees, ctx]);

  if (!ctx?.cmdkOpen) return null;

  const close = () => ctx.setCmdkOpen(false);
  const pick = (e) => { ctx.setView("org-chart"); ctx.navigateTo(e.id); close(); };

  const onKey = (ev) => {
    if (ev.key === "Escape")    { ev.preventDefault(); close(); return; }
    if (ev.key === "ArrowDown") { ev.preventDefault(); setIdx(i => Math.min(i + 1, matches.length - 1)); return; }
    if (ev.key === "ArrowUp")   { ev.preventDefault(); setIdx(i => Math.max(i - 1, 0)); return; }
    if (ev.key === "Enter")     { ev.preventDefault(); const m = matches[idx]; if (m) pick(m.e || m); return; }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]"
      style={{ background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(4px)" }}
      onClick={close}>
      <div
        className="w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "70vh" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={16} className="text-gray-400 shrink-0"/>
          <input
            ref={inputRef}
            value={q}
            onChange={e => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={onKey}
            placeholder="Search by name, title, department, location, level, or ID…"
            className="flex-1 text-sm focus:outline-none bg-transparent"/>
          <span className="text-[10px] text-gray-400 px-1.5 py-0.5 border border-gray-200 rounded font-mono">esc</span>
        </div>
        <div className="overflow-y-auto flex-1">
          {matches.length === 0 && q && (
            <div className="px-4 py-8 text-center text-xs text-gray-400">
              No people match "{q}".
            </div>
          )}
          {matches.length === 0 && !q && (
            <div className="px-4 py-8 text-center text-xs text-gray-400">
              Start typing to search across {ctx.activeEmployees?.length || 0} people.
            </div>
          )}
          {matches.map((m, i) => {
            const e = m.e || m;
            const active = i === idx;
            return (
              <button
                key={e.id}
                onMouseEnter={() => setIdx(i)}
                onClick={() => pick(e)}
                className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${active ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: DEPT_COLORS[e.dept] || "#64748b" }}>
                  {e.first?.[0] || ""}{e.last?.[0] || ""}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{e.first} {e.last}</div>
                  <div className="text-xs text-gray-500 truncate">{e.title} · {e.dept} · {e.location}</div>
                </div>
                <span className="text-[9px] font-mono text-gray-400 shrink-0">{e.level}</span>
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-[10px] text-gray-400">
          <span><span className="font-mono">↑↓</span> navigate</span>
          <span><span className="font-mono">↵</span> open</span>
          <span><span className="font-mono">esc</span> close</span>
          <span className="ml-auto"><span className="font-mono">⌘/Ctrl + K</span> to toggle</span>
        </div>
      </div>
    </div>
  );
}

// Reorg ripple preview: when the user drags a node onto a new manager, we stash the
// proposed move in `pendingDrop` and show this modal first instead of committing.
// Confirm = run the mutation (still pushes undo); Cancel = discard the proposal.
const LEVEL_RANK = {
  L1:1, L2:2, L3:3, L4:4, L5:5, L6:6, L7:7,
  M1:8, M2:9, M3:10, M4:11,
  E1:12, E2:13, E3:14,
};
function ReorgRipplePreview() {
  const ctx = useContext(AppCtx);
  const pending = ctx?.pendingDrop;

  // Memoise ripples so we only walk the employee list when pending changes.
  const ripples = useMemo(() => {
    if (!pending || !ctx) return null;
    const employees = ctx.employees;
    const byId = new Map(employees.map(e => [e.id, e]));
    const dragged = byId.get(pending.dragNodeId);
    const target  = byId.get(pending.targetId);
    if (!dragged || !target) return null;

    // Walk descendants of dragged
    const subtreeIds = new Set([dragged.id]);
    let grew = true;
    while (grew) {
      grew = false;
      employees.forEach(e => {
        if (!subtreeIds.has(e.id) && e.managerId && subtreeIds.has(e.managerId)) {
          subtreeIds.add(e.id); grew = true;
        }
      });
    }
    const subtree = employees.filter(e => subtreeIds.has(e.id));
    const directReportsOfDragged = employees.filter(e => e.managerId === dragged.id);

    // Path from target up to root — used to detect dropping on a descendant
    const ancestorIds = new Set();
    let cur = target;
    while (cur) { ancestorIds.add(cur.id); cur = cur.managerId ? byId.get(cur.managerId) : null; }
    const droppedOnDescendant = ancestorIds.has(dragged.id);
    const wouldCreateCycle = droppedOnDescendant && !pending.moveAsTeam;

    const oldMgr = dragged.managerId ? byId.get(dragged.managerId) : null;
    const newMgr = target;

    // Who actually moves: team mode = whole subtree, individual = just dragged node
    const movedPeople = pending.moveAsTeam ? subtree : [dragged];
    const movedIds = new Set(movedPeople.map(p => p.id));

    // Span-of-control deltas
    const oldMgrDirectsBefore  = oldMgr ? employees.filter(e => e.managerId === oldMgr.id).length : 0;
    const newMgrDirectsBefore  = employees.filter(e => e.managerId === newMgr.id).length;
    let oldMgrDirectsAfter, newMgrDirectsAfter;
    if (pending.moveAsTeam) {
      // Team: only the dragged node itself was a direct report; subtree members keep their parents
      oldMgrDirectsAfter = oldMgr ? oldMgrDirectsBefore - 1 : 0;
      newMgrDirectsAfter = newMgrDirectsBefore + 1;
    } else {
      // Individual: dragged moves alone, his/her direct reports roll up to old manager
      oldMgrDirectsAfter = oldMgr ? (oldMgrDirectsBefore - 1 + directReportsOfDragged.length) : 0;
      newMgrDirectsAfter = newMgrDirectsBefore + 1;
    }

    // Cross-department transfers: moved people whose dept != new manager's dept
    const crossDept = movedPeople.filter(p => p.dept !== newMgr.dept);

    // Warnings
    const warnings = [];
    if (wouldCreateCycle) warnings.push({ kind: "block", text: "Cannot drop a manager onto their own descendant in individual mode — would create a cycle. Hold Shift or use team mode to swap superior↔subordinate." });
    if (newMgrDirectsAfter > 12 && !wouldCreateCycle) warnings.push({ kind: "warn", text: `${newMgr.first} ${newMgr.last} would have ${newMgrDirectsAfter} direct reports — above the 8-12 healthy span.` });
    const draggedRank = LEVEL_RANK[dragged.level] ?? 0;
    const newMgrRank  = LEVEL_RANK[newMgr.level]  ?? 0;
    if (draggedRank >= newMgrRank) warnings.push({ kind: "warn", text: `Level inversion: ${dragged.first} (${dragged.level}) reporting to ${newMgr.first} (${newMgr.level}). Usually a smell unless this is a temporary acting role.` });
    if (crossDept.length > 0) warnings.push({ kind: "info", text: `${crossDept.length} ${crossDept.length === 1 ? "person changes" : "people change"} departments (→ ${newMgr.dept}). Update titles/bands separately if needed.` });

    return {
      dragged, target, oldMgr, newMgr,
      subtree, directReportsOfDragged,
      movedPeople, crossDept,
      oldMgrDirectsBefore, oldMgrDirectsAfter,
      newMgrDirectsBefore, newMgrDirectsAfter,
      warnings, wouldCreateCycle,
      moveAsTeam: pending.moveAsTeam,
    };
  }, [pending, ctx?.employees]);

  if (!pending || !ripples) return null;

  const { dragged, oldMgr, newMgr, movedPeople, crossDept,
          oldMgrDirectsBefore, oldMgrDirectsAfter, newMgrDirectsBefore, newMgrDirectsAfter,
          warnings, wouldCreateCycle, moveAsTeam } = ripples;

  const Stat = ({ label, before, after, suffix = "" }) => {
    const delta = after - before;
    const color = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-gray-400";
    const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "·";
    return (
      <div className="flex items-center justify-between text-xs py-1.5">
        <span className="text-gray-600">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-gray-400">{before}{suffix}</span>
          <span className="text-gray-300">→</span>
          <span className="font-mono font-bold text-gray-900">{after}{suffix}</span>
          <span className={`text-[10px] font-semibold ${color}`}>{arrow}{Math.abs(delta)}</span>
        </span>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(4px)" }}
      onClick={ctx.cancelDrop}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
               style={{ background: DEPT_COLORS[dragged.dept] || "#64748b" }}>
            {dragged.first?.[0]}{dragged.last?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-500">Reorg preview</div>
            <div className="text-base font-bold text-gray-900">
              Move {dragged.first} {dragged.last} {moveAsTeam && <span className="text-xs font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-1">+ team</span>} →
            </div>
            <div className="text-sm text-gray-700 mt-0.5">
              {oldMgr ? <>From <b>{oldMgr.first} {oldMgr.last}</b> ({oldMgr.dept})</> : <>From <b>top-level</b></>} → To <b>{newMgr.first} {newMgr.last}</b> ({newMgr.dept})
            </div>
          </div>
          <button onClick={ctx.cancelDrop} className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2">×</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 grid grid-cols-2 gap-5">
          {/* Span-of-control */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Span of control</h3>
            <div className="bg-gray-50 rounded-lg p-3">
              {oldMgr && <Stat label={`${oldMgr.first}'s direct reports`} before={oldMgrDirectsBefore} after={oldMgrDirectsAfter} />}
              <Stat label={`${newMgr.first}'s direct reports`} before={newMgrDirectsBefore} after={newMgrDirectsAfter} />
            </div>
            {!moveAsTeam && (
              <div className="text-[10px] text-gray-400 mt-1.5">
                Individual move: {dragged.first}'s direct reports roll up to their previous manager.
              </div>
            )}
          </div>

          {/* People moving */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
              People moving · {movedPeople.length}
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              {movedPeople.slice(0, 12).map(p => (
                <div key={p.id} className="flex items-center gap-2 py-1 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: DEPT_COLORS[p.dept] || "#64748b" }}/>
                  <span className="font-medium text-gray-800">{p.first} {p.last}</span>
                  <span className="text-gray-400 ml-auto font-mono text-[10px]">{p.level}</span>
                </div>
              ))}
              {movedPeople.length > 12 && <div className="text-[10px] text-gray-400 mt-1">+ {movedPeople.length - 12} more</div>}
            </div>
          </div>

          {/* Cross-dept transfers */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Cross-dept transfers
            </h3>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-900">{crossDept.length}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {crossDept.length === 0 ? "Same department, no transfer." : `Moving into ${newMgr.dept}.`}
              </div>
            </div>
          </div>

        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="px-5 pb-3 space-y-2">
            {warnings.map((w, i) => {
              const styles = w.kind === "block"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : w.kind === "warn"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-blue-50 border-blue-200 text-blue-900";
              return (
                <div key={i} className={`border rounded-lg px-3 py-2 text-xs ${styles}`}>
                  <span className="font-semibold mr-1.5">{w.kind === "block" ? "Blocked:" : w.kind === "warn" ? "Warning:" : "Note:"}</span>
                  {w.text}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 mt-auto">
          <button onClick={ctx.cancelDrop}
            className="text-sm px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button onClick={ctx.confirmDrop}
            disabled={wouldCreateCycle}
            className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Confirm move (Ctrl+Z to undo)
          </button>
        </div>
      </div>
    </div>
  );
}

// Natural-language queries: send the employee dataset to Claude with prompt caching
// so repeat queries are cheap, then highlight any returned employee IDs on the chart.
// API key lives only in this browser's localStorage — never sent anywhere except
// directly to api.anthropic.com.
function NaturalLanguageQuery() {
  const ctx = useContext(AppCtx);
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem("orgSimAnthropicKey") || ""; } catch { return ""; }
  });
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("orgSimNLHistory") || "[]"); } catch { return []; }
  });
  const inputRef = useRef(null);

  useEffect(() => {
    if (ctx?.nlOpen) {
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [ctx?.nlOpen]);

  // Compact employee serialisation: just the fields the model needs to reason. Costs
  // ~25 tokens per person — 200-person org fits in ~5K tokens, well under context.
  const employeesAsContext = useMemo(() => {
    const emps = ctx?.activeEmployees || [];
    return emps.map(e => `${e.id} | ${e.first} ${e.last} | ${e.title} | ${e.level} | ${e.dept} | ${e.location} | mgr=${e.managerId || "—"}`).join("\n");
  }, [ctx?.activeEmployees]);

  if (!ctx?.nlOpen) return null;

  const close = () => ctx.setNlOpen(false);

  const saveKey = (k) => {
    setApiKey(k);
    try { localStorage.setItem("orgSimAnthropicKey", k); } catch {}
  };
  const clearKey = () => {
    setApiKey("");
    try { localStorage.removeItem("orgSimAnthropicKey"); } catch {}
  };

  async function ask() {
    if (!question.trim() || !apiKey) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-opus-4-7",
          max_tokens: 4096,
          thinking: { type: "adaptive" },
          output_config: {
            effort: "medium",
            format: {
              type: "json_schema",
              schema: {
                type: "object",
                properties: {
                  answer: { type: "string", description: "Markdown-formatted answer to the user's question. Be concise. Cite specific people by name." },
                  highlight_ids: { type: "array", items: { type: "string" }, description: "Employee IDs (the leftmost field in the dataset) to visually highlight on the org chart. Empty array if no specific people are relevant." },
                  focus_id: { type: ["string", "null"], description: "Single employee ID to scroll/focus the org chart on. Use when the answer is about one specific person or one specific subtree. Null otherwise." },
                },
                required: ["answer", "highlight_ids", "focus_id"],
                additionalProperties: false,
              },
            },
          },
          system: [
            {
              type: "text",
              text: "You are an org analytics assistant for a recruiting/headcount planning tool. Answer questions about the organization concisely and accurately, citing specific people by name when relevant. Use markdown for formatting. When the question is about specific people or a subtree, populate highlight_ids and (if appropriate) focus_id so the UI can show them on the chart. The data format is one employee per line: `id | first last | title | level | dept | location | mgr=managerId`.",
            },
            {
              type: "text",
              text: `Current org dataset (${(ctx.activeEmployees || []).length} active people):\n\n${employeesAsContext}`,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: question }],
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        let msg = `API error ${resp.status}`;
        try { msg = JSON.parse(errText)?.error?.message || msg; } catch {}
        throw new Error(msg);
      }
      const data = await resp.json();
      const textBlock = data.content?.find(b => b.type === "text");
      if (!textBlock?.text) throw new Error("No answer in response");
      const parsed = JSON.parse(textBlock.text);

      setResult(parsed);
      const next = [{ q: question, ts: Date.now() }, ...history].slice(0, 8);
      setHistory(next);
      try { localStorage.setItem("orgSimNLHistory", JSON.stringify(next)); } catch {}

      // Apply highlights on the chart
      if (parsed.highlight_ids?.length) {
        const valid = parsed.highlight_ids.filter(id => ctx.tree.map[id]);
        ctx.setInsightHighlightIds(new Set(valid));
      }
      if (parsed.focus_id && ctx.tree.map[parsed.focus_id]) {
        ctx.setView("org-chart");
        ctx.navigateTo(parsed.focus_id);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const onKey = (e) => {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ask(); return; }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh]"
      style={{ background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(4px)" }}
      onClick={close}>
      <div
        className="w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "82vh" }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Sparkles size={16} className="text-violet-600"/>
          <div className="font-semibold text-sm text-gray-900">Ask the org</div>
          <span className="text-[10px] text-gray-400 ml-2">powered by Claude Opus 4.7</span>
          <button onClick={close} className="ml-auto text-gray-400 hover:text-gray-700 text-xl leading-none px-2">×</button>
        </div>

        {/* API key gate */}
        {!apiKey ? (
          <div className="px-5 py-5 space-y-3">
            <div className="text-sm text-gray-700">
              Paste your <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-blue-600 underline">Anthropic API key</a> to enable natural-language queries.
            </div>
            <div className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded p-2">
              Your key is stored only in this browser's <code>localStorage</code> and sent directly to <code>api.anthropic.com</code>. Nothing else sees it. Clear it any time below.
            </div>
            <input
              type="password"
              placeholder="sk-ant-..."
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && e.target.value.startsWith("sk-")) saveKey(e.target.value.trim()); }}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            <div className="text-[11px] text-gray-400">Press <span className="font-mono">Enter</span> to save.</div>
          </div>
        ) : (
          <>
            {/* Question input */}
            <div className="px-5 py-3 border-b border-gray-100">
              <textarea
                ref={inputRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={onKey}
                placeholder="e.g. Who reports to Maya transitively? · Single points of failure in Hsinchu · Compare engineering early-career mix to product"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={ask}
                  disabled={loading || !question.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                  <Sparkles size={12}/>
                  {loading ? "Thinking..." : "Ask"}
                </button>
                <span className="text-[10px] text-gray-400">⌘/Ctrl + Enter to submit</span>
                <button onClick={clearKey} className="ml-auto text-[10px] text-gray-400 hover:text-rose-600">Clear API key</button>
              </div>
            </div>

            {/* Output */}
            <div className="overflow-y-auto flex-1 px-5 py-4 text-sm">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded p-3 text-xs">
                  <b>Error:</b> {error}
                </div>
              )}
              {loading && (
                <div className="text-gray-400 text-xs italic">Querying Claude — adaptive thinking, prompt caching enabled…</div>
              )}
              {result && !loading && (
                <div className="space-y-3">
                  <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">{result.answer}</div>
                  {result.highlight_ids?.length > 0 && (
                    <div className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded p-2">
                      Highlighted <b>{result.highlight_ids.length}</b> {result.highlight_ids.length === 1 ? "person" : "people"} on the org chart.
                      {result.focus_id && <> Scrolled to <b>{ctx.tree.map[result.focus_id]?.first} {ctx.tree.map[result.focus_id]?.last}</b>.</>}
                    </div>
                  )}
                </div>
              )}
              {!result && !loading && !error && history.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-2">Recent queries</div>
                  <div className="space-y-1">
                    {history.map((h, i) => (
                      <button key={i} onClick={() => setQuestion(h.q)}
                        className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 text-gray-600 truncate">
                        {h.q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── LEVEL DISPLAY MAPPING (L1-L7 / M1-M4 / E1-E3) ───
// Internal data still uses IC1..C-Suite; UI surfaces the new labels via displayLevel().
const LEVEL_LABELS = {
  IC1: "L1", IC2: "L2", IC3: "L3", IC4: "L4", IC5: "L5", IC6: "L6",
  Manager: "M1", Director: "M2",
  VP: "E1", SVP: "E2", "C-Suite": "E3",
};
const ALL_DISPLAY_LEVELS = ["L1","L2","L3","L4","L5","L6","L7","M1","M2","M3","M4","E1","E2","E3"];
const EARLY_DISPLAY_LEVELS = new Set(["L1","L2"]);
function displayLevel(level) { return LEVEL_LABELS[level] || level; }
function isEarlyCareer(level) { return EARLY_DISPLAY_LEVELS.has(displayLevel(level)); }
function levelTier(displayLvl) {
  if (displayLvl?.startsWith("L")) return "IC";
  if (displayLvl?.startsWith("M")) return "Manager";
  if (displayLvl?.startsWith("E")) return "Executive";
  return "Other";
}

// ─── REQUISITION HELPERS (shared by HeadcountPlanningView + OrgChartApp) ───
function seededRand(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6D2B79F5; let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickTitleForReq(group, displayLvl, rng) {
  const tier = levelTier(displayLvl);
  const pool = SEMI_TITLES[group] || SEMI_TITLES["Software"] || [`${group} Specialist`];
  let base = pool[Math.floor(rng() * pool.length)];
  if (displayLvl === "L1") base = base.replace(/^(Sr\.|Principal)\s+/, "") + " I";
  else if (displayLvl === "L2") base = base.replace(/^(Sr\.|Principal)\s+/, "") + " II";
  else if (tier === "Manager") base = `${displayLvl === "M1" ? "Manager" : displayLvl === "M2" ? "Director" : "Sr. Director"}, ${group}`;
  else if (tier === "Executive") base = `${displayLvl === "E1" ? "VP" : displayLvl === "E2" ? "SVP" : "C-Level"}, ${group}`;
  return base;
}
// Builds plan-only requisitions deterministically. Both the planner and the org chart use this
// so IDs match across views and reqOverrides apply consistently.
function buildPlanReqs({ plan, managersByGroup, horizon, planStartYear, planHorizonQ }) {
  const reqs = [];
  let idCounter = 1;
  const mkReq = (group, level, qIdx, hMgr, rng) => {
    const horizonEntry = horizon[Math.min(qIdx, horizon.length - 1)] || { year: planStartYear, q: "Q1" };
    const qNum = parseInt(horizonEntry.q.replace("Q", ""), 10);
    const startMonth = (qNum - 1) * 3 + 1;
    const targetStart = `${horizonEntry.year}-${String(startMonth).padStart(2, "0")}-01`;
    const open = new Date(`${targetStart}T00:00:00`);
    open.setDate(open.getDate() - 60);
    const openDate = open.toISOString().slice(0, 10);
    const isEC = EARLY_DISPLAY_LEVELS.has(level);
    const loc = hMgr ? hMgr.location : LOCATIONS[Math.floor(rng() * LOCATIONS.length)];
    const country = countryFor(loc);
    const sIdx = Math.floor(rng() * 12);
    const status = sIdx < 7 ? "Open" : sIdx < 9 ? "Sourcing" : sIdx === 9 ? "Interviewing" : sIdx === 10 ? "Offer" : "Filled";
    return {
      id: `REQ-${String(idCounter++).padStart(4, "0")}`,
      group, level, isEC,
      title: pickTitleForReq(group, level, rng),
      location: loc, country,
      openDate, targetStart, quarter: `${horizonEntry.year} ${horizonEntry.q}`,
      hiringManager: hMgr ? `${hMgr.first} ${hMgr.last}` : "TBD",
      hiringManagerId: hMgr ? hMgr.id : null,
      employmentType: "FTE",
      source: "plan", status,
    };
  };
  // Iterate groups in sorted order so IDs are stable
  Object.keys(plan).sort().forEach(group => {
    const byLv = plan[group];
    const rng = seededRand(`${group}|plan|${planStartYear}|${planHorizonQ}`);
    const mgrs = managersByGroup[group] || [];
    Object.keys(byLv).sort().forEach(lv => {
      const delta = byLv[lv];
      if (delta <= 0) return;
      const total = delta;
      for (let i = 0; i < total; i++) {
        const qIdx = Math.floor(i * planHorizonQ / total);
        const hMgr = mgrs.length ? mgrs[Math.floor(rng() * mgrs.length)] : null;
        reqs.push(mkReq(group, lv, qIdx, hMgr, rng));
      }
    });
  });
  return reqs;
}

// CSV cell escaper: handles RFC-4180 quoting AND blocks Excel formula injection
// by prefixing any value starting with =, +, -, @, tab, or CR with a single quote.
function csvCell(v) {
  if (v == null) return "";
  let s = Array.isArray(v) ? v.join("|") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM
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

// ─── EMPLOYEE CSV IMPORT — configurable column mapping ───
// Target fields the app understands, with header-name aliases for auto-detection.
const IMPORT_FIELDS = [
  { key: "id",             label: "Employee ID",          required: true,  aliases: ["id","employee id","emp id","employeeid","empid","worker id","workerid","person id","personid"] },
  { key: "fullName",       label: "Full name (auto-split)",               aliases: ["name","full name","fullname","employee name","display name","employee"] },
  { key: "first",          label: "First name",                           aliases: ["first","first name","firstname","given name","given","forename"] },
  { key: "last",           label: "Last name",                            aliases: ["last","last name","lastname","surname","family name"] },
  { key: "title",          label: "Job title",                            aliases: ["title","job title","jobtitle","role","position","job"] },
  { key: "level",          label: "Level",                                 aliases: ["level","grade","job level","joblevel","seniority","rank"] },
  { key: "dept",           label: "Department",                            aliases: ["dept","department","team","sub-department","subdepartment","org unit","orgunit"] },
  { key: "bg",             label: "Business Unit",                        aliases: ["bg","business unit","businessunit","bu","business group","division","segment"] },
  { key: "fn",             label: "Discipline / job family",              aliases: ["fn","discipline","function","job family","jobfamily","family"] },
  { key: "location",       label: "Location",                             aliases: ["location","city","site","office","work location","worklocation"] },
  { key: "country",        label: "Country",                              aliases: ["country","nation"] },
  { key: "employmentType", label: "Employment type",                      aliases: ["employmenttype","employment type","emp type","worker type","workertype","type"] },
  { key: "managerId",      label: "Manager ID",                            aliases: ["managerid","manager id","manager","reports to","reportsto","supervisor id","supervisor","supervisorid","manager employee id"] },
  { key: "status",         label: "Status",                               aliases: ["status","active","employment status","employmentstatus"] },
  { key: "startDate",      label: "Start date",                           aliases: ["startdate","start date","hire date","hiredate","start","date hired"] },
  { key: "endDate",        label: "End date",                             aliases: ["enddate","end date","term date","termdate","end","exit date","termination date"] },
  { key: "costCenter",     label: "Cost center",                          aliases: ["costcenter","cost center","cc","cost centre"] },
  { key: "band",           label: "Band",                                 aliases: ["band","pay band","payband","salary band"] },
];

// Normalize any level input (internal IC1.., display L1/M1/E1, or common synonyms) to a canonical
// internal level. Returns null if unrecognized (caller defaults it).
const _LVL_FROM_DISPLAY = Object.fromEntries(Object.entries(LEVEL_LABELS).map(([k, v]) => [v.toUpperCase(), k]));
function normalizeLevel(raw) {
  if (!raw) return null;
  const v = raw.toString().trim();
  if (LEVEL_ORDER.includes(v)) return v;
  const u = v.toUpperCase();
  const internal = LEVEL_ORDER.find(l => l.toUpperCase() === u);
  if (internal) return internal;
  if (_LVL_FROM_DISPLAY[u]) return _LVL_FROM_DISPLAY[u];
  const s = u.replace(/[^A-Z0-9]/g, "");
  const SYN = {
    CEO: "C-Suite", CSUITE: "C-Suite", CLEVEL: "C-Suite", EXEC: "C-Suite", EXECUTIVE: "C-Suite", CXO: "C-Suite",
    SVP: "SVP", SENIORVP: "SVP", SENIORVICEPRESIDENT: "SVP",
    VP: "VP", VICEPRESIDENT: "VP",
    DIRECTOR: "Director", DIR: "Director", SENIORDIRECTOR: "Director", SRDIRECTOR: "Director",
    MANAGER: "Manager", MGR: "Manager", SENIORMANAGER: "Manager", SRMANAGER: "Manager", PEOPLEMANAGER: "Manager",
    IC: "IC3", INDIVIDUALCONTRIBUTOR: "IC3", STAFF: "IC5", PRINCIPAL: "IC6", SENIOR: "IC4", SR: "IC4", JUNIOR: "IC1", ENTRY: "IC1", INTERN: "IC1",
  };
  if (SYN[s]) return SYN[s];
  const num = parseInt(v, 10);
  if (!isNaN(num) && num >= 1 && num <= 6) return "IC" + num;
  return null;
}

// Guided import dialog: auto-detect columns, let the uploader remap each field, pick replace/append,
// preview, and grab a starter template. Calls onConfirm(mapping, mode); pure UI (no app context).
function EmployeeImportWizard({ data, onCancel, onConfirm }) {
  const { fileName, header, rows } = data;
  const headerLc = useMemo(() => header.map(h => (h || "").trim().toLowerCase()), [header]);

  const autoMapping = useMemo(() => {
    const used = new Set(); const m = {};
    IMPORT_FIELDS.forEach(f => {
      let found = -1;
      for (let i = 0; i < headerLc.length; i++) { if (used.has(i)) continue; if (f.aliases.includes(headerLc[i])) { found = i; break; } }
      if (found < 0) for (let i = 0; i < headerLc.length; i++) { if (used.has(i)) continue; if (f.aliases.some(a => headerLc[i].includes(a))) { found = i; break; } }
      if (found >= 0) used.add(found);
      m[f.key] = found;
    });
    return m;
  }, [headerLc]);

  const [mapping, setMapping] = useState(autoMapping);
  const [mode, setMode] = useState("replace");
  useEffect(() => { setMapping(autoMapping); }, [autoMapping]);

  const col = k => (mapping[k] ?? -1);
  const REC = new Set(["fullName", "first", "last", "level", "dept", "managerId"]); // recommended, not required
  const nameOk = (col("first") >= 0 && col("last") >= 0) || col("fullName") >= 0;
  const canImport = col("id") >= 0; // only Employee ID is truly required
  const willDefault = [];
  if (!nameOk) willDefault.push("name → employee ID");
  if (col("managerId") < 0) willDefault.push("manager → top-level");
  if (col("level") < 0) willDefault.push("level → L3");
  if (col("dept") < 0) willDefault.push("department → General");

  const preview = useMemo(() => rows.slice(0, 6).map(r => {
    const g = i => i >= 0 ? (r[i] ?? "").toString().trim() : "";
    let first = g(col("first")), last = g(col("last"));
    if ((!first || !last) && col("fullName") >= 0) { const p = g(col("fullName")).split(/\s+/); first = first || p[0] || ""; last = last || p.slice(1).join(" ") || ""; }
    const lv = normalizeLevel(g(col("level")));
    return { id: g(col("id")), name: `${first} ${last}`.trim() || "—", level: lv ? displayLevel(lv) : "L3*", dept: g(col("dept")) || "—", mgr: g(col("managerId")) || "—" };
  }), [rows, mapping]);

  function downloadTemplate() {
    const cols = ["id", "first", "last", "title", "level", "dept", "bg", "fn", "location", "country", "employmentType", "managerId", "status", "startDate", "endDate"];
    const ex = [
      ["E001", "Ada", "Lovelace", "Chief Executive Officer", "C-Suite", "Executive", "Corporate", "G&A", "San Jose HQ", "USA", "FTE", "", "Active", "2015-01-15", ""],
      ["E002", "Alan", "Turing", "VP, Engineering", "VP", "IC Design", "Silicon Engineering", "Engineering", "San Jose HQ", "USA", "FTE", "E001", "Active", "2016-03-01", ""],
      ["E003", "Grace", "Hopper", "Software Engineer", "IC3", "Software", "Software & Systems", "Engineering", "Austin", "USA", "FTE", "E002", "Active", "2020-06-01", ""],
    ];
    downloadFile("employee-import-template.csv", [cols.join(","), ...ex.map(r => r.map(csvCell).join(","))].join("\n"), "text/csv");
  }

  const opts = [<option key="-1" value={-1}>— Not mapped —</option>,
    ...header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()} style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Import employees</h2>
            <p className="text-xs text-gray-500 mt-0.5"><span className="font-medium">{fileName}</span> · {rows.length} data row{rows.length !== 1 ? "s" : ""} · {header.length} columns detected</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide">Map your columns</h3>
            <button onClick={downloadTemplate} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"><Download size={12} />Download template</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-4">
            {IMPORT_FIELDS.map(f => (
              <label key={f.key} className="flex items-center gap-2 text-xs">
                <span className="w-32 shrink-0 text-gray-600">{f.label}{f.required && <span className="text-red-500"> *</span>}</span>
                <select value={col(f.key)} onChange={e => setMapping(m => ({ ...m, [f.key]: parseInt(e.target.value, 10) }))}
                  className={`flex-1 min-w-0 border rounded-md px-2 py-1 bg-white text-gray-700 ${col(f.key) < 0 && f.required ? "border-red-300" : col(f.key) < 0 && REC.has(f.key) ? "border-amber-300" : "border-gray-200"}`}>
                  {opts}
                </select>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mb-4">Only <span className="text-red-500">*</span> <b>Employee ID</b> is required — anything you leave unmapped is filled with a sensible default (manager → top-level, level → L3, department → General, name → ID). Amber = recommended.</p>

          <div className="flex items-center gap-4 mb-4 text-xs">
            <span className="font-bold text-gray-600 uppercase tracking-wide">Mode</span>
            {[["replace", "Replace org", "Discards the current org and loads only this file"], ["append", "Append / merge", "Adds these people to the current org (same IDs are updated)"]].map(([v, l, desc]) => (
              <label key={v} className="flex items-center gap-1.5 cursor-pointer" title={desc}>
                <input type="radio" name="impmode" checked={mode === v} onChange={() => setMode(v)} /> <span className="text-gray-700">{l}</span>
              </label>
            ))}
          </div>

          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Preview <span className="text-gray-400 font-normal normal-case">· first {preview.length} rows as they'll import</span></h3>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500"><tr>{["ID", "Name", "Level", "Department", "Manager"].map(h => <th key={h} className="text-left px-2 py-1 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-2 py-1 text-gray-700">{p.id || "—"}</td><td className="px-2 py-1 text-gray-700">{p.name}</td>
                    <td className="px-2 py-1 text-gray-700">{p.level}</td><td className="px-2 py-1 text-gray-700">{p.dept}</td><td className="px-2 py-1 text-gray-500">{p.mgr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {!canImport ? <span className="text-red-500">Map the Employee ID column to continue.</span>
              : willDefault.length ? <span className="text-amber-600">Defaults will be applied: {willDefault.join("; ")}.</span>
              : <span className="text-emerald-600">All set — ready to import.</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">Cancel</button>
            <button onClick={() => canImport && onConfirm(mapping, mode)} disabled={!canImport}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${canImport ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>
              {mode === "append" ? "Append" : "Import"} {rows.length} row{rows.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─── SLIDE BUILDER — turn a chunk of the org into a presentation slide ───────
// HRBPs import headcount (Excel/CSV), pick a person as the top of the box, choose
// how many levels down to show, and export a clean org-chart slide as a PNG (paste
// into any deck) or a native, editable PowerPoint (.pptx). All layout is computed
// once (in px) and reused by the on-screen SVG preview, the PNG rasterizer, and the
// PptxGenJS shape generator so the three always match.
// ─────────────────────────────────────────────────────────────────────────────

const SLIDE_LEVEL_COLORS = {
  IC1: "#94a3b8", IC2: "#94a3b8", IC3: "#64748b", IC4: "#475569", IC5: "#334155", IC6: "#1e293b",
  Manager: "#0891b2", Director: "#2563eb", VP: "#7c3aed", SVP: "#9333ea", "C-Suite": "#c026d3",
};
function slideNodeColor(node, dim) {
  if (dim === "department")     return DEPT_COLORS[node.dept]  || "#64748b";
  if (dim === "business_group") return BG_COLORS[node.bg]      || "#64748b";
  if (dim === "discipline")     return FN_COLORS[node.fn]      || "#64748b";
  if (dim === "location")       return LOC_COLORS[node.location] || "#64748b";
  if (dim === "level")          return SLIDE_LEVEL_COLORS[node.level] || "#64748b";
  return "#2563eb";
}

// Density presets — the "compress the chart" control. Smaller cards, gaps and
// fonts pack more people into less space so a chart fits a smaller slide (or a
// corner of one) while staying legible. `lines` caps how many text rows a card
// shows so tight cards don't overflow.
const SLIDE_DENSITY = {
  comfortable: { key: "comfortable", label: "Comfortable", cardW: 188, cardH: 66, hGap: 22, vGap: 52, nameSz: 14, subSz: 11, metaSz: 10, lines: 3 },
  compact:     { key: "compact",     label: "Compact",     cardW: 150, cardH: 50, hGap: 14, vGap: 40, nameSz: 12, subSz: 9,  metaSz: 8.5, lines: 3 },
  tight:       { key: "tight",       label: "Tight",       cardW: 118, cardH: 38, hGap: 10, vGap: 30, nameSz: 10, subSz: 8,  metaSz: 7.5, lines: 2 },
  micro:       { key: "micro",       label: "Micro",       cardW: 92,  cardH: 26, hGap: 7,  vGap: 24, nameSz: 8.5, subSz: 7, metaSz: 6.5, lines: 1 },
};

// Tidy top-down tree layout. Shows the root plus `maxDepth` generations of reports.
// Two compression levers:
//   • `dens` — card/gap sizing (see SLIDE_DENSITY).
//   • `wrap` — when a manager's reports are all leaves, pack them into a grid of
//     `wrapCols` columns (auto by default) instead of one very wide row, and draw
//     a light "team box" behind them with a single bracket connector. This is what
//     turns an unreadable 18-wide strip into a tidy block that scales up big.
// Returns cards (px x/y/w/h), links (polyline point lists), group rects, and bounds.
function computeSlideLayout(root, { maxDepth, dens = SLIDE_DENSITY.comfortable, wrap = false, wrapCols = "auto", nodeCap = 200, openByManager = {} }) {
  const { cardW, cardH, hGap, vGap } = dens;
  const rowGap = Math.max(8, Math.round(vGap * 0.32)); // tighter vertical gap between wrapped grid rows
  const cards = [];
  const links = [];   // each: { pts: [[x,y], …] }
  const groups = [];  // each: { x, y, w, h } — team-box behind a wrapped grid
  let cursorX = 0;
  let truncated = false;

  // Shown children = real reports + any user-added "open position" ghost cards for
  // this manager. Open cards are synthetic leaves (children: []).
  const shown = (node, d) => {
    if (d >= maxDepth) return [];
    const real = node.children || [];
    const opens = openByManager[node.id] || [];
    return opens.length ? [...real, ...opens] : real;
  };
  // A child at depth d+1 will itself show children (is a "branch") when:
  const childBranches = (k, d) => (d + 1 < maxDepth) && k.children && k.children.length > 0;

  function place(node, d) {
    if (cards.length >= nodeCap) { truncated = true; return null; }
    const card = { node, depth: d, w: cardW, h: cardH, x: 0, y: d * (cardH + vGap), kids: [] };
    cards.push(card);
    const kids = shown(node, d);
    if (kids.length === 0) {
      if (d >= maxDepth && node.children && node.children.length > 0) truncated = true;
      card.x = cursorX; cursorX += cardW + hGap; return card;
    }

    const allLeaves = kids.every(k => !childBranches(k, d));
    // Grid-wrap only when it helps: wrapping on, every child a leaf, and enough of
    // them that a single row would be wide.
    if (wrap && allLeaves && kids.length > 3) {
      const n = kids.length;
      const cols = wrapCols === "auto"
        ? Math.max(2, Math.min(n, Math.round(Math.sqrt(n) * 1.6)))
        : Math.max(1, Math.min(n, wrapCols));
      const rows = Math.ceil(n / cols);
      const blockW = cols * cardW + (cols - 1) * hGap;
      const spanW = Math.max(blockW, cardW);
      const originX = cursorX;
      const bX = originX + (spanW - blockW) / 2;
      const childBaseY = (d + 1) * (cardH + vGap);
      kids.forEach((k, i) => {
        if (cards.length >= nodeCap) { truncated = true; return; }
        const cc = { node: k, depth: d + 1, w: cardW, h: cardH, kids: [],
          x: bX + (i % cols) * (cardW + hGap),
          y: childBaseY + Math.floor(i / cols) * (cardH + rowGap) };
        cards.push(cc); card.kids.push(cc);
      });
      card.x = originX + (spanW - cardW) / 2;
      cursorX = originX + spanW + hGap;
      const gh = rows * cardH + (rows - 1) * rowGap;
      groups.push({ x: bX - 9, y: childBaseY - 9, w: blockW + 18, h: gh + 18 });
      // bracket: parent bottom → down → across → down to top-center of the team box
      const busY = card.y + cardH + vGap * 0.45;
      links.push({ pts: [[card.x + cardW / 2, card.y + cardH], [card.x + cardW / 2, busY],
        [bX + blockW / 2, busY], [bX + blockW / 2, childBaseY - 9]] });
      return card;
    }

    // Normal tidy layout — recurse each child; children may themselves wrap.
    kids.forEach(k => { const cc = place(k, d + 1); if (cc) card.kids.push(cc); });
    if (card.kids.length === 0) { card.x = cursorX; cursorX += cardW + hGap; }
    else card.x = (card.kids[0].x + card.kids[card.kids.length - 1].x) / 2;
    const midY = card.y + cardH + vGap / 2;
    card.kids.forEach(c => links.push({ pts: [
      [card.x + cardW / 2, card.y + cardH], [card.x + cardW / 2, midY],
      [c.x + cardW / 2, midY], [c.x + cardW / 2, c.y]] }));
    return card;
  }
  place(root, 0);

  const minX = Math.min(...cards.map(c => c.x), ...groups.map(g => g.x));
  if (minX !== 0) {
    cards.forEach(c => (c.x -= minX));
    groups.forEach(g => (g.x -= minX));
    links.forEach(l => l.pts.forEach(p => (p[0] -= minX)));
  }
  const width  = Math.max(...cards.map(c => c.x + c.w), ...groups.map(g => g.x + g.w));
  const height = Math.max(...cards.map(c => c.y + c.h), ...groups.map(g => g.y + g.h));

  return { cards, links, groups, width, height, count: cards.length, truncated };
}

function slideCardLines(node, fields) {
  const meta = [];
  if (fields.dept  && node.dept)  meta.push(node.dept);
  if (fields.level && node.level) meta.push(displayLevel(node.level));
  if (fields.size  && (node._totalReports || 0) > 0) meta.push(`${node._totalReports} in org`);
  return {
    name: `${node.first || ""} ${node.last || ""}`.trim() || node.id || "—",
    title: fields.title ? (node.title || "") : "",
    meta: meta.join(" · "),
  };
}

function truncateToWidth(s, px, fontPx) {
  const max = Math.max(3, Math.floor(px / (fontPx * 0.56)));
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// Card text as vertically-centered lines, capped by the density's `lines` budget.
function slideCardTextLines(node, fields, dens) {
  const L = slideCardLines(node, fields);
  const lines = [{ text: L.name, size: dens.nameSz, weight: 700, fill: node.__open ? "#475569" : "#0f172a" }];
  if (L.title) lines.push({ text: L.title, size: dens.subSz, weight: 400, fill: "#475569" });
  if (L.meta)  lines.push({ text: L.meta,  size: dens.metaSz, weight: 400, fill: "#94a3b8" });
  return lines.slice(0, dens.lines);
}

// ─── The slide as an <svg>. Also the exact thing the PNG exporter serializes. ───
function OrgSlideSVG({ layout, fields, colorDim, title, subtitle, svgRef, dens = SLIDE_DENSITY.comfortable }) {
  const PAD = 28, TITLE_H = title ? 74 : 24;
  const W = Math.max(760, layout.width + PAD * 2);
  const H = layout.height + PAD * 2 + TITLE_H;
  const ox = (W - layout.width) / 2;
  const oy = PAD + TITLE_H;
  const stripe = Math.max(4, Math.round(dens.cardW * 0.032));
  const padL = Math.max(stripe + 4, Math.round(dens.cardW * 0.07));
  const rx = Math.min(9, Math.round(dens.cardH * 0.18));

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width={W} height={H} xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", background: "#ffffff", fontFamily: "'DM Sans', Arial, sans-serif" }}>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      {title && <>
        <rect x="0" y="0" width={W} height="6" fill="#2563eb" />
        <text x={PAD} y="46" fontSize="26" fontWeight="700" fill="#0f172a">{truncateToWidth(title, W - PAD * 2, 26)}</text>
        {subtitle && <text x={PAD} y="66" fontSize="13" fill="#64748b">{truncateToWidth(subtitle, W - PAD * 2, 13)}</text>}
      </>}
      {/* team boxes behind wrapped grids */}
      {layout.groups.map((g, i) => (
        <rect key={i} x={ox + g.x} y={oy + g.y} width={g.w} height={g.h} rx="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {/* connectors */}
      <g stroke="#cbd5e1" strokeWidth="1.5" fill="none">
        {layout.links.map((l, i) => (
          <path key={i} d={"M " + l.pts.map(p => `${ox + p[0]} ${oy + p[1]}`).join(" L ")} />
        ))}
      </g>
      {/* cards */}
      {layout.cards.map((c, i) => {
        const open = c.node.__open;
        const color = slideNodeColor(c.node, colorDim);
        const x = ox + c.x, y = oy + c.y;
        const tls = slideCardTextLines(c.node, fields, dens);
        const showPill = open && dens.lines >= 2 && c.w >= 104;
        const pillW = Math.min(34, c.w * 0.3);
        const innerW = c.w - padL - 6 - (showPill ? pillW + 4 : 0);
        const totalH = tls.reduce((s, ln) => s + ln.size, 0) + (tls.length - 1) * 3;
        let ty = y + (c.h - totalH) / 2;
        return (
          <g key={i}>
            <rect x={x} y={y} width={c.w} height={c.h} rx={rx} fill="#ffffff"
              stroke={open ? color : "#e2e8f0"} strokeWidth="1.5"
              strokeDasharray={open ? "5 3" : undefined} strokeOpacity={open ? 0.9 : 1} />
            {!open && <>
              <rect x={x} y={y} width={stripe} height={c.h} rx={Math.min(3, stripe / 2)} fill={color} />
              <rect x={x} y={y} width={stripe} height={c.h * 0.5} fill={color} />
            </>}
            {showPill && <>
              <rect x={x + c.w - pillW - 6} y={y + 5} width={pillW} height="13" rx="6" fill="#ecfdf5" stroke="#6ee7b7" strokeWidth="0.75" />
              <text x={x + c.w - 6 - pillW / 2} y={y + 14.5} fontSize="8" fontWeight="700" fill="#059669" textAnchor="middle">OPEN</text>
            </>}
            {tls.map((ln, j) => {
              ty += ln.size;
              const el = <text key={j} x={x + padL} y={ty} fontSize={ln.size} fontWeight={ln.weight} fill={ln.fill}>{truncateToWidth(ln.text, innerW, ln.size)}</text>;
              ty += 3;
              return el;
            })}
          </g>
        );
      })}
    </svg>
  );
}

// Serialize the live SVG node to a high-res PNG blob and download it.
function exportSlidePNG(svgEl, filename, scale = 2) {
  if (!svgEl) { alert("Nothing to export yet."); return; }
  const w = parseFloat(svgEl.getAttribute("width")) || svgEl.viewBox.baseVal.width;
  const h = parseFloat(svgEl.getAttribute("height")) || svgEl.viewBox.baseVal.height;
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svg64 = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) { alert("Could not render PNG."); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };
  img.onerror = () => alert("Could not rasterize the slide.");
  img.src = svg64;
}

// Build a native, editable .pptx from one or more slide models via PptxGenJS.
// Each card becomes a real rounded-rectangle text box and each connector a real
// line, so HRBPs can nudge, recolor, or retype anything in PowerPoint afterward.
function exportSlidePPTX(slideModels, { deckName, footer }) {
  const Ctor = window.PptxGenJS;
  if (!Ctor) { alert("PowerPoint library not loaded — reload the page and try again."); return; }
  const pptx = new Ctor();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 × 7.5 in
  const SW = 13.333, SH = 7.5;
  const hex = c => (c || "#64748b").replace("#", "");

  slideModels.forEach(model => {
    const { layout, fields, colorDim, title, subtitle, dens = SLIDE_DENSITY.comfortable } = model;
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SW, h: 0.09, fill: { color: "2563EB" } });
    if (title)    slide.addText(title,    { x: 0.45, y: 0.28, w: SW - 0.9, h: 0.5,  fontSize: 24, bold: true, color: "0F172A", fontFace: "Arial" });
    if (subtitle) slide.addText(subtitle, { x: 0.45, y: 0.78, w: SW - 0.9, h: 0.3,  fontSize: 12, color: "64748B", fontFace: "Arial" });

    const topPad = title ? 1.25 : 0.5, botPad = footer ? 0.55 : 0.35, sidePad = 0.45;
    const scale = Math.min((SW - sidePad * 2) / layout.width, (SH - topPad - botPad) / layout.height);
    const ox = (SW - layout.width * scale) / 2;
    const oy = topPad;
    const X = px => ox + px * scale;
    const Y = px => oy + px * scale;
    const pt = px => Math.max(5, Math.min(22, +(px * scale * 72).toFixed(1))); // px height → font points
    const stripe = Math.max(4, Math.round(dens.cardW * 0.032));
    const padL = Math.max(stripe + 4, Math.round(dens.cardW * 0.07));

    // team boxes behind wrapped grids
    layout.groups.forEach(g => slide.addShape(pptx.ShapeType.roundRect, {
      x: X(g.x), y: Y(g.y), w: g.w * scale, h: g.h * scale, rectRadius: 0.08,
      fill: { color: "F8FAFC" }, line: { color: "E2E8F0", width: 0.75 },
    }));

    // connectors (behind cards) — each link is a polyline of orthogonal segments
    layout.links.forEach(l => {
      for (let i = 0; i < l.pts.length - 1; i++) {
        const [x1, y1] = l.pts[i], [x2, y2] = l.pts[i + 1];
        slide.addShape(pptx.ShapeType.line, {
          x: X(Math.min(x1, x2)), y: Y(Math.min(y1, y2)),
          w: Math.abs(x2 - x1) * scale, h: Math.abs(y2 - y1) * scale,
          line: { color: "CBD5E1", width: 1 },
        });
      }
    });

    layout.cards.forEach(c => {
      const open = c.node.__open;
      const color = hex(slideNodeColor(c.node, colorDim));
      const tls = slideCardTextLines(c.node, fields, dens);
      const x = X(c.x), y = Y(c.y), w = c.w * scale, h = c.h * scale;
      const runs = tls.map(ln => ({ text: ln.text, options: { bold: ln.weight >= 700, fontSize: pt(ln.size), color: hex(ln.fill), breakLine: true } }));
      slide.addText(runs, {
        shape: pptx.ShapeType.roundRect, rectRadius: Math.min(0.06, h * 0.16),
        x, y, w, h, fill: { color: "FFFFFF" },
        line: open ? { color, width: 1.25, dashType: "dash" } : { color: "E2E8F0", width: 1 },
        align: "left", valign: "middle", margin: [1, 3, 1, Math.max(4, padL * scale * 72)], fontFace: "Arial",
      });
      if (open) {
        // "OPEN" chip top-right; a real editable text box in the deck
        if (dens.lines >= 2 && w >= 1.2) slide.addText("OPEN", {
          x: x + w - 0.6, y: y + 0.04, w: 0.55, h: 0.18, rectRadius: 0.03, shape: pptx.ShapeType.roundRect,
          fill: { color: "ECFDF5" }, line: { color: "6EE7B7", width: 0.5 },
          fontSize: 7, bold: true, color: "059669", align: "center", valign: "middle", fontFace: "Arial",
        });
      } else {
        slide.addShape(pptx.ShapeType.rect, { x, y, w: stripe * scale, h, fill: { color } });
      }
    });

    if (footer) slide.addText(footer, { x: 0.45, y: SH - 0.42, w: SW - 0.9, h: 0.3, fontSize: 9, color: "94A3B8", fontFace: "Arial" });
  });

  pptx.writeFile({ fileName: deckName }).catch(err => alert("Could not write PowerPoint: " + (err?.message || err)));
}

// The Slide Builder view.
function OrgSlideView() {
  const { tree, activeEmployees, focusRoot, importEmployeesCSV } = useContext(AppCtx);
  const svgRef = useRef(null);

  // People who can head a slide (anyone in the tree). Default to the focused subtree
  // root, else the org root. Managers first so the useful anchors are easy to find.
  const people = useMemo(() => {
    const list = Object.values(tree.map || {});
    return list.sort((a, b) => (b._totalReports || 0) - (a._totalReports || 0) || `${a.first} ${a.last}`.localeCompare(`${b.first} ${b.last}`));
  }, [tree]);

  const [rootId, setRootId]   = useState(() => focusRoot && tree.map[focusRoot] ? focusRoot : (tree.root ? tree.root.id : (people[0] && people[0].id)));
  const [maxDepth, setMaxDepth] = useState(2);
  const [colorDim, setColorDim] = useState("department");
  const [fields, setFields]     = useState({ title: true, dept: true, level: true, size: true });
  const [perTeam, setPerTeam]   = useState(false);
  const [search, setSearch]     = useState("");
  const [titleText, setTitleText] = useState("");
  const [density, setDensity]   = useState("comfortable");
  const [wrap, setWrap]         = useState(true);
  const [wrapCols, setWrapCols] = useState("auto");
  // User-added "open position" ghost cards: [{ id, managerId, title, level, dept }]
  const [openRoles, setOpenRoles] = useState([]);
  const [newRole, setNewRole]   = useState({ managerId: "", title: "", level: "L4", count: 1 });

  useEffect(() => {
    if (!tree.map[rootId]) setRootId(tree.root ? tree.root.id : (people[0] && people[0].id));
  }, [tree]);

  const dens = SLIDE_DENSITY[density] || SLIDE_DENSITY.comfortable;
  const wrapColsVal = wrapCols === "auto" ? "auto" : parseInt(wrapCols, 10);
  const rootNode = tree.map[rootId] || tree.root;

  // Group open roles into synthetic leaf nodes keyed by their manager id.
  const openByManager = useMemo(() => {
    const m = {};
    openRoles.forEach(r => {
      const node = { id: r.id, __open: true, first: r.title || "Open role", last: "", title: "",
        dept: r.dept || "", level: r.level || "", children: [], _totalReports: 0 };
      (m[r.managerId] = m[r.managerId] || []).push(node);
    });
    return m;
  }, [openRoles]);

  const layout = useMemo(() => rootNode ? computeSlideLayout(rootNode, { maxDepth, dens, wrap, wrapCols: wrapColsVal, openByManager }) : null, [rootNode, maxDepth, dens, wrap, wrapColsVal, openByManager]);
  const openCount = layout ? layout.cards.filter(c => c.node.__open).length : 0;

  // Managers you can attach an open role to = the real (non-open) cards currently on the slide.
  const attachOptions = useMemo(() => layout ? layout.cards.filter(c => !c.node.__open).map(c => c.node) : [], [layout]);

  function addOpenRole() {
    const mgrId = newRole.managerId || rootId;
    const mgr = tree.map[mgrId];
    if (!mgr) return;
    const dept = mgr.dept || "";
    const title = (newRole.title || "").trim() || "Open role";
    const count = Math.max(1, Math.min(20, parseInt(newRole.count, 10) || 1));
    const stamp = Date.now();
    const additions = [];
    for (let i = 0; i < count; i++) additions.push({ id: `open_${stamp}_${Math.round(Math.random() * 1e6)}_${i}`, managerId: mgrId, title, level: newRole.level, dept });
    setOpenRoles(prev => [...prev, ...additions]);
    setNewRole(r => ({ ...r, title: "" }));
  }

  // ─── Bulk-import open positions from Excel/CSV ───
  // Flexible columns (auto-detected): Manager (name OR employee ID), Title, Level,
  // Count, Department. Rows with no/blank manager fall under the current root.
  function parseOpeningsRows(header, rows) {
    const hl = header.map(h => (h || "").trim().toLowerCase());
    const find = aliases => {
      for (let i = 0; i < hl.length; i++) if (aliases.includes(hl[i])) return i;
      for (let i = 0; i < hl.length; i++) if (hl[i] && aliases.some(a => hl[i].includes(a))) return i;
      return -1;
    };
    const ci = {
      manager: find(["manager", "manager id", "managerid", "manager name", "manager employee id", "reports to", "reportsto", "supervisor", "under", "hiring manager"]),
      title:   find(["title", "role", "job title", "jobtitle", "position", "open role", "req title", "requisition", "req"]),
      level:   find(["level", "grade", "job level", "joblevel", "band", "seniority"]),
      count:   find(["count", "openings", "opening", "headcount", "hc", "qty", "quantity", "number", "num", "reqs", "positions"]),
      dept:    find(["dept", "department", "team", "org unit", "orgunit", "function"]),
    };
    const nodes = Object.values(tree.map);
    const byName = {};
    nodes.forEach(n => { byName[`${n.first} ${n.last}`.trim().toLowerCase()] = n; });
    const added = []; let skipped = 0; const unresolved = [];
    rows.forEach(r => {
      const g = i => (i >= 0 ? (r[i] ?? "").toString().trim() : "");
      const mRaw = g(ci.manager);
      let mgr;
      if (ci.manager < 0 || !mRaw) mgr = rootNode;
      else {
        mgr = tree.map[mRaw] || byName[mRaw.toLowerCase()] ||
          nodes.find(n => `${n.first} ${n.last}`.toLowerCase().includes(mRaw.toLowerCase()));
        if (!mgr) { skipped++; unresolved.push(mRaw); return; }
      }
      const title = g(ci.title) || "Open role";
      const lvNorm = normalizeLevel(g(ci.level));
      const level = lvNorm ? displayLevel(lvNorm) : (g(ci.level) || "L4");
      const cnt = Math.max(1, Math.min(50, parseInt(g(ci.count), 10) || 1));
      const dept = g(ci.dept) || mgr.dept || "";
      const stamp = Date.now();
      for (let k = 0; k < cnt; k++) added.push({ id: `open_imp_${stamp}_${Math.round(Math.random() * 1e6)}_${added.length}`, managerId: mgr.id, title, level, dept });
    });
    return { added, skipped, unresolved };
  }

  function importOpenings(file) {
    const name = (file.name || "").toLowerCase();
    const isExcel = /\.(xlsx|xlsm|xlsb|xls)$/.test(name);
    const reader = new FileReader();
    const handle = (header, rows) => {
      const { added, skipped, unresolved } = parseOpeningsRows(header, rows);
      if (!added.length) { alert("No open positions could be imported.\nCheck the file has a Title column, and (optionally) a Manager column matching names or employee IDs in your org."); return; }
      setOpenRoles(prev => [...prev, ...added]);
      const uniqMgr = new Set(added.map(a => a.managerId)).size;
      let msg = `Imported ${added.length} open position${added.length === 1 ? "" : "s"} across ${uniqMgr} manager${uniqMgr === 1 ? "" : "s"}.`;
      if (skipped) { const u = [...new Set(unresolved)]; msg += `\nSkipped ${skipped} row${skipped === 1 ? "" : "s"}${u.length ? ` — unmatched manager: ${u.slice(0, 5).join(", ")}${u.length > 5 ? "…" : ""}` : ""}.`; }
      alert(msg);
    };
    if (isExcel) {
      reader.onload = ev => {
        try {
          const XLSX = window.XLSX;
          if (!XLSX) throw new Error("Excel library not loaded — reload and try again.");
          const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false, blankrows: false });
          const rows = aoa.map(rr => rr.map(c => (c == null ? "" : String(c)))).filter(rr => rr.some(c => c.trim() !== ""));
          if (rows.length < 2) throw new Error("The first sheet has no data rows.");
          handle(rows[0].map(c => (c || "").trim()), rows.slice(1));
        } catch (err) { alert("Could not read Excel file: " + err.message); }
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    reader.onload = ev => {
      try {
        const rows = parseCSV(String(ev.target.result || ""));
        if (rows.length < 2) throw new Error("File has no data rows.");
        handle(rows[0].map(c => (c || "").trim()), rows.slice(1));
      } catch (err) { alert("Could not read CSV: " + err.message); }
    };
    reader.readAsText(file);
  }

  function downloadOpeningsTemplate() {
    const mgrs = attachOptions.slice(0, 3);
    const roleEx = ["Senior Engineer", "Product Manager", "Program Manager"];
    const lvlEx = ["L4", "M1", "L3"];
    const ex = (mgrs.length ? mgrs : [rootNode].filter(Boolean)).map((m, i) => [
      `${m.first} ${m.last}`, roleEx[i % 3], lvlEx[i % 3], String((i % 2) + 1), m.dept || "",
    ]);
    if (!ex.length) ex.push(["<manager name or employee ID>", "Senior Engineer", "L4", "2", "Engineering"]);
    const cols = ["Manager", "Title", "Level", "Count", "Department"];
    downloadFile("open-positions-template.csv", [cols.join(","), ...ex.map(r => r.map(csvCell).join(","))].join("\n"), "text/csv");
  }

  const autoTitle = rootNode ? `${rootNode.first} ${rootNode.last}${/s$/i.test(rootNode.last || "") ? "’" : "’s"} organization` : "Org chart";
  const title = titleText.trim() || autoTitle;
  const subtitle = rootNode ? `${rootNode.title || displayLevel(rootNode.level)}  ·  ${(rootNode._totalReports || 0)} people in org` : "";
  const footer = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? people.filter(p => `${p.first} ${p.last} ${p.title} ${p.dept}`.toLowerCase().includes(q)) : people;
    return base.slice(0, 200);
  }, [people, search]);

  // Build the list of slide models for a multi-slide (.pptx) export.
  function buildDeckModels() {
    const mk = (node, mDepth, ttl, sub) => ({
      layout: computeSlideLayout(node, { maxDepth: mDepth, dens, wrap, wrapCols: wrapColsVal, openByManager }),
      fields, colorDim, dens, title: ttl, subtitle: sub,
    });
    if (!perTeam || !rootNode.children || rootNode.children.length === 0) {
      return [mk(rootNode, maxDepth, title, subtitle)];
    }
    // Overview slide (root + direct reports) then one slide per report that manages people.
    const models = [mk(rootNode, 1, title, `Leadership overview  ·  ${rootNode.children.length} direct reports`)];
    rootNode.children.forEach(child => {
      const heads = (child.children && child.children.length > 0);
      models.push(mk(child, heads ? maxDepth : 1,
        `${child.first} ${child.last}${/s$/i.test(child.last || "") ? "’" : "’s"} team`,
        `${child.title || displayLevel(child.level)}  ·  ${(child._totalReports || 0)} in org`));
    });
    return models;
  }

  const safeName = (title || "org-slide").replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").slice(0, 60) || "org-slide";

  if (!rootNode || !layout) return <div className="p-8 text-gray-500">No org data loaded yet. Import a headcount file to begin.</div>;

  return (
    <div className="h-full flex overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Controls */}
      <div className="w-72 shrink-0 border-r border-gray-100 bg-gray-50 overflow-y-auto p-4 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Slide builder</h2>
          <p className="text-xs text-gray-500 mt-0.5">Turn any slice of the org into a clean slide. Export a PNG to paste anywhere, or an editable PowerPoint.</p>
          <label
            title="Import employees from Excel (.xlsx) or CSV — opens the guided mapping dialog. Replaces or appends the current org."
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs bg-white border border-gray-200 text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
            <Plus size={12}/>Import headcount (Excel/CSV)
            <input type="file" accept=".csv,text/csv,.xlsx,.xls,.xlsm,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f && importEmployeesCSV) importEmployeesCSV(f); e.target.value = ""; }}/>
          </label>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">Top of the box</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search person…"
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mb-1 bg-white" />
          <select value={rootId} onChange={e => setRootId(e.target.value)} size="8"
            className="w-full text-xs border border-gray-200 rounded-lg px-1 py-1 bg-white">
            {filtered.map(p => (
              <option key={p.id} value={p.id}>{p.first} {p.last} — {p.title || displayLevel(p.level)} ({p._totalReports || 0})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">Levels deep: {maxDepth}</label>
          <input type="range" min="1" max="4" value={maxDepth} onChange={e => setMaxDepth(parseInt(e.target.value, 10))} className="w-full" />
          <div className="flex justify-between text-[10px] text-gray-400"><span>Direct reports</span><span>4 levels</span></div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-2.5 space-y-2.5">
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide">Compress to fit</label>
          <div>
            <div className="text-[10px] text-gray-400 mb-1">Card density</div>
            <div className="grid grid-cols-4 gap-1">
              {Object.values(SLIDE_DENSITY).map(d => (
                <button key={d.key} onClick={() => setDensity(d.key)} title={d.label}
                  className={`text-[10px] py-1 rounded border transition-colors ${density === d.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={wrap} onChange={e => setWrap(e.target.checked)} className="mt-0.5" />
            <span><span className="font-medium">Wrap wide teams into a grid</span><br/><span className="text-gray-400">Packs a long row of reports into a compact block.</span></span>
          </label>
          {wrap && (
            <div className="flex items-center gap-2 text-xs pl-6">
              <span className="text-gray-500">Columns</span>
              <select value={wrapCols} onChange={e => setWrapCols(e.target.value)} className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white">
                <option value="auto">Auto</option>
                {[3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n} per row</option>)}
              </select>
            </div>
          )}
          <div className="text-[10px] text-gray-400">Chart is {Math.round(layout.width)}×{Math.round(layout.height)} px · aspect {(layout.width / layout.height).toFixed(1)}:1</div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">Color cards by</label>
          <select value={colorDim} onChange={e => setColorDim(e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="department">Department</option>
            <option value="business_group">Business Unit</option>
            <option value="discipline">Discipline</option>
            <option value="location">Location</option>
            <option value="level">Level</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Show on each card</label>
          <div className="space-y-1">
            {[["title", "Job title"], ["dept", "Department"], ["level", "Level"], ["size", "Team size"]].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={fields[k]} onChange={e => setFields(f => ({ ...f, [k]: e.target.checked }))} />{l}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide">Open positions</label>
            {openRoles.length > 0 && <button onClick={() => setOpenRoles([])} className="text-[10px] text-gray-400 hover:text-red-500">Clear all</button>}
          </div>
          <p className="text-[10px] text-gray-400 -mt-1">Add to-be-hired boxes under any manager. They show as dashed “OPEN” cards and export to PNG + PowerPoint.</p>
          <select value={newRole.managerId || rootId} onChange={e => setNewRole(r => ({ ...r, managerId: e.target.value }))}
            className="w-full text-xs border border-gray-200 rounded-md px-2 py-1 bg-white" title="Reports to">
            {attachOptions.map(n => (
              <option key={n.id} value={n.id}>Under: {n.first} {n.last} — {n.title || displayLevel(n.level)}</option>
            ))}
          </select>
          <input value={newRole.title} onChange={e => setNewRole(r => ({ ...r, title: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") addOpenRole(); }}
            placeholder="Role title (e.g. Senior RTL Engineer)"
            className="w-full text-xs border border-gray-200 rounded-md px-2 py-1 bg-white" />
          <div className="flex items-center gap-1.5">
            <select value={newRole.level} onChange={e => setNewRole(r => ({ ...r, level: e.target.value }))}
              className="text-xs border border-gray-200 rounded-md px-1.5 py-1 bg-white" title="Level">
              {ALL_DISPLAY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <input type="number" min="1" max="20" value={newRole.count} onChange={e => setNewRole(r => ({ ...r, count: e.target.value }))}
              className="w-12 text-xs border border-gray-200 rounded-md px-1.5 py-1 bg-white" title="How many" />
            <button onClick={addOpenRole} className="flex-1 flex items-center justify-center gap-1 text-xs bg-emerald-600 text-white px-2 py-1 rounded-md font-medium hover:bg-emerald-700">
              <Plus size={12}/>Add
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <label title="Bulk-import open positions from Excel/CSV — columns: Manager, Title, Level, Count, Department (all auto-detected)."
              className="flex-1 flex items-center justify-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md hover:bg-emerald-100 cursor-pointer">
              <Plus size={11}/>Import openings
              <input type="file" accept=".csv,text/csv,.xlsx,.xls,.xlsm,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) importOpenings(f); e.target.value = ""; }}/>
            </label>
            <button onClick={downloadOpeningsTemplate} className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1" title="Download a starter CSV pre-filled with managers from this org">
              <Download size={11}/>Template
            </button>
          </div>
          {openRoles.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto pt-1 border-t border-gray-100">
              {openRoles.map(r => {
                const mgr = tree.map[r.managerId];
                return (
                  <div key={r.id} className="flex items-center gap-1.5 text-[11px] text-gray-600">
                    <span className="inline-block w-1.5 h-1.5 rounded-full border border-emerald-500 shrink-0" style={{ borderStyle: "dashed" }}/>
                    <span className="flex-1 min-w-0 truncate">{r.title} <span className="text-gray-400">· {r.level} · under {mgr ? `${mgr.first} ${mgr.last}` : "—"}</span></span>
                    <button onClick={() => setOpenRoles(prev => prev.filter(x => x.id !== r.id))} className="text-gray-300 hover:text-red-500 shrink-0"><X size={11}/></button>
                  </div>
                );
              })}
            </div>
          )}
          {openRoles.some(r => !attachOptions.some(n => n.id === r.managerId)) && (
            <p className="text-[10px] text-amber-600">Some open roles sit under a manager not shown at this depth — increase “Levels deep” or change the root to see them.</p>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">Slide title</label>
          <input value={titleText} onChange={e => setTitleText(e.target.value)} placeholder={autoTitle}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
        </div>

        <label className="flex items-start gap-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-2">
          <input type="checkbox" checked={perTeam} onChange={e => setPerTeam(e.target.checked)} className="mt-0.5" />
          <span><span className="font-medium">Break into one slide per team</span><br/><span className="text-gray-400">Overview slide + a slide for each direct report’s org (multi-slide .pptx).</span></span>
        </label>

        <div className="pt-2 border-t border-gray-200 space-y-2">
          <button onClick={() => exportSlidePNG(svgRef.current, `${safeName}.png`)}
            className="w-full flex items-center justify-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-700">
            <Download size={13}/>Download PNG
          </button>
          <button onClick={() => exportSlidePPTX(buildDeckModels(), { deckName: `${safeName}.pptx`, footer })}
            className="w-full flex items-center justify-center gap-1.5 text-xs bg-amber-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-amber-600">
            <FileText size={13}/>Download PowerPoint{perTeam && rootNode.children && rootNode.children.length ? ` (${rootNode.children.length + 1} slides)` : ""}
          </button>
          <p className="text-[10px] text-gray-400 text-center">PNG = paste into any deck · PPTX = fully editable shapes</p>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-auto bg-slate-100 p-6">
        {layout.truncated && (
          <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            This slice is large ({layout.count}+ boxes). Reduce “Levels deep”, pick a lower manager as the top of the box, or use “one slide per team” to keep each slide readable.
          </div>
        )}
        <div className="mx-auto bg-white rounded-lg shadow-xl overflow-hidden" style={{ maxWidth: 1100 }}>
          <OrgSlideSVG layout={layout} fields={fields} colorDim={colorDim} title={title} subtitle={subtitle} svgRef={svgRef} dens={dens} />
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-2">Live preview · {layout.count - openCount} {(layout.count - openCount) === 1 ? "person" : "people"} shown{openCount > 0 ? ` · ${openCount} open position${openCount === 1 ? "" : "s"}` : ""}</p>
      </div>
    </div>
  );
}

// Largest-remainder allocation: split `total` into integer parts proportional to `weights`.
function largestRemainderAlloc(total, weights) {
  const sumW = weights.reduce((s, w) => s + w, 0);
  if (!sumW || !total) return weights.map(() => 0);
  const raw = weights.map(w => total * w / sumW);
  const floors = raw.map(v => Math.floor(v));
  let leftover = total - floors.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < leftover; k++) floors[order[k % order.length].i] += 1;
  return floors;
}

// EC hire calculator. Given the projected baseline, returns yearly EC + intern numbers.
function computeEarlyCalc({ baseTotal, baseEarly, expPerYear, planYears, mode, targetPct, mixPct, internRatio }) {
  const expHorizon = expPerYear * planYears;
  if (mode === "orgMix") {
    const p = Math.min(0.99, Math.max(0, targetPct / 100));
    const ecHorizonRaw = (p * (baseTotal + expHorizon) - baseEarly) / Math.max(0.01, 1 - p);
    const ecHorizon = Math.max(0, Math.ceil(ecHorizonRaw));
    const ecPerYear = Math.ceil(ecHorizon / planYears);
    const orgTargetEC = Math.round((baseTotal + ecHorizon + expHorizon) * p);
    const orgGap = Math.max(0, orgTargetEC - baseEarly);
    const totalPerYear = ecPerYear + expPerYear;
    const interns = Math.ceil(ecPerYear * internRatio);
    const ecShare = totalPerYear ? Math.round(100 * ecPerYear / totalPerYear) : 0;
    const finalTotal = baseTotal + ecHorizon + expHorizon;
    const finalEarly = baseEarly + ecHorizon;
    const finalPct = finalTotal ? Math.round(100 * finalEarly / finalTotal) : 0;
    return { ecPerYear, expPerYear, totalPerYear, interns, ecShare, orgGap, orgTargetEC, finalPct };
  } else {
    const pct = Math.min(99, Math.max(0, mixPct));
    const ecPerYear = Math.ceil(expPerYear * pct / Math.max(1, 100 - pct));
    const totalPerYear = ecPerYear + expPerYear;
    const interns = Math.ceil(ecPerYear * internRatio);
    const ecShare = totalPerYear ? Math.round(100 * ecPerYear / totalPerYear) : 0;
    const ecHorizon = ecPerYear * planYears;
    const finalTotal = baseTotal + ecHorizon + expHorizon;
    const finalEarly = baseEarly + ecHorizon;
    const finalPct = finalTotal ? Math.round(100 * finalEarly / finalTotal) : 0;
    return { ecPerYear, expPerYear, totalPerYear, interns, ecShare, orgGap: 0, orgTargetEC: 0, finalPct };
  }
}

// Per-group EC allocation (largest-remainder over weights).
function computeEarlyAllocByGroup({ earlyByGroup, earlyCalc, mode }) {
  let weights, basis;
  if (mode === "orgMix") {
    const gaps = earlyByGroup.map(r => Math.max(0, r.gap));
    const totalGap = gaps.reduce((s, x) => s + x, 0);
    if (totalGap > 0) { weights = gaps; basis = "gap"; }
    else { weights = earlyByGroup.map(r => r.curTotal); basis = "size (no gap)"; }
  } else {
    weights = earlyByGroup.map(r => r.curTotal);
    basis = "size";
  }
  const ecAlloc = largestRemainderAlloc(earlyCalc.ecPerYear, weights);
  const internAlloc = largestRemainderAlloc(earlyCalc.interns, weights);
  const sumW = weights.reduce((s, w) => s + w, 0) || 1;
  return earlyByGroup.map((r, i) => ({
    group: r.group,
    share: Math.round(100 * weights[i] / sumW),
    ecPerYear: ecAlloc[i],
    interns: internAlloc[i],
    basis,
  }));
}

// ─── 3-YEAR ATTRITION + GROWTH MODEL ───
// Drives backfill, growth, promotions, M&A, and EC hiring in coupled fashion.
//
// Rules:
//   - Each year we lose attritionPct% of the active HC at year start (compounds).
//   - promoPctPerYear% of eligible HC (L1-L4 ICs ≈ 85% of org) is promoted up one level.
//     L2→L3 specifically converts EC into experienced (drains the EC pool).
//     Vacated slots (any level) become backfill demand on top of attrition.
//   - acquisitionsPerYear[i] = { count, ecPct } adds HC at year i without recruiting.
//     Counts toward growth target — recruiting only fills the gap.
//   - Net growth is split across 3 years by user-supplied weights (must sum to ~100).
//   - Gross hiring per year = attrition backfill + promotion backfill + (growth − acquired).
//   - EC% applies to gross hires per year:
//       * "hireMix" mode → EC = mixPct of every year's gross
//       * "orgMix" mode → solve so end-of-Y3 org EC% hits target, compensating for EC drain
//         from attrition + L2 promotions and EC lift from acquired EC.
//   - Backfills default to the same level as the vacated slot (attrition + promotion both).
function computeAttritionGrowthModel({
  baseTotal, baseEarly, levelHistogram,
  attritionPct, growthTarget3Yr, growthShiftPerYear,
  promoPctPerYear, acquisitionsPerYear,
  mode, targetPct, mixPct, internRatio, planStartYear,
}) {
  const years = [planStartYear, planStartYear + 1, planStartYear + 2];
  const aPct = Math.min(50, Math.max(0, attritionPct)) / 100;
  const pPct = Math.min(50, Math.max(0, promoPctPerYear || 0)) / 100;
  const wSum = (growthShiftPerYear || []).reduce((s, x) => s + x, 0) || 1;
  const weights = (growthShiftPerYear || [33, 33, 34]).map(x => x / wSum);
  const netGrowthYearly = largestRemainderAlloc(growthTarget3Yr, weights.map(w => w * 100));
  const ELIGIBLE_PROMO_SHARE = 0.85; // exclude top-of-track + mgmt from promotion eligibility
  const acq = (acquisitionsPerYear && acquisitionsPerYear.length === 3)
    ? acquisitionsPerYear
    : [{count:0,ecPct:0},{count:0,ecPct:0},{count:0,ecPct:0}];
  // Share of EC pool that's L2 (rest is L1). L2 is the slice that promotes OUT of EC.
  const l2InitShare = baseEarly > 0 ? Math.min(1, (levelHistogram?.L2 || 0) / baseEarly) : 0.5;

  // Forward-simulate HC year by year (attrition + backfill cancel; growth is the net delta;
  // acquisitions count toward growth, so HC delta per year = growth)
  let hc = baseTotal;
  const yearly = [];
  for (let i = 0; i < 3; i++) {
    const startHC = hc;
    const attrition = Math.round(startHC * aPct);
    const eligible = Math.round(startHC * ELIGIBLE_PROMO_SHARE);
    const promotions = Math.round(eligible * pPct);
    const acquired = Math.max(0, Math.round(acq[i].count || 0));
    const acquiredEC = Math.max(0, Math.min(acquired,
      Math.round(acquired * Math.max(0, Math.min(100, acq[i].ecPct || 0)) / 100)));
    const growth = netGrowthYearly[i] || 0;
    const recruitedGrowth = Math.max(0, growth - acquired); // M&A absorbs part of the growth target
    const gross = attrition + promotions + recruitedGrowth; // promotion-vacated slots refilled too
    yearly.push({
      year: years[i], startHC, attrition, growth, gross,
      promotions, acquired, acquiredEC, recruitedGrowth,
    });
    hc = startHC + growth; // acquired is part of growth, attrition+backfill cancel
  }

  // Pre-compute totals over the 3 years for EC math
  const totalGross = yearly.reduce((s, y) => s + y.gross, 0);
  const totalAttr = yearly.reduce((s, y) => s + y.attrition, 0);
  const totalPromos = yearly.reduce((s, y) => s + y.promotions, 0);
  const totalAcq = yearly.reduce((s, y) => s + y.acquired, 0);
  const totalAcqEC = yearly.reduce((s, y) => s + y.acquiredEC, 0);

  // EC hires per year — depends on mode
  let ecYearly;
  if (mode === "hireMix") {
    const pct = Math.min(99, Math.max(0, mixPct)) / 100;
    ecYearly = yearly.map(y => Math.round(y.gross * pct));
  } else {
    // orgMix: solve end-of-Y3 EC% = targetPct, accounting for EC drain (attrition + L2 promos)
    // and EC lift (acquired EC).
    const p = Math.min(0.99, Math.max(0, targetPct / 100));
    const endHC = baseTotal + yearly.reduce((s, y) => s + y.growth, 0);
    const targetECEnd = Math.round(endHC * p);
    const ecShare0 = baseTotal > 0 ? baseEarly / baseTotal : 0;
    // First-order: attrition takes EC at starting share rate; promotions take L2 portion of EC.
    const expectedECAttrLoss = Math.round(totalAttr * ecShare0);
    const expectedECPromoLoss = Math.round(totalPromos * l2InitShare * (baseEarly > 0 ? 1 : 0));
    const ecHorizon = Math.max(0, targetECEnd - baseEarly + expectedECAttrLoss + expectedECPromoLoss - totalAcqEC);
    const grossWeights = yearly.map(y => y.gross || 0);
    ecYearly = largestRemainderAlloc(Math.min(ecHorizon, totalGross), grossWeights.length ? grossWeights : [1,1,1]);
    ecYearly = ecYearly.map((v, i) => Math.min(v, yearly[i].gross));
  }

  // Build per-year output rows with running EC simulation
  let runningHC = baseTotal;
  let runningEC = baseEarly;
  yearly.forEach((y, i) => {
    y.ec = ecYearly[i] || 0;
    y.exp = y.gross - y.ec;
    y.interns = Math.ceil(y.ec * internRatio);
    // EC outflows: proportional attrition + L2-share of promotions (L2→L3 leaves EC pool).
    const ecShareNow = runningHC > 0 ? runningEC / runningHC : 0;
    const ecLossAttr = Math.round(y.attrition * ecShareNow);
    const l2ShareNow = runningEC > 0 ? l2InitShare : 0;
    const ecLossPromo = Math.round(y.promotions * (runningEC / Math.max(1, runningHC)) * l2ShareNow / Math.max(1e-9, ecShareNow));
    // ↑ approximates L2→L3 outflow; equivalent to round(runningL2 * pPct) when shares hold.
    y.ecPromoted = Math.min(ecLossPromo, runningEC);
    runningEC += y.ec + y.acquiredEC - ecLossAttr - y.ecPromoted;
    runningHC += y.growth;
    if (runningEC < 0) runningEC = 0;
    y.endHC = runningHC;
    y.endECApprox = runningEC;
    y.endECPctApprox = runningHC ? Math.round(100 * runningEC / runningHC) : 0;
  });

  // Backfill level distribution: total vacated slots (attrition + promotions) × current level shares
  const totalBackfill = totalAttr + totalPromos;
  const lvKeys = Object.keys(levelHistogram || {});
  const lvWeights = lvKeys.map(k => levelHistogram[k] || 0);
  const backfillAlloc = lvKeys.length ? largestRemainderAlloc(totalBackfill, lvWeights) : [];
  const backfillByLevel = {};
  lvKeys.forEach((k, i) => { if (backfillAlloc[i] > 0) backfillByLevel[k] = backfillAlloc[i]; });

  return {
    yearly,
    threeYear: {
      totalAttrition: totalAttr,
      totalPromotions: totalPromos,
      totalAcquired: totalAcq,
      totalAcquiredEC: totalAcqEC,
      totalGrowth: yearly.reduce((s, y) => s + y.growth, 0),
      totalGross,
      totalEC: yearly.reduce((s, y) => s + y.ec, 0),
      totalExp: yearly.reduce((s, y) => s + y.exp, 0),
      totalInterns: yearly.reduce((s, y) => s + y.interns, 0),
      totalECPromoted: yearly.reduce((s, y) => s + (y.ecPromoted || 0), 0),
      endingHC: yearly[yearly.length - 1].endHC,
      endingECPct: yearly[yearly.length - 1].endECPctApprox,
    },
    backfillByLevel,
  };
}

// Backfill reqs: created at the same level as departed staff, distributed across 3 years.
function buildAttritionBackfillReqs({ model, levelHistogram, managersByLevel, planStartYear, idStart }) {
  const reqs = [];
  let idCounter = idStart;
  const lvKeys = Object.keys(levelHistogram || {}).filter(k => levelHistogram[k] > 0);
  if (!lvKeys.length || !model.yearly.length) return reqs;
  // Distribute total attrition across years using yearly attrition as weight
  const yearWeights = model.yearly.map(y => y.attrition);
  const totalAttr = model.threeYear.totalAttrition;
  if (!totalAttr) return reqs;
  // For each level, allocate that level's total backfill across years
  lvKeys.forEach(lv => {
    const lvShare = (model.backfillByLevel[lv] || 0);
    if (!lvShare) return;
    const perYear = largestRemainderAlloc(lvShare, yearWeights);
    perYear.forEach((count, yi) => {
      if (!count) return;
      const year = planStartYear + yi;
      const rng = seededRand(`backfill|${lv}|${year}`);
      const mgrs = managersByLevel[lv] || managersByLevel.__any || [];
      for (let i = 0; i < count; i++) {
        const qNum = (i % 4) + 1;
        const startMonth = (qNum - 1) * 3 + 1;
        const targetStart = `${year}-${String(startMonth).padStart(2, "0")}-01`;
        const open = new Date(`${targetStart}T00:00:00`); open.setDate(open.getDate() - 60);
        const hMgr = mgrs.length ? mgrs[Math.floor(rng() * mgrs.length)] : null;
        const loc = hMgr ? hMgr.location : LOCATIONS[Math.floor(rng() * LOCATIONS.length)];
        const sIdx = Math.floor(rng() * 12);
        const status = sIdx < 7 ? "Open" : sIdx < 9 ? "Sourcing" : sIdx === 9 ? "Interviewing" : sIdx === 10 ? "Offer" : "Filled";
        const group = hMgr ? (hMgr.dept || hMgr.bg || hMgr.fn) : "Engineering";
        reqs.push({
          id: `REQ-${String(idCounter++).padStart(4, "0")}`,
          group, level: lv, isEC: EARLY_DISPLAY_LEVELS.has(lv),
          title: pickTitleForReq(group, lv, rng) + " (Backfill)",
          location: loc, country: countryFor(loc),
          openDate: open.toISOString().slice(0, 10), targetStart,
          quarter: `${year} Q${qNum}`,
          hiringManager: hMgr ? `${hMgr.first} ${hMgr.last}` : "TBD",
          hiringManagerId: hMgr ? hMgr.id : null,
          employmentType: "FTE",
          source: "backfill", status,
        });
      }
    });
  });
  return reqs;
}

// Growth reqs: net new positions, allocated by group share, distributed across 3 years
// using growthShiftPerYear weights.
function buildGrowthReqs({ model, allocByGroup, managersByGroup, planStartYear, idStart }) {
  const reqs = [];
  let idCounter = idStart;
  const yearWeights = model.yearly.map(y => y.growth);
  const totalGrowth = model.threeYear.totalGrowth;
  if (!totalGrowth || !allocByGroup.length) return reqs;
  // allocByGroup uses share weights for EC; reuse the same shares for growth distribution.
  const groupWeights = allocByGroup.map(g => g.share || 1);
  const growthByGroup = largestRemainderAlloc(totalGrowth, groupWeights);
  allocByGroup.forEach((g, gi) => {
    const groupTotal = growthByGroup[gi];
    if (!groupTotal) return;
    const perYear = largestRemainderAlloc(groupTotal, yearWeights);
    perYear.forEach((count, yi) => {
      if (!count) return;
      const year = planStartYear + yi;
      const rng = seededRand(`growth|${g.group}|${year}`);
      const mgrs = managersByGroup[g.group] || [];
      for (let i = 0; i < count; i++) {
        // Mid-level IC default for growth (L3); EC reqs are emitted separately
        const lv = "L3";
        const qNum = (i % 4) + 1;
        const startMonth = (qNum - 1) * 3 + 1;
        const targetStart = `${year}-${String(startMonth).padStart(2, "0")}-01`;
        const open = new Date(`${targetStart}T00:00:00`); open.setDate(open.getDate() - 60);
        const hMgr = mgrs.length ? mgrs[Math.floor(rng() * mgrs.length)] : null;
        const loc = hMgr ? hMgr.location : LOCATIONS[Math.floor(rng() * LOCATIONS.length)];
        const sIdx = Math.floor(rng() * 12);
        const status = sIdx < 7 ? "Open" : sIdx < 9 ? "Sourcing" : sIdx === 9 ? "Interviewing" : sIdx === 10 ? "Offer" : "Filled";
        reqs.push({
          id: `REQ-${String(idCounter++).padStart(4, "0")}`,
          group: g.group, level: lv, isEC: false,
          title: pickTitleForReq(g.group, lv, rng) + " (Growth)",
          location: loc, country: countryFor(loc),
          openDate: open.toISOString().slice(0, 10), targetStart,
          quarter: `${year} Q${qNum}`,
          hiringManager: hMgr ? `${hMgr.first} ${hMgr.last}` : "TBD",
          hiringManagerId: hMgr ? hMgr.id : null,
          employmentType: "FTE",
          source: "growth", status,
        });
      }
    });
  });
  return reqs;
}

// EC-calc reqs spread across the 3-year horizon.
// EC totals come from the attrition+growth model (totalEC, distributed by yearly.ec).
function buildECCalcReqs({ allocByGroup, managersByGroup, planStartYear, model, idStart }) {
  const reqs = [];
  let idCounter = idStart;
  if (!model || !model.threeYear.totalEC) return reqs;
  const yearWeights = model.yearly.map(y => y.ec);
  allocByGroup.forEach(g => {
    if (!g.ecPerYear) return;
    // ecPerYear here is the per-group share of the *3-year total*.
    const groupTotal3yr = g.ecPerYear; // (re-interpreted by computeEarlyAllocByGroup below)
    const perYear = largestRemainderAlloc(groupTotal3yr, yearWeights);
    perYear.forEach((count, yi) => {
      if (!count) return;
      const year = planStartYear + yi;
      const rng = seededRand(`${g.group}|eccalc|${year}`);
      const mgrs = managersByGroup[g.group] || [];
      for (let i = 0; i < count; i++) {
        const qNum = (i % 4) + 1;
        const lv = i % 2 === 0 ? "L1" : "L2";
        const hMgr = mgrs.length ? mgrs[Math.floor(rng() * mgrs.length)] : null;
        const startMonth = (qNum - 1) * 3 + 1;
        const targetStart = `${year}-${String(startMonth).padStart(2, "0")}-01`;
        const open = new Date(`${targetStart}T00:00:00`);
        open.setDate(open.getDate() - 60);
        const loc = hMgr ? hMgr.location : LOCATIONS[Math.floor(rng() * LOCATIONS.length)];
        const sIdx = Math.floor(rng() * 12);
        const status = sIdx < 7 ? "Open" : sIdx < 9 ? "Sourcing" : sIdx === 9 ? "Interviewing" : sIdx === 10 ? "Offer" : "Filled";
        reqs.push({
          id: `REQ-${String(idCounter++).padStart(4, "0")}`,
          group: g.group, level: lv, isEC: true,
          title: pickTitleForReq(g.group, lv, rng),
          location: loc, country: countryFor(loc),
          openDate: open.toISOString().slice(0, 10), targetStart,
          quarter: `${year} Q${qNum}`,
          hiringManager: hMgr ? `${hMgr.first} ${hMgr.last}` : "TBD",
          hiringManagerId: hMgr ? hMgr.id : null,
          employmentType: "FTE",
          source: "ec-calc", status,
        });
      }
    });
  });
  return reqs;
}

// Apply per-req user overrides + assign a default project.
function applyReqOverridesAndProjects(reqs, overrides, projects) {
  return reqs.map(r => {
    const ov = overrides[r.id] || {};
    const level = ov.level || r.level;
    const location = ov.location || r.location;
    const defaultProj = projects.find(p => p.owningGroup === r.group) || projects[0];
    const projectId = ov.projectId || (defaultProj ? defaultProj.id : null);
    return {
      ...r, level, location,
      country: countryFor(location),
      isEC: EARLY_DISPLAY_LEVELS.has(level),
      projectId,
    };
  });
}

// Sample projects from the org's largest depts (used when projects array is empty).
function generateSampleProjectsFromEmps(activeEmployees) {
  const deptCounts = {};
  activeEmployees.forEach(e => { if (e.dept) deptCounts[e.dept] = (deptCounts[e.dept] || 0) + 1; });
  const topDepts = Object.entries(deptCounts).sort((a,b) => b[1]-a[1]).slice(0, 6).map(x => x[0]);
  const productNames = {
    "IC Design": "Helios SoC",
    "Verification": "Helios DV Suite",
    "Physical Design": "Helios PD Tape-out",
    "Process Engineering": "Atlas 3nm Node",
    "Manufacturing": "Atlas Fab Ramp",
    "Test Engineering": "Falcon Test Platform",
    "Product Engineering": "Falcon Silicon Validation",
    "Software": "Polaris SDK",
    "Applications": "Polaris Reference Designs",
    "Quality & Reliability": "Reliability Initiative",
    "Systems Engineering": "Architecture Refresh",
  };
  const siteByDept = {};
  activeEmployees.forEach(e => {
    if (!e.dept || !e.location) return;
    siteByDept[e.dept] = siteByDept[e.dept] || {};
    siteByDept[e.dept][e.location] = (siteByDept[e.dept][e.location] || 0) + 1;
  });
  return topDepts.map((dept, i) => {
    const sites = Object.entries(siteByDept[dept] || {}).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x => x[0]);
    const targetMix = i < 2
      ? { L1: 3, L2: 5, L3: 6, L4: 4, L5: 2, M1: 2, M2: 1 }
      : i < 4
      ? { L1: 2, L2: 3, L3: 4, L4: 3, L5: 1, M1: 1 }
      : { L1: 1, L2: 2, L3: 3, L4: 2, M1: 1 };
    return {
      id: `PRJ-${String(i+1).padStart(3,"0")}`,
      name: productNames[dept] || `${dept} Initiative`,
      owningGroup: dept,
      groupKind: "dept",
      preferredSites: sites.length ? sites : ["San Jose HQ"],
      targetMix,
      critical: i < 2,
      notes: i === 0 ? "Q3 tape-out gate — staffing must hold." : "",
    };
  });
}

// ─── LEVEL FILTER ───
const LEVEL_FILTER_GROUPS = {
  "All":          () => true,
  "C-Suite":      l => l === "C-Suite",
  "VP+":          l => ["SVP","VP","C-Suite"].includes(l),
  "Director+":    l => ["Director","VP","SVP","C-Suite"].includes(l),
  "Managers":     l => ["Manager","Director","VP","SVP","C-Suite"].includes(l),
  "Senior ICs":   l => ["IC4","IC5","IC6"].includes(l),
};

// ─── ORG NODE (module-level, stable reference — fixes drag-and-drop) ───
const OrgNode = memo(function OrgNode({ node, depth = 0 }) {
  const {
    expandedNodes, toggleExpand, selectedNode,
    dragNode, setDragNode, dragOver, setDragOver, dragMode, handleDrop, teamDragRef,
    annotations, showHotspots, hotspotNodeIds, hotspotReasons,
    getNodeColor, getTenureColor, isFiltered, setDetailPanel, detailPanel,
    insightHighlightIds, flightRisks, showFlightRisk,
    tree, fullTree, setExitSimNode,
    showPlannedInOrgChart, reqsByManager,
    positionMode, addPositionUnder, removePositionUnder,
  } = useContext(AppCtx);

  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNode === node.id;
  const isDragTarget = dragOver === node.id;
  const isBeingDragged = dragNode === node.id;
  const hasAnnotations = annotations[node.id]?.length > 0;
  const isHotspot = showHotspots && hotspotNodeIds.has(node.id);
  const filtered = isFiltered(node);
  const color = getNodeColor(node);
  const tenureColor = getTenureColor(node.startDate);
  const showGhosts = (showPlannedInOrgChart || positionMode);
  const ghostReqs = (showGhosts && reqsByManager) ? (reqsByManager[node.id] || []) : [];
  const customGhostCount = ghostReqs.filter(r => r.source === "manual").length;
  const hasGhosts = ghostReqs.length > 0;
  const hasChildren = node.children.length > 0;
  const hasExpandable = hasChildren || hasGhosts;

  // Flight risk
  const riskEntry = flightRisks?.[node.id];
  const riskScore = riskEntry?.score ?? null;
  const riskLabel = riskScore != null ? flightRiskLabel(riskScore) : null;
  const riskReasons = riskEntry?.reasons ?? [];

  const isDeparted = node.status === "Terminated";
  // Use fullTree for manager lookup when showDeparted so terminated managers are also resolvable
  const mgrNode = node.managerId ? (fullTree || tree).map[node.managerId] : null;

  // Insight highlight mode: if any IDs are highlighted, dim non-highlighted nodes
  const hasHighlightSet = insightHighlightIds && insightHighlightIds.size > 0;
  const isInsightHighlighted = hasHighlightSet && insightHighlightIds.has(node.id);
  const isDetailOpen = detailPanel?.id === node.id;
  const nodeOpacity = isDeparted
    ? 0.5
    : hasHighlightSet
    ? (isInsightHighlighted ? 1 : 0.12)
    : (filtered ? 1 : 0.25);

  return (
    <div className="flex flex-col items-center" style={{ opacity: nodeOpacity, transition: "opacity 0.25s ease" }}>
      <div
        id={`node-${node.id}`}
        draggable={!isDeparted}
        onDragStart={isDeparted ? undefined : (e) => { e.stopPropagation(); teamDragRef.current = dragMode === "team"; setDragNode(node.id); e.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={isDeparted ? undefined : () => { setDragNode(null); setDragOver(null); teamDragRef.current = false; }}
        onDragOver={isDeparted ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(node.id); }}
        onDragLeave={isDeparted ? undefined : (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); }}
        onDrop={isDeparted ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); handleDrop(node.id); }}
        onClick={() => setDetailPanel(node)}
        className={`relative cursor-pointer select-none ${isDetailOpen ? "ring-2 ring-amber-400 ring-offset-2" : ""} ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""} ${isDragTarget ? "ring-2 ring-green-400 ring-offset-2" : ""} ${isHotspot ? "ring-2 ring-red-400" : ""} ${isInsightHighlighted ? "ring-2 ring-violet-500 ring-offset-1" : ""}`}
        style={{
          background: isDeparted ? "#f1f5f9" : isBeingDragged ? "#eff6ff" : isDragTarget ? "#f0fdf4" : isDetailOpen ? "#fffbeb" : "white",
          borderRadius: 10,
          padding: "8px 12px",
          minWidth: 180,
          maxWidth: 220,
          boxShadow: isDetailOpen
            ? "0 4px 20px rgba(245,158,11,0.3)"
            : isSelected
            ? "0 4px 20px rgba(37,99,235,0.25)"
            : isDragTarget
            ? "0 4px 16px rgba(34,197,94,0.25)"
            : isInsightHighlighted
            ? "0 4px 20px rgba(139,92,246,0.35)"
            : "0 1px 4px rgba(0,0,0,0.08)",
          borderLeft: isDeparted ? "4px dashed #94a3b8" : node.employmentType === "Contract" ? `4px dashed ${color}` : `4px solid ${color}`,
          position: "relative",
          transform: isDragTarget ? "scale(1.04)" : "scale(1)",
          transition: "box-shadow 0.15s ease, transform 0.15s ease, background 0.15s ease, opacity 0.15s ease",
          opacity: isBeingDragged ? 0.55 : 1,
        }}
      >
        {hasAnnotations && (
          <div className="absolute -top-2 -right-2 flex gap-0.5">
            {annotations[node.id].map((a, i) => (
              <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ background: a.type === "hotspot" ? "#ef4444" : a.type === "flag" ? "#f59e0b" : "#3b82f6", fontSize: 10 }}>
                {a.type === "hotspot" ? "!" : a.type === "flag" ? "⚑" : "✎"}
              </div>
            ))}
          </div>
        )}
        {isHotspot && (
          <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
            title={(hotspotReasons[node.id] || []).join("\n")}>
            <AlertTriangle size={10} className="text-white" />
          </div>
        )}
        {showFlightRisk && riskLabel && riskLabel !== "low" && (
          <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white"
            style={{ background: RISK_COLORS[riskLabel], boxShadow: `0 0 4px ${RISK_COLORS[riskLabel]}88` }}
            title={`Flight risk: ${riskLabel} (${riskScore})${riskReasons.length ? "\n• " + riskReasons.join("\n• ") : ""}`}/>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: isDeparted ? "#94a3b8" : color, outline: showFlightRisk && riskLabel ? `2.5px solid ${RISK_COLORS[riskLabel]}` : "none", outlineOffset: 1 }}>
            {node.first[0]}{node.last[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <div className="text-xs font-semibold truncate flex-1" style={{ color: isDeparted ? "#94a3b8" : "#111827" }}>{node.first} {node.last}</div>
              <span className="shrink-0 text-gray-400 font-mono" style={{ fontSize: 8 }}>{displayLevel(node.level)}</span>
            </div>
            <div className="text-xs text-gray-500 truncate" style={{ fontSize: 10 }}>{node.title}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-1.5" style={{ fontSize: 9 }}>
          {isDeparted
            ? <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 font-semibold">Departed {node.endDate ? node.endDate.slice(0,7) : ""}</span>
            : <span className="px-1.5 py-0.5 rounded text-white" style={{ background: color, opacity: 0.8 }}>{node.dept}</span>
          }
          {!isDeparted && node.employmentType === "Contract" && (
            <span className="px-1 py-0.5 rounded font-bold border" style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a", fontSize: 8 }} title="Contractor">CTR</span>
          )}
          {!isDeparted && <span className="text-gray-400 flex items-center gap-0.5"><MapPin size={8}/>{node.location.split(" ")[0]}</span>}
          {hasGhosts && (
            <span className="px-1 py-0.5 rounded font-bold border" style={{ background: "#ecfdf5", color: "#047857", borderColor: "#6ee7b7", fontSize: 8 }} title={`${ghostReqs.length} open requisition${ghostReqs.length>1?"s":""}`}>
              +{ghostReqs.length} open
            </span>
          )}
          {hasChildren
            ? <span className="text-gray-400 ml-auto flex items-center gap-0.5"><Users size={8}/>{node._totalReports}</span>
            : mgrNode
            ? <span className="text-gray-300 ml-auto truncate" style={{maxWidth:60}}>↑{mgrNode.last}</span>
            : null
          }
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full" style={{ background: tenureColor, width: "100%" }} />
        </div>
        {hasExpandable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const wasCollapsed = !expandedNodes.has(node.id);
              toggleExpand(node.id);
              if (wasCollapsed) {
                // After children render, keep this node centered in the scroll pane
                setTimeout(() => {
                  document.getElementById(`node-${node.id}`)?.scrollIntoView({
                    behavior: "smooth", block: "nearest", inline: "center",
                  });
                }, 60);
              }
            }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors z-10"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
          >
            {isExpanded ? <ChevronDown size={12} className="text-gray-600"/> : <ChevronRight size={12} className="text-gray-600"/>}
          </button>
        )}
        <div className="absolute top-1 right-1 opacity-0 hover:opacity-100 transition-opacity cursor-grab" onMouseDown={(e) => e.stopPropagation()}>
          <GripVertical size={12} className="text-gray-400"/>
        </div>
        {positionMode && !isDeparted && (
          <div className="absolute -bottom-3 right-2 flex gap-1 z-10" onMouseDown={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); addPositionUnder(node.id); }}
              title={`Add an open position reporting to ${node.first} ${node.last}`}
              className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition-colors"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}>
              <Plus size={12}/>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); if (customGhostCount > 0) removePositionUnder(node.id); }}
              disabled={customGhostCount === 0}
              title={customGhostCount === 0 ? "No manually-added positions to remove here" : `Remove the most recent open position under ${node.first} ${node.last}`}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${customGhostCount === 0 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-rose-500 text-white hover:bg-rose-600"}`}
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}>
              <Minus size={12}/>
            </button>
          </div>
        )}
      </div>
      {hasExpandable && isExpanded && (
        <OrgConnectors node={node} color={color} depth={depth} ghostReqs={ghostReqs}/>
      )}
    </div>
  );
});

// ─── GHOST NODE — open req placeholder, dotted ring so it stands out ───
function GhostReqNode({ req }) {
  return (
    <div className="flex flex-col items-center" style={{ paddingTop: 0 }}>
      <div
        title={`Open req · ${req.id}\n${req.title}\n${req.location} · ${req.quarter}\nStatus: ${req.status}`}
        style={{
          position: "relative",
          background: "#f0fdf4",
          borderRadius: 10,
          padding: "8px 12px",
          minWidth: 180,
          maxWidth: 220,
          border: "2px dashed #10b981",
          outline: "2px dotted #34d399",
          outlineOffset: 3,
          boxShadow: "0 1px 4px rgba(16,185,129,0.18)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-700 text-[10px] font-black shrink-0"
            style={{ background: "#d1fae5", border: "2px dashed #10b981" }}>
            {req.level}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide truncate flex-1">Open Req</div>
              <span className="shrink-0 text-emerald-600 font-mono" style={{ fontSize: 8 }}>{req.id}</span>
            </div>
            <div className="text-xs text-gray-700 truncate" style={{ fontSize: 11 }}>{req.title}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-1.5" style={{ fontSize: 9 }}>
          <span className="px-1.5 py-0.5 rounded text-white font-semibold" style={{ background: "#10b981" }}>{req.status}</span>
          <span className="text-gray-500 flex items-center gap-0.5"><MapPin size={8}/>{req.location.split(" ")[0]}</span>
          <span className="text-gray-400 ml-auto">{req.quarter}</span>
        </div>
      </div>
    </div>
  );
}

// ─── SVG CONNECTOR OVERLAY — measures actual child positions for pixel-perfect lines ───
function OrgConnectors({ node, color, depth, ghostReqs = [] }) {
  const containerRef = useRef(null);
  const [lines, setLines] = useState(null);

  useEffect(() => {
    // getBoundingClientRect() returns viewport-space pixels which include any CSS
    // transform scale applied to an ancestor. The SVG lives inside the scaled element,
    // so its coordinate system is in PRE-scale (layout) pixels. We compute the
    // effective scale from the element itself so positions are always correct
    // regardless of zoom level or where in an animation we happen to sample.
    let timeoutId = null;

    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const parentEl = container.previousElementSibling; // the card div
      if (!parentEl) return;

      const containerRect = container.getBoundingClientRect();
      if (containerRect.width === 0) return; // not yet visible

      // Effective scale = viewport width / layout width.
      // offsetWidth is unaffected by ancestor CSS transforms; getBoundingClientRect
      // reflects the scaled viewport dimensions.
      const scale = container.offsetWidth > 0 ? containerRect.width / container.offsetWidth : 1;

      // Parent anchor: bottom-center of the card, in local (pre-scale) coords
      const parentRect = parentEl.getBoundingClientRect();
      const px = (parentRect.left + parentRect.width / 2 - containerRect.left) / scale;
      const py = 0; // top of container = bottom of parent card area

      // Find the direct child wrappers placed by this OrgConnectors instance
      const childEls = Array.from(container.querySelectorAll(':scope > div > div > [data-org-child]'));
      if (childEls.length === 0) return;

      const childAnchors = childEls.map(el => {
        // Drill into OrgNode wrapper → card div so the anchor is always the
        // card's center, even when the child is expanded and its subtree wrapper
        // is much wider than the card itself.
        const cardEl = el.firstElementChild?.firstElementChild ?? el;
        const r = cardEl.getBoundingClientRect();
        return {
          x: (r.left + r.width / 2 - containerRect.left) / scale,
          y: (r.top - containerRect.top) / scale,
        };
      });

      setLines({ px, py, children: childAnchors });
    };

    // Schedule a measurement after the next paint + a short layout-settle delay.
    // We keep a ref to the inner timeout so we can cancel it if the component
    // unmounts between requestAnimationFrame and the timeout firing.
    let rafId = requestAnimationFrame(() => {
      timeoutId = setTimeout(measure, 20);
    });

    // Re-measure after any CSS transform transition (covers zoom in/out).
    // Use the closest ancestor that carries the transform so we don't miss
    // rapid zoom-in / zoom-out sequences.
    const scaledAncestor = containerRef.current?.closest('[style*="scale"]');
    const onTransitionEnd = (e) => { if (e.propertyName === 'transform') measure(); };
    if (scaledAncestor) scaledAncestor.addEventListener('transitionend', onTransitionEnd);

    // Re-measure on window resize (handles browser zoom, panel resize, etc.)
    // ResizeObserver is preferred: it fires only when this subtree's layout changes,
    // not on every scroll or unrelated reflow.
    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => {
        // Debounce: cancel any pending timeout and reschedule
        clearTimeout(timeoutId);
        timeoutId = setTimeout(measure, 30);
      });
      ro.observe(containerRef.current);
      // Also observe the scroll container so panning / window resize are caught
      const scrollParent = containerRef.current.closest('.org-tree-scroll');
      if (scrollParent) ro.observe(scrollParent);
    }

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      if (scaledAncestor) scaledAncestor.removeEventListener('transitionend', onTransitionEnd);
      if (ro) ro.disconnect();
    };
  });

  const isGrid = node.children.every(c => c.children.length === 0) && node.children.length >= 3;
  const lineColor = `${color}55`;

  return (
    <div ref={containerRef} className="relative" style={{ marginTop: 12 }}>
      {/* SVG overlay for connectors */}
      {lines && (
        <svg className="absolute inset-0 pointer-events-none" style={{ overflow: "visible", zIndex: 0, width: "100%", height: "100%" }}>
          {/* Stem → horizontal bar → individual drops to every child (grid and non-grid) */}
          {lines.children.length > 0 && (() => {
            // Group children by row (rounded y) so the bar spans the top row only
            const topRowY = Math.min(...lines.children.map(c => c.y));
            const barY = topRowY - 6;
            const topRow = lines.children.filter(c => Math.abs(c.y - topRowY) < 4);
            return (
              <>
                {/* Vertical stem from parent card bottom to bar */}
                <line x1={lines.px} y1={lines.py} x2={lines.px} y2={barY}
                  stroke={lineColor} strokeWidth="2" strokeLinecap="round"/>
                {/* Horizontal bar spanning the top-row children */}
                {topRow.length > 1 && (
                  <line x1={Math.min(...topRow.map(c => c.x))} y1={barY}
                        x2={Math.max(...topRow.map(c => c.x))} y2={barY}
                    stroke={lineColor} strokeWidth="2" strokeLinecap="round"/>
                )}
                {/* One vertical drop per child — top-row children get a short drop,
                    lower-row children (grid mode) get an elbow via the bar x nearest them */}
                {lines.children.map((c, i) => {
                  const isTopRow = Math.abs(c.y - topRowY) < 4;
                  if (isTopRow) {
                    return (
                      <line key={i} x1={c.x} y1={barY} x2={c.x} y2={c.y}
                        stroke={lineColor} strokeWidth="2" strokeLinecap="round"/>
                    );
                  }
                  // Lower rows: elbow from the bar midpoint down to child
                  return (
                    <polyline key={i}
                      points={`${c.x},${barY} ${c.x},${c.y}`}
                      fill="none" stroke={lineColor} strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  );
                })}
              </>
            );
          })()}
        </svg>
      )}
      {/* Actual children + ghost reqs (open positions) */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {isGrid ? (
          <div className="grid gap-2 pt-1 border rounded-xl p-2"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderColor: `${color}22`, background: `${color}04` }}>
            {node.children.map(child => (
              <div key={child.id} data-org-child>
                <OrgNode node={child} depth={depth + 1}/>
              </div>
            ))}
            {ghostReqs.map(req => (
              <div key={req.id} data-org-child>
                <GhostReqNode req={req}/>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 items-start" style={{ paddingTop: 16 }}>
            {node.children.map(child => (
              <div key={child.id} className="flex flex-col items-center" data-org-child>
                <OrgNode node={child} depth={depth + 1}/>
              </div>
            ))}
            {ghostReqs.map(req => (
              <div key={req.id} className="flex flex-col items-center" data-org-child>
                <GhostReqNode req={req}/>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MILESTONE TOAST (lightweight — replaces fullscreen overlay) ───
const MILESTONE_META = {
  500:  { emoji: "🚀", label: "500 strong!",          color: "#2563eb" },
  1000: { emoji: "🏆", label: "One thousand!",         color: "#059669" },
  1500: { emoji: "🌟", label: "1,500 and counting!",   color: "#7c3aed" },
};

function MilestoneToast({ milestone, fading }) {
  const meta = MILESTONE_META[milestone] || { emoji: "🎉", label: "Milestone!", color: "#2563eb" };
  return (
    <div style={{
      position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", alignItems: "center", gap: 12,
      background: "white", borderRadius: 14,
      padding: "12px 24px 12px 18px",
      boxShadow: `0 4px 24px rgba(0,0,0,0.16), 0 0 0 3px ${meta.color}33`,
      animation: fading ? "milestoneFadeOut 0.4s ease forwards" : "milestonePop 0.45s cubic-bezier(0.34,1.56,0.64,1)",
      pointerEvents: "none",
      borderLeft: `4px solid ${meta.color}`,
    }}>
      <span style={{ fontSize: 30 }}>{meta.emoji}</span>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>Milestone Reached</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: meta.color, lineHeight: 1.15, letterSpacing: "-0.02em" }}>{milestone.toLocaleString()} employees</div>
        <div style={{ fontSize: 11, color: "#64748b" }}>{meta.label}</div>
      </div>
    </div>
  );
}

// ─── TIMELINE VIEW ───
function TimelineView() {
  const {
    employees, timelineMonth, setTimelineMonth, timelinePlaying, setTimelinePlaying,
    timelineSpeed, setTimelineSpeed, growthDimension, setGrowthDimension,
  } = useContext(AppCtx);

  const months = useMemo(() => {
    const dates = employees.map(e => new Date(e.startDate));
    const min = new Date(Math.min(...dates));
    const max = new Date(2025, 5, 1);
    const result = [];
    let d = new Date(min.getFullYear(), min.getMonth(), 1);
    while (d <= max) { result.push(new Date(d)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    return result;
  }, [employees]);

  const visibleIdx = timelineMonth ?? months.length - 1;
  const currentMonth = months[visibleIdx];
  const activeAtDate = useMemo(() => getActiveAtDate(employees, currentMonth), [employees, currentMonth]);
  const animatedCount = useAnimatedNumber(activeAtDate.length);

  // ── Milestone toast ──
  const [activeMilestone, setActiveMilestone] = useState(null);
  const [milestoneFading, setMilestoneFading] = useState(false);
  const prevCountRef = useRef(null);

  useEffect(() => {
    const count = activeAtDate.length;
    const prev = prevCountRef.current;
    if (prev !== null && timelinePlaying) {
      const crossed = Object.keys(MILESTONE_META).map(Number).find(n => prev < n && count >= n);
      if (crossed) { setMilestoneFading(false); setActiveMilestone(crossed); }
    }
    prevCountRef.current = count;
  }, [activeAtDate.length, timelinePlaying]);

  useEffect(() => {
    if (!activeMilestone) return;
    const fadeTimer = setTimeout(() => setMilestoneFading(true), 2200);
    const clearTimer = setTimeout(() => { setActiveMilestone(null); setMilestoneFading(false); }, 2600);
    return () => { clearTimeout(fadeTimer); clearTimeout(clearTimer); };
  }, [activeMilestone]);

  const dimField = { total: null, location: "location", bg: "bg", fn: "fn", dept: "dept" }[growthDimension];
  const dimValues = useMemo(() => {
    if (!dimField) return [];
    return [...new Set(employees.map(e => e[dimField]))].filter(Boolean).sort();
  }, [employees, dimField]);

  // ── Two-pass memoization: expensive counts computed once; cheap past/future
  // split applied separately so playback ticks don't recompute the whole dataset.

  // Pass 1: stable counts — only recomputes when data or dimension changes
  const baseMonthlyData = useMemo(() => months.map((m) => {
    const active = getActiveAtDate(employees, m);
    const point = { month: m.toLocaleDateString("en-US", { year: "2-digit", month: "short" }), count: active.length };
    if (dimField) dimValues.forEach(v => { point[v] = active.filter(e => e[dimField] === v).length; });
    return point;
  }), [employees, months, dimField, dimValues]);

  // Pass 2: apply playhead — cheap, runs on every tick but only touches the array once
  const allMonthlyData = useMemo(() => baseMonthlyData.map((point, i) => ({
    ...point, idx: i,
    pastCount: i <= visibleIdx ? point.count : null,
    ...(dimField ? Object.fromEntries(dimValues.map(v => [`${v}_past`, i <= visibleIdx ? point[v] : null])) : {}),
  })), [baseMonthlyData, dimField, dimValues, visibleIdx]);

  // Pass 1: stable hire/departure counts
  const baseHiresPerMonth = useMemo(() => months.map((m) => {
    const hires = employees.filter(e => { const d = new Date(e.startDate); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); }).length;
    const deps  = employees.filter(e => { if (!e.endDate) return false; const d = new Date(e.endDate); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); }).length;
    return { month: m.toLocaleDateString("en-US", { year: "2-digit", month: "short" }), hiresAll: hires, departuresAll: -deps };
  }), [employees, months]);

  // Pass 2: apply playhead
  const allHiresPerMonth = useMemo(() => baseHiresPerMonth.map((point, i) => ({
    ...point,
    hires: i <= visibleIdx ? point.hiresAll : null,
    departures: i <= visibleIdx ? point.departuresAll : null,
  })), [baseHiresPerMonth, visibleIdx]);

  // Current month label for ReferenceLine
  const currentMonthLabel = allMonthlyData[visibleIdx]?.month || "";

  const breakdownDimField = dimField || "dept";
  const breakdownColorDim = growthDimension === "total" ? "dept" : growthDimension;

  // Headcount milestones (500 / 1000 / 1500) — for jump buttons + reference lines
  // Use baseMonthlyData (stable) so milestones don't recompute on every playback tick.
  const milestones = useMemo(() => [500, 1000, 1500].map(n => {
    const mIdx = baseMonthlyData.findIndex(m => m.count >= n);
    return mIdx >= 0 ? { n, mIdx, month: baseMonthlyData[mIdx].month } : null;
  }).filter(Boolean), [baseMonthlyData]);

  // Company events: first hire per location, first hire per department
  const events = useMemo(() => {
    const evts = [];
    milestones.forEach(({ n, mIdx }) => {
      const meta = MILESTONE_META[n];
      evts.push({ idx: mIdx, emoji: meta?.emoji || "🎯", label: `${n.toLocaleString()} employees`, type: "milestone" });
    });
    const sorted = [...employees].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const seenLoc = {}, seenDept = {};
    sorted.forEach(e => {
      const d = new Date(e.startDate);
      const mIdx = months.findIndex(m => m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth());
      if (mIdx < 0) return;
      if (!seenLoc[e.location]) {
        seenLoc[e.location] = true;
        evts.push({ idx: mIdx, emoji: "📍", label: `First hire in ${e.location}`, sub: `${e.first} ${e.last} — ${e.title}`, type: "location" });
      }
      if (!seenDept[e.dept]) {
        seenDept[e.dept] = true;
        evts.push({ idx: mIdx, emoji: "⚡", label: `First ${e.dept} hire`, sub: `${e.first} ${e.last}`, type: "dept" });
      }
    });
    return evts.sort((a, b) => a.idx - b.idx);
  }, [employees, months, milestones]);

  const interval = Math.max(1, Math.floor(allMonthlyData.length / 8));
  const visibleMilestones = milestones.filter(m => m.mIdx <= visibleIdx);

  return (
    <>
    {activeMilestone && <MilestoneToast milestone={activeMilestone} fading={milestoneFading}/>}
    <div className="p-6 h-full overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Company Growth Timeline<Help text="Replays company headcount month-by-month from founding to today. Press Play or drag the scrubber to watch hires and departures unfold; the charts below track growth, attrition, and tenure over time." side="bottom" width={300} /></h2>
          <p className="text-sm text-gray-500">From 3 co-founders to {employees.filter(e => e.status === "Active").length} employees</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-blue-600" style={{ fontVariantNumeric: "tabular-nums", minWidth: 80, display: "inline-block" }}>
            {animatedCount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{currentMonth?.toLocaleDateString("en-US", { year: "numeric", month: "long" })}</div>
        </div>
      </div>

      {/* Timeline controls */}
      <div className="bg-white rounded-xl p-4 mb-6 border border-gray-100" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <button onClick={() => setTimelineMonth(0)} className="p-1.5 rounded hover:bg-gray-100 transition-colors"><SkipBack size={14}/></button>
          <button
            onClick={() => setTimelinePlaying(!timelinePlaying)}
            className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            style={{ boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
          >
            {timelinePlaying ? <Pause size={14}/> : <Play size={14}/>}
          </button>
          <button onClick={() => setTimelineMonth(months.length - 1)} className="p-1.5 rounded hover:bg-gray-100 transition-colors"><SkipForward size={14}/></button>
          <input
            type="range" min={0} max={months.length - 1}
            value={visibleIdx}
            onChange={e => setTimelineMonth(Number(e.target.value))}
            className="flex-1 accent-blue-600"
            style={{ cursor: "pointer", minWidth: 120 }}
          />
          <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
            <span className="text-xs text-gray-400 mr-1">Speed:</span>
            {[0.5, 1, 2, 4, 8].map(s => (
              <button key={s} onClick={() => setTimelineSpeed(s)} className="text-xs px-2 py-1 rounded transition-colors"
                style={{ background: timelineSpeed === s ? "#2563eb" : "#f1f5f9", color: timelineSpeed === s ? "white" : "#475569", fontWeight: timelineSpeed === s ? 700 : 400 }}>
                {s === 0.5 ? "½×" : `${s}×`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {milestones.map(({ n, mIdx }) => (
            <button key={n} onClick={() => setTimelineMonth(mIdx)}
              className="text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity"
              style={{ background: MILESTONE_META[n]?.color + "18", color: MILESTONE_META[n]?.color, fontWeight: 600 }}>
              {MILESTONE_META[n]?.emoji} {n.toLocaleString()} employees
            </button>
          ))}
        </div>
      </div>

      {/* Growth chart — fixed size, playhead moves across */}
      <div className="bg-white rounded-xl p-4 mb-6 border border-gray-100" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-gray-700">Headcount Over Time</h3>
          <div className="flex gap-1 flex-wrap">
            {[["total","Total"], ["location","Location"], ["bg","Business Unit"], ["fn","Discipline"], ["dept","Department"]].map(([k, label]) => (
              <button key={k} onClick={() => setGrowthDimension(k)} className="text-xs px-2.5 py-1 rounded-full transition-all"
                style={{ background: growthDimension === k ? "#2563eb" : "#f1f5f9", color: growthDimension === k ? "white" : "#475569",
                  fontWeight: growthDimension === k ? 600 : 400, boxShadow: growthDimension === k ? "0 1px 6px rgba(37,99,235,0.3)" : "none" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          {growthDimension === "total" ? (
            <AreaChart data={allMonthlyData} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03}/>
                </linearGradient>
                <linearGradient id="futureGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.08}/>
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={interval}/>
              <YAxis tick={{ fontSize: 10 }}/>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}/>
              {visibleMilestones.map(({ n, month }) => (
                <ReferenceLine key={n} x={month} stroke={MILESTONE_META[n]?.color || "#f59e0b"} strokeDasharray="4 3"
                  label={{ value: `${MILESTONE_META[n]?.emoji} ${n.toLocaleString()}`, position: "top", fontSize: 9, fill: MILESTONE_META[n]?.color || "#d97706", fontWeight: 700 }}/>
              ))}
              {/* Full timeline in faint gray */}
              <Area type="monotone" dataKey="count" stroke="#cbd5e1" fill="url(#futureGrad)" strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false}/>
              {/* Played portion in bold blue */}
              <Area type="monotone" dataKey="pastCount" stroke="#2563eb" fill="url(#totalGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false}/>
              {/* Playhead indicator */}
              <ReferenceLine x={currentMonthLabel} stroke="#2563eb" strokeWidth={2} label={{ value: "▼", position: "top", fontSize: 12, fill: "#2563eb" }}/>
            </AreaChart>
          ) : (
            <AreaChart data={allMonthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={interval}/>
              <YAxis tick={{ fontSize: 10 }}/>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}/>
              <Legend wrapperStyle={{ fontSize: 10 }}/>
              {dimValues.map((v, i) => (
                <Area key={v} type="monotone" dataKey={v} stackId="a"
                  stroke={getDimColor(growthDimension, v, i)} fill={getDimColor(growthDimension, v, i)}
                  fillOpacity={0.2} strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false}/>
              ))}
              {dimValues.map((v, i) => (
                <Area key={`${v}_past`} type="monotone" dataKey={`${v}_past`} stackId="b"
                  stroke={getDimColor(growthDimension, v, i)} fill={getDimColor(growthDimension, v, i)}
                  fillOpacity={0.75} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls={false}/>
              ))}
              <ReferenceLine x={currentMonthLabel} stroke="#1e293b" strokeWidth={2} strokeDasharray="none"
                label={{ value: "▼", position: "top", fontSize: 12, fill: "#1e293b" }}/>
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Hires / departures — fixed size with playhead */}
      <div className="bg-white rounded-xl p-4 mb-6 border border-gray-100" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h3 className="text-sm font-bold text-gray-700 mb-3">Monthly Hires & Departures</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={allHiresPerMonth} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={interval}/>
            <YAxis tick={{ fontSize: 10 }}/>
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}/>
            {/* Faint full-timeline bars */}
            <Bar dataKey="hiresAll" fill="#22c55e" fillOpacity={0.15} radius={[2, 2, 0, 0]} isAnimationActive={false}/>
            <Bar dataKey="departuresAll" fill="#ef4444" fillOpacity={0.15} radius={[2, 2, 0, 0]} isAnimationActive={false}/>
            {/* Played portion bars (will render as null/missing after playhead) */}
            <Bar dataKey="hires" fill="#22c55e" radius={[2, 2, 0, 0]} isAnimationActive={false}/>
            <Bar dataKey="departures" fill="#ef4444" radius={[2, 2, 0, 0]} isAnimationActive={false}/>
            <ReferenceLine x={currentMonthLabel} stroke="#1e293b" strokeWidth={2} label={{ value: "▼", position: "top", fontSize: 12, fill: "#1e293b" }}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Breakdown at selected date */}
        <div className="bg-white rounded-xl p-4 border border-gray-100" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 className="text-sm font-bold text-gray-700 mb-3">
            {growthDimension === "location" ? "Location" : growthDimension === "bg" ? "Business Unit" : growthDimension === "fn" ? "Discipline" : "Department"} Breakdown
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(activeAtDate.reduce((acc, e) => {
              const key = e[breakdownDimField] || "Other";
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {})).sort((a, b) => b[1] - a[1]).map(([key, count], i) => {
              const c = getDimColor(breakdownColorDim, key, i);
              return (
                <div key={key} className="flex items-center gap-1.5 text-xs p-1.5 rounded" style={{ background: `${c}12` }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c }}/>
                  <span className="truncate text-gray-700" style={{ fontSize: 10 }}>{key}</span>
                  <span className="ml-auto font-bold text-gray-900">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Company events feed */}
        <div className="bg-white rounded-xl p-4 border border-gray-100" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 className="text-sm font-bold text-gray-700 mb-3">Company Events</h3>
          <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
            {events.map((ev, i) => {
              const past = ev.idx <= visibleIdx;
              return (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 rounded px-1 transition-colors"
                  style={{ opacity: past ? 1 : 0.3 }}
                  onClick={() => setTimelineMonth(ev.idx)}>
                  <span style={{ fontSize: 14, lineHeight: 1.4 }}>{ev.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800" style={{ fontSize: 11 }}>{ev.label}</div>
                    {ev.sub && <div className="text-gray-400 truncate" style={{ fontSize: 10 }}>{ev.sub}</div>}
                    <div className="text-gray-300" style={{ fontSize: 9 }}>{months[ev.idx]?.toLocaleDateString("en-US", { year: "numeric", month: "short" })}</div>
                  </div>
                  {past && ev.type === "milestone" && (
                    <div className="shrink-0 w-1.5 h-1.5 rounded-full mt-1.5" style={{ background: MILESTONE_META[ev.label.replace(/,/g,"").split(" ")[0]]?.color || "#2563eb" }}/>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ─── DASHBOARD VIEW ───
function DashboardView() {
  const { employees, activeEmployees, tree, hotspots, dashTab, setDashTab, navigateTo, setView,
    setFilterDept, setFilterLoc, setFilterBG, setDetailPanel, setFocusRoot, setInsightHighlightIds,
    flightRisks, navigateToDept } = useContext(AppCtx);

  const deptData  = useMemo(() => Object.entries(activeEmployees.reduce((acc, e) => { acc[e.dept]     = (acc[e.dept]     || 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).map(([name,value]) => ({ name, value, fill: DEPT_COLORS[name] || "#64748b" })), [activeEmployees]);
  const locData   = useMemo(() => Object.entries(activeEmployees.reduce((acc, e) => { acc[e.location] = (acc[e.location] || 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1]).map(([name,value]) => ({ name, value })), [activeEmployees]);
  const bgData    = useMemo(() => Object.entries(activeEmployees.reduce((acc, e) => { acc[e.bg]       = (acc[e.bg]       || 0) + 1; return acc; }, {})).map(([name,value]) => ({ name, value, fill: BG_COLORS[name] || "#64748b" })), [activeEmployees]);
  const fnData    = useMemo(() => Object.entries(activeEmployees.reduce((acc, e) => { acc[e.fn]       = (acc[e.fn]       || 0) + 1; return acc; }, {})).map(([name,value]) => ({ name, value })), [activeEmployees]);
  const levelData = useMemo(() => {
    const counts = {};
    ALL_DISPLAY_LEVELS.forEach(lv => { counts[lv] = 0; });
    activeEmployees.forEach(e => { const dl = displayLevel(e.level); if (counts[dl] !== undefined) counts[dl] += 1; });
    return ALL_DISPLAY_LEVELS.map(lv => ({ name: lv, value: counts[lv] }));
  }, [activeEmployees]);

  const { engRatio, dvRatio, gaRatio, avgTenure, last90Hires, last90Departures } = useMemo(() => {
    const dataNow = new Date(2025, 5, 1); // fixed "today" matching data generator (Jun 1 2025)
    const TECH_DEPTS = new Set(["IC Design","Verification","Physical Design","Software","Systems Engineering","Test Engineering","Product Engineering","Applications","Field Applications","Process Engineering","Quality & Reliability"]);
    const eng  = activeEmployees.filter(e => TECH_DEPTS.has(e.taxo)).length;
    const des  = activeEmployees.filter(e => e.taxo === "IC Design").length;
    const dv   = activeEmployees.filter(e => e.taxo === "Verification").length;
    const ga   = activeEmployees.filter(e => e.bucket === "G&A").length;
    const tot  = activeEmployees.length || 1;
    return {
      engCount: eng, engRatio: ((eng / tot) * 100).toFixed(0),
      designCount: des, dvCount: dv, dvRatio: dv > 0 ? (dv / des).toFixed(1) : "N/A",
      gaCount: ga, gaRatio: ((ga / tot) * 100).toFixed(0),
      avgTenure: (activeEmployees.reduce((s,e) => s + (dataNow - new Date(e.startDate)) / (1000*60*60*24*365), 0) / tot).toFixed(1),
      last90Hires: activeEmployees.filter(e => (dataNow - new Date(e.startDate)) / (1000*60*60*24) < 90).length,
      last90Departures: employees.filter(e => e.endDate && (dataNow - new Date(e.endDate)) / (1000*60*60*24) < 90).length,
    };
  }, [activeEmployees, employees]);

  const { managers, spanData } = useMemo(() => {
    const mgrs = activeEmployees.filter(e => tree.map[e.id] && tree.map[e.id]._directReports > 0);
    return {
      managers: mgrs,
      spanData: [
        { range: "1-3",  count: mgrs.filter(m => tree.map[m.id]._directReports <= 3).length },
        { range: "4-7",  count: mgrs.filter(m => { const d = tree.map[m.id]._directReports; return d >= 4 && d <= 7; }).length },
        { range: "8-10", count: mgrs.filter(m => { const d = tree.map[m.id]._directReports; return d >= 8 && d <= 10; }).length },
        { range: "11+",  count: mgrs.filter(m => tree.map[m.id]._directReports > 10).length },
      ],
    };
  }, [activeEmployees, tree]);

  const locColors = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#e11d48", "#16a34a"];
  const fnColors = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#64748b"];

  const tabs = [
    { id: "executive", label: "Executive Summary", icon: BarChart3 },
    { id: "semi", label: "Semiconductor Insights", icon: Zap },
    { id: "managers", label: "Manager Health", icon: Target },
    { id: "hotspots", label: "Hotspot Report", icon: AlertTriangle },
    { id: "coverage", label: "Skills Coverage", icon: Globe },
  ];

  // ── Coverage heat map data ──
  const COV_ROLES = ["IC Design","Verification","Physical Design","Software","Systems Engineering","Test Engineering","Product Engineering","Applications","Field Applications","Quality & Reliability"];
  const COV_MIN   = { "IC Design": 30, "Verification": 25, "Physical Design": 20, "Software": 15, "Systems Engineering": 12, "Test Engineering": 15, "Product Engineering": 12, "Applications": 10, "Field Applications": 8, "Quality & Reliability": 10 };
  const BUS_GROUPS = ["Automotive BU", "Data Center BU"];

  const coverageData = useMemo(() => {
    return BUS_GROUPS.map(bg => {
      const row = { bg };
      COV_ROLES.forEach(role => {
        row[role] = activeEmployees.filter(e => e.productBU === bg && e.taxo === role).length;
      });
      return row;
    });
  }, [activeEmployees]);

  return (
    <div className="p-6 h-full overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Dashboards & Insights<Help text="Executive KPIs and analytical views. Switch sub-tabs (Executive, Semiconductor Insights, Manager Health, Hotspot Report, Skills Coverage) to drill into headcount mix, span-of-control, and discipline coverage. Click most charts to filter the org chart." side="bottom" width={300} /></h2>
      <div className="flex gap-1 mb-6 border-b border-gray-100 pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setDashTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${dashTab === t.id ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
            <t.icon size={12}/>{t.label}
          </button>
        ))}
      </div>

      {dashTab === "executive" && (
        <div>
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "Active Headcount", value: activeEmployees.length, icon: Users, color: "#2563eb", action: () => setDashTab("semi") },
              { label: "Avg Tenure (yrs)", value: avgTenure, icon: Clock, color: "#059669", action: () => { setView("timeline"); } },
              { label: "Hires (90 days)", value: `+${last90Hires}`, icon: TrendingUp, color: "#16a34a", action: () => { setView("timeline"); } },
              { label: "Departures (90d)", value: last90Departures, icon: AlertCircle, color: "#ef4444", action: () => { setView("analytics"); } },
            ].map((kpi, i) => (
              <div key={i} onClick={kpi.action} className="bg-white rounded-xl p-4 border border-gray-100 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg" style={{ background: `${kpi.color}15` }}><kpi.icon size={14} style={{ color: kpi.color }}/></div>
                  <span className="text-xs text-gray-400">{kpi.label}</span>
                  <ArrowRight size={10} className="text-gray-300 ml-auto"/>
                </div>
                <div className="text-2xl font-black text-gray-900">{kpi.value}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Headcount by Department <span className="text-gray-400 font-normal text-xs ml-1">· click bar to filter</span></h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={deptData.slice(0, 10)} layout="vertical" margin={{ left: 80 }} style={{ cursor: "pointer" }}>
                  <XAxis type="number" tick={{ fontSize: 10 }}/>
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={75}/>
                  <Tooltip contentStyle={{ fontSize: 11 }}/>
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} onClick={(data) => navigateToDept(data.name)}>
                    {deptData.slice(0, 10).map((d, i) => <Cell key={i} fill={d.fill} className="cursor-pointer hover:opacity-80"/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Business Unit Mix</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={bgData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} style={{ fontSize: 10 }}>
                    {bgData.map((d, i) => <Cell key={i} fill={d.fill}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11 }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-3">By Location <span className="text-gray-400 font-normal text-xs ml-1">· click to filter</span></h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={locData} layout="vertical" margin={{ left: 70 }} style={{ cursor: "pointer" }}>
                  <XAxis type="number" tick={{ fontSize: 10 }}/>
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={65}/>
                  <Tooltip contentStyle={{ fontSize: 11 }}/>
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} onClick={(data) => { setFocusRoot(null); setInsightHighlightIds(new Set()); setFilterLoc(data.name); setFilterDept("All"); setFilterBG("All"); setView("org-chart"); }}>
                    {locData.map((_, i) => <Cell key={i} fill={locColors[i % locColors.length]} className="cursor-pointer"/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-700 mb-3">By Discipline</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={fnData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} style={{ fontSize: 9 }}>
                    {fnData.map((_, i) => <Cell key={i} fill={fnColors[i % fnColors.length]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11 }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {dashTab === "semi" && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Engineering Ratio", value: `${engRatio}%`, benchmark: "Target: 60-70%", ok: Number(engRatio) >= 55, color: "#2563eb" },
              { label: "DV:Design Ratio", value: `${dvRatio}:1`, benchmark: "Target: 2:1 to 3:1", ok: Number(dvRatio) >= 1.5, color: "#7c3aed" },
              { label: "G&A Ratio", value: `${gaRatio}%`, benchmark: "Target: <20%", ok: Number(gaRatio) <= 22, color: "#64748b" },
            ].map((m, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="text-xs text-gray-400 mb-1">{m.label}</div>
                <div className="text-3xl font-black mb-1" style={{ color: m.color }}>{m.value}</div>
                <div className={`text-xs flex items-center gap-1 ${m.ok ? "text-green-600" : "text-amber-600"}`}>
                  {m.ok ? <Check size={10}/> : <AlertTriangle size={10}/>}{m.benchmark}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Critical Semiconductor Discipline Coverage</h3>
            <div className="space-y-2">
              {["IC Design", "Verification", "Physical Design", "Test Engineering", "Product Engineering", "Applications", "Field Applications", "Process Engineering", "Quality & Reliability"].map(dept => {
                const count = activeEmployees.filter(e => e.taxo === dept).length;
                const pct = (count / activeEmployees.length * 100).toFixed(1);
                const minRequired = dept === "IC Design" || dept === "Verification" ? 15 : 5;
                return (
                  <div key={dept} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
                    onClick={() => navigateToDept(dept)}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: DEPT_COLORS[dept] }}/>
                    <div className="w-40 text-xs text-gray-700 truncate">{dept}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct * 3, 100)}%`, background: count >= minRequired ? DEPT_COLORS[dept] : "#ef4444" }}/>
                    </div>
                    <div className="w-16 text-right text-xs font-bold text-gray-700">{count} ({pct}%)</div>
                    {count < minRequired && <AlertTriangle size={12} className="text-amber-500 shrink-0"/>}
                    <ArrowRight size={10} className="text-gray-300 shrink-0"/>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Seniority Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={levelData} layout="vertical" margin={{ left: 60 }}>
                <XAxis type="number" tick={{ fontSize: 10 }}/>
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }}/>
                <Tooltip contentStyle={{ fontSize: 11 }}/>
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {dashTab === "managers" && (
        <div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 mb-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Span of Control Distribution <span className="text-gray-400 font-normal text-xs ml-1">· click to see managers</span></h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={spanData} style={{ cursor: "pointer" }}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 10 }}/>
                <Tooltip contentStyle={{ fontSize: 11 }}/>
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} onClick={(data) => {
                  const range = data.range;
                  const mgr = managers.find(m => {
                    const d = tree.map[m.id]._directReports;
                    if (range === "1-3") return d <= 3;
                    if (range === "4-7") return d >= 4 && d <= 7;
                    if (range === "8-10") return d >= 8 && d <= 10;
                    return d > 10;
                  });
                  if (mgr) { navigateTo(mgr.id); setView("org-chart"); }
                }}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <h3 className="text-sm font-bold text-gray-700 p-4 pb-2">All Managers (sorted by reports)</h3>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr><th className="text-left p-2 font-medium text-gray-500">Manager</th><th className="text-left p-2 font-medium text-gray-500">Dept</th><th className="p-2 font-medium text-gray-500 text-right">Direct</th><th className="p-2 font-medium text-gray-500 text-right">Total</th><th className="p-2 font-medium text-gray-500 text-right">Status</th></tr>
                </thead>
                <tbody>
                  {managers.sort((a, b) => tree.map[b.id]._directReports - tree.map[a.id]._directReports).map(m => {
                    const dr = tree.map[m.id]._directReports;
                    return (
                      <tr key={m.id} className="border-t border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => navigateTo(m.id)}>
                        <td className="p-2 font-medium text-gray-800">{m.first} {m.last}</td>
                        <td className="p-2 text-gray-500">{m.dept}</td>
                        <td className="p-2 text-right font-bold">{dr}</td>
                        <td className="p-2 text-right text-gray-500">{tree.map[m.id]._totalReports}</td>
                        <td className="p-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${dr > 10 ? "bg-red-100 text-red-700" : dr > 7 ? "bg-amber-100 text-amber-700" : dr < 3 ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                            {dr > 10 ? "Overloaded" : dr > 7 ? "Heavy" : dr < 3 ? "Light" : "Healthy"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {dashTab === "hotspots" && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { severity: "critical", label: "Critical", color: "#ef4444", count: hotspots.filter(h => h.severity === "critical").length },
              { severity: "warning", label: "Warning", color: "#f59e0b", count: hotspots.filter(h => h.severity === "warning").length },
              { severity: "info", label: "Info", color: "#3b82f6", count: hotspots.filter(h => h.severity === "info").length },
            ].map(s => (
              <div key={s.severity} className="bg-white rounded-xl p-4 border border-gray-100 text-center">
                <div className="text-3xl font-black" style={{ color: s.color }}>{s.count}</div>
                <div className="text-xs text-gray-400">{s.label} Issues</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto">
              {hotspots.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No hotspots detected — org looks healthy!</div>
              ) : (
                hotspots.map((h, i) => (
                  <div key={i} onClick={() => { navigateTo(h.nodeId); setView("org-chart"); }} className={`p-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors flex items-start gap-3 ${h.severity === "critical" ? "border-l-4 border-l-red-500" : h.severity === "warning" ? "border-l-4 border-l-amber-400" : "border-l-4 border-l-blue-400"}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${h.severity === "critical" ? "bg-red-100" : h.severity === "warning" ? "bg-amber-100" : "bg-blue-100"}`}>
                      <AlertTriangle size={12} className={h.severity === "critical" ? "text-red-600" : h.severity === "warning" ? "text-amber-600" : "text-blue-600"}/>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-800">{h.msg}</div>
                      <div className="text-xs text-gray-400 mt-0.5 capitalize">{h.type.replace("-", " ")} · {h.severity}</div>
                    </div>
                    <ArrowRight size={12} className="text-gray-300 ml-auto shrink-0 mt-1"/>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {dashTab === "coverage" && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Headcount by product line × semiconductor discipline. Red = below minimum viable coverage.</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-semibold bg-gray-50 border-b border-gray-100 sticky left-0 z-10 min-w-28">BU</th>
                  {COV_ROLES.map(r => (
                    <th key={r} className="px-2 py-2 text-gray-500 font-semibold bg-gray-50 border-b border-gray-100 text-center min-w-20 whitespace-nowrap" style={{ fontSize: 10 }}>
                      <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 80 }}>{r}</div>
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 text-gray-500 font-semibold bg-gray-50 border-b border-gray-100 min-w-14">Total</th>
                </tr>
              </thead>
              <tbody>
                {coverageData.map((row) => {
                  const total = COV_ROLES.reduce((s, r) => s + row[r], 0);
                  return (
                    <tr key={row.bg} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 font-semibold sticky left-0 bg-white" style={{ color: BG_COLORS[row.bg] }}>
                        {row.bg.replace(" BU","")}
                      </td>
                      {COV_ROLES.map(role => {
                        const count = row[role];
                        const min   = COV_MIN[role] || 3;
                        const pct   = Math.min(1, count / min);
                        const isCrit = count < min * 0.5;
                        const isWarn = count < min && !isCrit;
                        const bg    = isCrit ? "#fef2f2" : isWarn ? "#fffbeb" : count === 0 ? "#f8fafc" : `rgba(37,99,235,${0.05 + pct * 0.25})`;
                        const txt   = isCrit ? "#dc2626" : isWarn ? "#d97706" : count === 0 ? "#cbd5e1" : "#1e40af";
                        return (
                          <td key={role} className="text-center px-2 py-2 font-bold transition-colors cursor-pointer hover:opacity-75"
                            style={{ background: bg, color: txt }}
                            onClick={() => navigateToDept(role)}
                            title={`View ${role} in ${row.bg}`}>
                            {count === 0 ? "—" : count}
                            {isCrit && <span className="ml-0.5" style={{ fontSize: 8 }}>▼</span>}
                          </td>
                        );
                      })}
                      <td className="text-center px-3 py-2 font-bold text-gray-700">{total}</td>
                    </tr>
                  );
                })}
                {/* Minimum row */}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-3 py-2 text-xs font-semibold text-gray-500 sticky left-0 bg-gray-50">Min. viable</td>
                  {COV_ROLES.map(r => (
                    <td key={r} className="text-center px-2 py-2 text-xs text-gray-400 font-medium">{COV_MIN[r]}</td>
                  ))}
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}/> Critical (&lt;50% of min)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}/> Warning (&lt;min)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded" style={{ background: "rgba(37,99,235,0.2)", border: "1px solid #bfdbfe" }}/> Sufficient</span>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── HEADCOUNT PLANNING VIEW ───
// Tabs: Mix · Pyramid · Timeline · Early-Career Program. Plan state is lifted
// to AppCtx so the org chart toggle ("show planned headcount") sees the same
// data. Internal levels still use IC1..C-Suite; the planner works in display
// levels (L1-L7 / M1-M4 / E1-E3) so the user only sees the new label set.
function HeadcountPlanningView() {
  const {
    activeEmployees, locations,
    plan, setPlan, planGroupBy: groupBy, setPlanGroupBy: setGroupBy,
    planStartYear, setPlanStartYear, planHorizonQ, setPlanHorizonQ,
    planLocFilter, setPlanLocFilter, planEmployees,
    // Lifted state (shared with org chart ghost nodes)
    earlyTargetPct, setEarlyTargetPct,
    earlyMode, setEarlyMode,
    hireMixPct, setHireMixPct,
    internRatio, setInternRatio,
    annualExpHiresOverride, setAnnualExpHiresOverride,
    reqIncludeECCalc, setReqIncludeECCalc,
    projects, setProjects,
    reqOverrides, setReqOverrides, overrideReq, resetOverrides,
    customReqs, setCustomReqs,
    // 3-year attrition + growth model
    attritionPct, setAttritionPct,
    growthTarget3Yr, setGrowthTarget3Yr,
    growthShiftPerYear, setGrowthShiftPerYear,
    promoPctPerYear, setPromoPctPerYear,
    acquisitionsPerYear, setAcquisitionsPerYear,
    growthModel, levelHistogram,
    // Lifted derivations
    planGroupKey: groupKey, planGroupLabel: groupLabel, planGroups: groups,
    planCurrent: current, planProjected: projected,
    planRollups, planSumPlan: sumPlan, planHorizon: horizon, planYears,
    plannedHires, defaultAnnualExpHires, annualExpHires,
    earlyByGroup, earlyCalc, earlyAllocByGroup,
    planManagersByGroup: managersByGroup,
    chartReqs,
  } = useContext(AppCtx);

  const { cur: curRoll, prj: projRoll, orgTotalCur, orgTotalProj, orgEarlyCur, orgEarlyProj } = planRollups;

  const [tab, setTab] = useState("mix"); // "mix" | "pyramid" | "timeline" | "plan" | "early" | "reqs"

  const setDelta = (g, lv, val) => {
    const n = parseInt(val, 10);
    setPlan(p => ({ ...p, [g]: { ...(p[g] || {}), [lv]: Number.isFinite(n) ? n : 0 } }));
  };
  const bumpDelta = (g, lv, by) => {
    setPlan(p => ({ ...p, [g]: { ...(p[g] || {}), [lv]: (p[g]?.[lv] || 0) + by } }));
  };
  const clearPlan = () => setPlan({});

  const [editGroup, setEditGroup] = useState(null);

  // ── Distribute target across groups ──
  const [distributeTotal, setDistributeTotal] = useState(growthTarget3Yr);
  const [distributeMode, setDistributeMode] = useState("proportional"); // "proportional" | "even"
  const [distributeLevelMode, setDistributeLevelMode] = useState("histogram"); // "histogram" | "l3only"

  const displayLevelHistogram = useMemo(() => {
    const h = {};
    ALL_DISPLAY_LEVELS.forEach(lv => { h[lv] = 0; });
    planEmployees.forEach(e => { const dl = displayLevel(e.level); if (h[dl] !== undefined) h[dl] += 1; });
    return h;
  }, [planEmployees]);

  const distributePreview = useMemo(() => {
    if (!distributeTotal || !groups.length) return [];
    const weights = distributeMode === "even"
      ? groups.map(() => 1)
      : groups.map(g => curRoll[g]?.total || 0);
    const sumW = weights.reduce((s, w) => s + w, 0);
    if (!sumW) return [];
    const sign = distributeTotal < 0 ? -1 : 1;
    const alloc = largestRemainderAlloc(Math.abs(distributeTotal), weights);
    return groups.map((g, i) => ({ group: g, delta: sign * alloc[i] })).filter(p => p.delta !== 0);
  }, [distributeTotal, distributeMode, groups, curRoll]);

  const applyDistributeTarget = useCallback(() => {
    const newPlan = {};
    distributePreview.forEach(({ group, delta }) => {
      newPlan[group] = newPlan[group] || {};
      if (distributeLevelMode === "l3only") {
        newPlan[group].L3 = (newPlan[group].L3 || 0) + delta;
        return;
      }
      const lvKeys = ALL_DISPLAY_LEVELS.filter(k => (displayLevelHistogram[k] || 0) > 0);
      const lvWeights = lvKeys.map(k => displayLevelHistogram[k]);
      if (!lvWeights.length) {
        newPlan[group].L3 = (newPlan[group].L3 || 0) + delta;
        return;
      }
      const sign = delta < 0 ? -1 : 1;
      const lvAlloc = largestRemainderAlloc(Math.abs(delta), lvWeights);
      lvKeys.forEach((k, i) => {
        if (lvAlloc[i]) newPlan[group][k] = (newPlan[group][k] || 0) + sign * lvAlloc[i];
      });
    });
    setPlan(newPlan);
  }, [distributePreview, distributeLevelMode, displayLevelHistogram, setPlan]);

  // Chart data: top groups by current size, with current vs projected early%
  const chartData = useMemo(() => {
    return groups
      .slice()
      .sort((a, b) => (curRoll[b]?.total || 0) - (curRoll[a]?.total || 0))
      .slice(0, 12)
      .map(g => ({
        name: g,
        currentEarlyPct: curRoll[g]?.total ? Math.round(100 * curRoll[g].early / curRoll[g].total) : 0,
        projectedEarlyPct: projRoll[g]?.total ? Math.round(100 * projRoll[g].early / projRoll[g].total) : 0,
      }));
  }, [groups, curRoll, projRoll]);

  const earlyPct = (n, t) => t ? `${Math.round(100 * n / t)}%` : "—";

  // ── Pyramid data: org-wide level counts (current + projected) ──
  const pyramidData = useMemo(() => {
    const cur = {}; ALL_DISPLAY_LEVELS.forEach(lv => { cur[lv] = 0; });
    Object.values(current).forEach(byLv => ALL_DISPLAY_LEVELS.forEach(lv => { cur[lv] += byLv[lv] || 0; }));
    const prj = {}; ALL_DISPLAY_LEVELS.forEach(lv => { prj[lv] = 0; });
    Object.values(projected).forEach(byLv => ALL_DISPLAY_LEVELS.forEach(lv => { prj[lv] += byLv[lv] || 0; }));
    // Pyramid order: top of org first (E3 down to L1)
    return [...ALL_DISPLAY_LEVELS].reverse().map(lv => ({
      level: lv, current: cur[lv], projected: prj[lv], delta: prj[lv] - cur[lv],
      tier: levelTier(lv), early: EARLY_DISPLAY_LEVELS.has(lv),
    }));
  }, [current, projected]);

  // ── Timeline: distribute each plan delta evenly across the planning quarters ──
  const timelineRows = useMemo(() => {
    // Each plan cell becomes one row spread across `planHorizonQ` quarters.
    const rows = [];
    Object.entries(plan).forEach(([g, byLv]) => {
      Object.entries(byLv).forEach(([lv, delta]) => {
        if (!delta) return;
        const sign = delta > 0 ? 1 : -1;
        const total = Math.abs(delta);
        // Even distribution with remainder front-loaded to early quarters
        const base = Math.floor(total / planHorizonQ);
        const rem  = total - base * planHorizonQ;
        const cells = horizon.map((h, i) => sign * (base + (i < rem ? 1 : 0)));
        rows.push({ group: g, level: lv, delta, cells });
      });
    });
    return rows.sort((a, b) => a.group.localeCompare(b.group) || ALL_DISPLAY_LEVELS.indexOf(a.level) - ALL_DISPLAY_LEVELS.indexOf(b.level));
  }, [plan, horizon, planHorizonQ]);

  const timelineByQuarter = useMemo(() => {
    return horizon.map((h, i) => {
      let hires = 0, departures = 0, early = 0;
      timelineRows.forEach(r => {
        const v = r.cells[i] || 0;
        if (v > 0) { hires += v; if (EARLY_DISPLAY_LEVELS.has(r.level)) early += v; }
        else if (v < 0) departures += -v;
      });
      return { ...h, hires, departures, net: hires - departures, early };
    });
  }, [timelineRows, horizon]);

  // Cumulative HC over the horizon
  const cumulativeTrend = useMemo(() => {
    let runningTotal = orgTotalCur;
    let runningEarly = orgEarlyCur;
    const start = [{ key: "Now", year: "Now", q: "", total: runningTotal, early: runningEarly, earlyPct: orgTotalCur ? Math.round(100*orgEarlyCur/orgTotalCur) : 0 }];
    return start.concat(timelineByQuarter.map(t => {
      runningTotal += t.net;
      runningEarly += t.early;
      return { key: t.key, year: t.year, q: t.q, total: runningTotal, early: runningEarly, earlyPct: runningTotal ? Math.round(100*runningEarly/runningTotal) : 0 };
    }));
  }, [timelineByQuarter, orgTotalCur, orgEarlyCur]);

  // ── Early-Career Program inputs + derivations come from AppCtx ──
  // (state lifted to OrgChartApp so the org chart and planner stay in sync)
  // earlyTargetPct/Mode, hireMixPct, internRatio, annualExpHiresOverride,
  // earlyByGroup, earlyCalc, earlyAllocByGroup, managersByGroup, planYears,
  // plannedHires, defaultAnnualExpHires, annualExpHires — all from ctx.

  // ── Open requisitions: chartReqs come from AppCtx (same list shown on org chart) ──
  const [reqStatusFilter, setReqStatusFilter] = useState("All");
  const [reqLevelFilter, setReqLevelFilter] = useState("All");
  const REQ_STATUSES = ["Open", "Sourcing", "Interviewing", "Offer", "Filled"];

  function exportReqsCSV() {
    const cols = ["id","status","projectId","group","level","tier","isEC","title","location","country","employmentType","openDate","targetStart","quarter","hiringManager","hiringManagerId","salaryBand","source"];
    const rows = [cols.join(",")];
    filteredReqsFinal.forEach(r => {
      rows.push(cols.map(c => {
        if (c === "tier") return csvCell(levelTier(r.level));
        if (c === "group") return csvCell(r.group);
        return csvCell(r[c]);
      }).join(","));
    });
    const stamp = new Date().toISOString().slice(0,10);
    downloadFile(`open-reqs-${stamp}.csv`, rows.join("\n"), "text/csv;charset=utf-8");
  }

  function exportPlanJSON() {
    const payload = {
      meta: { exportedAt: new Date().toISOString(), planStartYear, planHorizonQ, groupBy, mode: "headcount-plan-v2" },
      plan,
      earlyCareer: {
        mode: earlyMode,
        targetOrgPct: earlyTargetPct,
        targetHirePct: hireMixPct,
        annualExpHires,
        internRatio,
        result: earlyCalc,
        allocation: earlyAllocByGroup,
      },
      growthModel: {
        attritionPct,
        growthTarget3Yr,
        growthShiftPerYear,
        promoPctPerYear,
        acquisitionsPerYear,
        result: growthModel,
      },
      projects,
      reqOverrides,
      customReqs,
      requisitions: chartReqs,
    };
    const stamp = new Date().toISOString().slice(0,10);
    downloadFile(`headcount-plan-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  // Filter the (already-overridden) chartReqs by status/level for display.
  const filteredReqsFinal = useMemo(() => chartReqs.filter(r =>
    (reqStatusFilter === "All" || r.status === reqStatusFilter) &&
    (reqLevelFilter === "All" || r.level === reqLevelFilter)
  ), [chartReqs, reqStatusFilter, reqLevelFilter]);

  // Per-project staffing fit
  const projectFit = useMemo(() => {
    return projects.map(p => {
      const myReqs = chartReqs.filter(r => r.projectId === p.id);
      const targetTotal = Object.values(p.targetMix).reduce((s,v) => s+v, 0);
      // Per-level coverage from reqs
      const reqByLevel = {};
      myReqs.forEach(r => { reqByLevel[r.level] = (reqByLevel[r.level] || 0) + 1; });
      const perLevel = ALL_DISPLAY_LEVELS.map(lv => ({
        level: lv,
        target: p.targetMix[lv] || 0,
        reqs: reqByLevel[lv] || 0,
      })).filter(x => x.target > 0 || x.reqs > 0);
      // Fit = (matched coverage) / target. Over-fill doesn't help; under-fill hurts.
      const matched = perLevel.reduce((s,x) => s + Math.min(x.target, x.reqs), 0);
      const overfill = perLevel.reduce((s,x) => s + Math.max(0, x.reqs - x.target), 0);
      const fitPct = targetTotal ? Math.round(100 * matched / targetTotal) : 0;
      // Site fit: % of reqs in preferred sites
      const inPref = myReqs.filter(r => p.preferredSites.includes(r.location)).length;
      const sitePct = myReqs.length ? Math.round(100 * inPref / myReqs.length) : 0;
      // EC mix on this project
      const ecCount = myReqs.filter(r => r.isEC).length;
      const ecPct = myReqs.length ? Math.round(100 * ecCount / myReqs.length) : 0;
      // Site distribution
      const siteDist = {};
      myReqs.forEach(r => { siteDist[r.location] = (siteDist[r.location] || 0) + 1; });
      return {
        ...p,
        reqs: myReqs,
        targetTotal,
        reqTotal: myReqs.length,
        perLevel,
        matched, overfill, fitPct,
        sitePct, inPref,
        ecCount, ecPct,
        siteDist,
      };
    });
  }, [projects, chartReqs]);

  // Bulk site rebalance: redistribute reqs at level X from over-staffed site → preferred site
  const suggestRebalance = (projectId) => {
    const p = projectFit.find(x => x.id === projectId);
    if (!p || !p.preferredSites.length) return [];
    return p.reqs
      .filter(r => !p.preferredSites.includes(r.location))
      .map(r => ({ id: r.id, from: r.location, to: p.preferredSites[0] }));
  };

  function importPlanJSON(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data?.plan && typeof data.plan === "object") setPlan(data.plan);
        if (Number.isInteger(data?.meta?.planStartYear)) setPlanStartYear(data.meta.planStartYear);
        if (Number.isInteger(data?.meta?.planHorizonQ)) setPlanHorizonQ(data.meta.planHorizonQ);
        if (data?.earlyCareer) {
          const ec = data.earlyCareer;
          if (ec.mode === "orgMix" || ec.mode === "hireMix") setEarlyMode(ec.mode);
          if (Number.isFinite(ec.targetOrgPct))  setEarlyTargetPct(ec.targetOrgPct);
          if (Number.isFinite(ec.targetHirePct)) setHireMixPct(ec.targetHirePct);
          if (Number.isFinite(ec.annualExpHires)) setAnnualExpHiresOverride(ec.annualExpHires);
          if (Number.isFinite(ec.internRatio))   setInternRatio(ec.internRatio);
        }
        if (Array.isArray(data?.projects)) setProjects(data.projects);
        if (data?.reqOverrides && typeof data.reqOverrides === "object") setReqOverrides(data.reqOverrides);
        if (Array.isArray(data?.customReqs)) setCustomReqs(data.customReqs);
        if (data?.growthModel) {
          const gm = data.growthModel;
          if (Number.isFinite(gm.attritionPct))    setAttritionPct(gm.attritionPct);
          if (Number.isFinite(gm.growthTarget3Yr)) setGrowthTarget3Yr(gm.growthTarget3Yr);
          if (Array.isArray(gm.growthShiftPerYear) && gm.growthShiftPerYear.length === 3)
            setGrowthShiftPerYear(gm.growthShiftPerYear.map(n => Math.max(0, Number(n) || 0)));
          if (Number.isFinite(gm.promoPctPerYear)) setPromoPctPerYear(gm.promoPctPerYear);
          if (Array.isArray(gm.acquisitionsPerYear) && gm.acquisitionsPerYear.length === 3)
            setAcquisitionsPerYear(gm.acquisitionsPerYear.map(a => ({
              count: Math.max(0, Number(a?.count) || 0),
              ecPct: Math.max(0, Math.min(100, Number(a?.ecPct) || 0)),
            })));
        }
      } catch (err) { alert("Could not parse JSON: " + err.message); }
    };
    reader.readAsText(file);
  }

  // RFC-4180 CSV parser — handles quoted fields with embedded commas, newlines, and "" escapes.
  // Import a hiring plan from a CSV exported (or saved-as-CSV) from Excel.
  // Accepts two layouts:
  //   Long:  group,level,delta            — one delta per row
  //   Wide:  group,L1,L2,L3,...,E3        — one row per group, columns are display levels
  // Replaces the current plan. Numbers are clamped to [-9999, 9999] per cell to avoid runaway recompute.
  function importPlanCSV(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseCSV(String(ev.target.result || ""));
        if (rows.length < 2) throw new Error("File has no data rows");
        const header = rows[0].map(c => c.trim());
        const headerLc = header.map(c => c.toLowerCase());
        const groupIdx = headerLc.findIndex(c => c === "group" || c === "department" || c === "dept" || c === "business unit" || c === "business group" || c === "bu" || c === "bg");
        if (groupIdx < 0) throw new Error("Header must include a 'group' (or 'department' / 'bg') column");
        const validLevels = new Set(ALL_DISPLAY_LEVELS);
        const clamp = n => Math.max(-9999, Math.min(9999, Math.trunc(n)));

        // Detect long vs wide form
        const levelIdx = headerLc.findIndex(c => c === "level");
        const deltaIdx = headerLc.findIndex(c => c === "delta" || c === "hires" || c === "count" || c === "headcount");
        const isLong = levelIdx >= 0 && deltaIdx >= 0;

        // Wide form: collect each header column whose name matches a known display level
        const wideLevelCols = isLong ? [] : header
          .map((h, i) => ({ lv: h.trim().toUpperCase(), i }))
          .filter(({ lv, i }) => i !== groupIdx && validLevels.has(lv));
        if (!isLong && wideLevelCols.length === 0)
          throw new Error("Wide-form CSV needs columns named after levels (L1, L2, …, E3) or use long form: group,level,delta");

        const newPlan = {};
        let imported = 0, skipped = 0;
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const group = (row[groupIdx] || "").trim();
          if (!group) { skipped++; continue; }
          if (isLong) {
            const lv = (row[levelIdx] || "").trim().toUpperCase();
            const n = parseInt(row[deltaIdx], 10);
            if (!validLevels.has(lv) || !Number.isFinite(n) || n === 0) { skipped++; continue; }
            newPlan[group] = newPlan[group] || {};
            newPlan[group][lv] = clamp((newPlan[group][lv] || 0) + n);
            imported++;
          } else {
            wideLevelCols.forEach(({ lv, i }) => {
              const n = parseInt(row[i], 10);
              if (!Number.isFinite(n) || n === 0) return;
              newPlan[group] = newPlan[group] || {};
              newPlan[group][lv] = clamp((newPlan[group][lv] || 0) + n);
              imported++;
            });
          }
        }
        if (imported === 0) throw new Error(`No usable rows found (skipped ${skipped})`);
        setPlan(newPlan);
        alert(`Imported ${imported} plan entr${imported === 1 ? "y" : "ies"} across ${Object.keys(newPlan).length} group${Object.keys(newPlan).length === 1 ? "" : "s"}.${skipped ? ` Skipped ${skipped} blank/invalid row${skipped === 1 ? "" : "s"}.` : ""}`);
      } catch (err) { alert("Could not parse CSV: " + err.message); }
    };
    reader.readAsText(file);
  }

  // Generic CSV builder — delegates per-cell escaping to module-level csvCell()
  function arrToCSV(rows, cols) {
    const out = [cols.join(",")];
    rows.forEach(r => out.push(cols.map(c => csvCell(r[c])).join(",")));
    return out.join("\n");
  }

  function exportEmployeesCSV() {
    const cols = ["id","first","last","title","level","dept","fn","bg","location","country","employmentType","managerId","isManager","tenureYears"];
    const stamp = new Date().toISOString().slice(0,10);
    downloadFile(`employees-${stamp}.csv`, arrToCSV(activeEmployees, cols), "text/csv;charset=utf-8");
  }

  function exportProjectsCSV() {
    const cols = ["id","name","owningGroup","preferredSites","critical","targetMix","notes"];
    const flat = projects.map(p => ({
      ...p,
      preferredSites: p.preferredSites.join("|"),
      targetMix: Object.entries(p.targetMix).map(([k,v]) => `${k}:${v}`).join("|"),
    }));
    const stamp = new Date().toISOString().slice(0,10);
    downloadFile(`projects-${stamp}.csv`, arrToCSV(flat, cols), "text/csv;charset=utf-8");
  }

  return (
    <div className="p-6 h-full overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Headcount Planning<Help text="Plan future headcount per group and level. Set 3-year targets in the grid, or use Distribute to spread a single top-down number across groups and levels, then read off the hires and attrition backfills it implies." side="bottom" width={300} /></h2>
          <div className="text-xs text-gray-500 mt-0.5">
            Early career = <span className="font-semibold text-emerald-700">L1–L2</span> · Experienced = everyone else (L3–L7, M1–M4, E1–E3)
            {planLocFilter.size > 0 && (
              <span className="ml-2 text-blue-700">
                · planning <span className="font-semibold">{planEmployees.length}</span> of {activeEmployees.length} employees in {planLocFilter.size} site{planLocFilter.size > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Group by:</span>
          {[["dept","Dept"],["bg","BU"],["fn","Discipline"]].map(([k,l]) => (
            <button key={k} onClick={() => setGroupBy(k)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${groupBy === k ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {l}
            </button>
          ))}
          <button onClick={clearPlan} disabled={!Object.keys(plan).length}
            className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed">
            Clear plan
          </button>
        </div>
      </div>

      {/* Location filter — empty selection means "all locations". */}
      <div className="flex items-center gap-2 mb-3 flex-wrap bg-white rounded-xl border border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold text-gray-600">Location filter:</span>
        <button
          onClick={() => setPlanLocFilter(new Set())}
          className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${planLocFilter.size === 0 ? "bg-blue-600 text-white font-semibold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          All sites
        </button>
        {locations.map(loc => {
          const on = planLocFilter.has(loc);
          return (
            <button key={loc}
              onClick={() => setPlanLocFilter(prev => {
                const next = new Set(prev);
                if (next.has(loc)) next.delete(loc); else next.add(loc);
                return next;
              })}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${on ? "bg-blue-600 text-white font-semibold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {loc}
            </button>
          );
        })}
        {planLocFilter.size > 0 && (
          <button
            onClick={() => setPlanLocFilter(new Set())}
            className="ml-auto text-[11px] text-gray-500 hover:text-gray-700 underline">
            clear
          </button>
        )}
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 mb-4 border-b border-gray-100 pb-2 items-center">
        {[
          { id: "mix",      label: "Mix",                  icon: BarChart3,   help: "Per-group current vs projected headcount, early-career vs experienced split, and the bulk distribute panel." },
          { id: "pyramid",  label: "Pyramid by Level",     icon: Layers,      help: "Stacked bars of headcount by IC/manager/exec level, current vs projected. Spot top-heavy or bottom-heavy shapes." },
          { id: "timeline", label: "Timeline",             icon: Clock,       help: "Quarterly hire ramp under your plan. Adjust planHorizonQ to lengthen or shorten the rollout." },
          { id: "plan",     label: "Headcount Plan",       icon: Target,      help: "The raw editable grid: type a delta into any (group, level) cell. This is where Apply distribution writes to." },
          { id: "early",    label: "Early-Career Program", icon: TrendingUp,  help: "Tune the early-career hire % and intern↔NCG ratio. Drives how many of your hires come from new grads." },
          { id: "reqs",     label: "Open Reqs",            icon: Flag,        help: "Auto-generated requisitions implied by your plan, attributed to hiring managers. Export to feed your ATS." },
        ].map(t => (
          <div key={t.id} className="flex items-center">
            <button onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${tab === t.id ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              <t.icon size={12}/>{t.label}
            </button>
            <Help text={t.help} side="bottom" />
          </div>
        ))}
      </div>

      {tab === "mix" && <>
      {/* Org-wide KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Current HC",          val: orgTotalCur,  sub: `${earlyPct(orgEarlyCur, orgTotalCur)} early career`, color: "#2563eb" },
          { label: "Planned hires",       val: `+${sumPlan.hires}`,      sub: "additions across groups",      color: "#16a34a" },
          { label: "Planned departures",  val: `−${sumPlan.departures}`, sub: "reductions across groups",     color: "#dc2626" },
          { label: "Projected HC",        val: orgTotalProj, sub: `${earlyPct(orgEarlyProj, orgTotalProj)} early career`, color: "#7c3aed" },
        ].map((k, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div className="text-xs text-gray-400 mb-1">{k.label}</div>
            <div className="text-2xl font-black" style={{ color: k.color }}>{k.val}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Distribute target across groups ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <h3 className="text-sm font-bold text-gray-700 flex items-center">
            Distribute target across {groupLabel.toLowerCase()}s
            <Help text={`A bulk-edit shortcut: type a single headcount number (positive = hire, negative = cut), pick how to split it, then "Apply distribution" writes the per-group/per-level deltas into your plan. Use this to seed a plan from a top-down target instead of typing each cell by hand. Reset clears the plan back to zero.`} side="bottom" />
          </h3>
          <span className="text-xs text-gray-400">Spread an overall headcount target across all {groupLabel.toLowerCase()}s, then refine in the table below.</span>
        </div>
        <div className="grid grid-cols-12 gap-3 items-end">
          {/* Total target */}
          <div className="col-span-3">
            <div className="text-[11px] font-semibold text-gray-600 mb-1 flex items-center">
              Total HC to add
              <Help text={`The single number you want to spread. Positive = net hires; negative = net cuts. Click "= +N" to seed it from your 3yr growth target on the Headcount Plan tab.`} />
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="-9999" value={distributeTotal}
                onChange={e => setDistributeTotal(parseInt(e.target.value || "0", 10))}
                className="w-full text-right text-sm font-bold text-blue-700 tabular-nums border border-gray-200 rounded px-2 py-1"/>
              <button onClick={() => setDistributeTotal(growthTarget3Yr)}
                title="Match the 3yr growth target on the Headcount Plan tab"
                className="text-[10px] px-1.5 py-1 rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 whitespace-nowrap">
                = +{growthTarget3Yr}
              </button>
            </div>
          </div>

          {/* Group split mode */}
          <div className="col-span-3">
            <div className="text-[11px] font-semibold text-gray-600 mb-1 flex items-center">
              Spread across {groupLabel.toLowerCase()}s by
              <Help text={`How the total headcount delta is divided across ${groupLabel.toLowerCase()}s. "Current size" = bigger groups absorb more hires, proportional to today's headcount. "Even" = each group gets roughly the same delta regardless of size.`} />
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setDistributeMode("proportional")}
                className={`flex-1 text-xs px-2 py-1 rounded-md transition-colors ${distributeMode === "proportional" ? "bg-white text-blue-700 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Current size
              </button>
              <button onClick={() => setDistributeMode("even")}
                className={`flex-1 text-xs px-2 py-1 rounded-md transition-colors ${distributeMode === "even" ? "bg-white text-blue-700 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Even
              </button>
            </div>
          </div>

          {/* Level split mode */}
          <div className="col-span-3">
            <div className="text-[11px] font-semibold text-gray-600 mb-1 flex items-center">
              Level mix
              <Help text={`Once each group has its hire count, this decides how those hires split across IC/manager/exec levels. "Match org" = mirror today's level pyramid (L1/L2/L3/...) so the shape stays the same. "L3 only" = drop every hire at L3 (the typical mid-career IC level — assumes senior ranks fill via promotion, not external hires).`} />
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setDistributeLevelMode("histogram")}
                title="Spread across levels in the same proportions as the current org"
                className={`flex-1 text-xs px-2 py-1 rounded-md transition-colors ${distributeLevelMode === "histogram" ? "bg-white text-emerald-700 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Match org
              </button>
              <button onClick={() => setDistributeLevelMode("l3only")}
                title="All hires bucket to L3 (default growth level)"
                className={`flex-1 text-xs px-2 py-1 rounded-md transition-colors ${distributeLevelMode === "l3only" ? "bg-white text-emerald-700 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                L3 only
              </button>
            </div>
          </div>

          {/* Apply */}
          <div className="col-span-3 flex items-center justify-end gap-2">
            <button onClick={() => setPlan({})}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
              Reset
            </button>
            <button onClick={applyDistributeTarget}
              disabled={!distributeTotal || !groups.length}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              Apply distribution →
            </button>
          </div>
        </div>

        {/* Live preview */}
        {distributePreview.length > 0 && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="text-[11px] font-semibold text-gray-500 mb-1.5">Preview · {distributeTotal > 0 ? "+" : ""}{distributeTotal} across {distributePreview.length} {groupLabel.toLowerCase()}s</div>
            <div className="flex flex-wrap gap-1.5">
              {distributePreview.slice(0, 16).map(p => (
                <span key={p.group} className={`text-[11px] px-2 py-0.5 rounded ${p.delta >= 0 ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
                  <span className="font-semibold">{p.group}</span>
                  <span className="ml-1 tabular-nums">{p.delta >= 0 ? "+" : ""}{p.delta}</span>
                </span>
              ))}
              {distributePreview.length > 16 && <span className="text-[11px] text-gray-400">… and {distributePreview.length - 16} more</span>}
            </div>
          </div>
        )}
      </div>

      {/* Per-group mix table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-5">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">Current vs Projected Mix by {groupLabel}</h3>
          <span className="text-xs text-gray-400">Click a row to edit its plan</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">{groupLabel}</th>
                <th className="text-right px-3 py-2 font-medium">Current</th>
                <th className="text-right px-3 py-2 font-medium">Early</th>
                <th className="text-right px-3 py-2 font-medium">Exp.</th>
                <th className="text-right px-3 py-2 font-medium">Early %</th>
                <th className="px-3 py-2 font-medium border-l border-gray-200">Δ</th>
                <th className="text-right px-3 py-2 font-medium">Projected</th>
                <th className="text-right px-3 py-2 font-medium">Early</th>
                <th className="text-right px-3 py-2 font-medium">Exp.</th>
                <th className="text-right px-3 py-2 font-medium">Early %</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => {
                const c = curRoll[g], p = projRoll[g];
                const delta = p.total - c.total;
                const isEditing = editGroup === g;
                return (
                  <React.Fragment key={g}>
                    <tr className={`border-t border-gray-100 cursor-pointer transition-colors ${isEditing ? "bg-blue-50" : "hover:bg-gray-50"}`}
                        onClick={() => setEditGroup(isEditing ? null : g)}>
                      <td className="px-4 py-2 font-medium text-gray-800">
                        <span className="inline-flex items-center gap-1.5">
                          {isEditing ? <ChevronDown size={11} className="text-blue-600"/> : <ChevronRight size={11} className="text-gray-400"/>}
                          {g}
                        </span>
                      </td>
                      <td className="text-right px-3 py-2 text-gray-700">{c.total}</td>
                      <td className="text-right px-3 py-2 text-emerald-700">{c.early}</td>
                      <td className="text-right px-3 py-2 text-gray-600">{c.exp}</td>
                      <td className="text-right px-3 py-2 font-semibold text-gray-700">{earlyPct(c.early, c.total)}</td>
                      <td className={`text-center px-3 py-2 font-bold border-l border-gray-200 ${delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-gray-300"}`}>
                        {delta > 0 ? `+${delta}` : delta || "—"}
                      </td>
                      <td className="text-right px-3 py-2 text-gray-700">{p.total}</td>
                      <td className="text-right px-3 py-2 text-emerald-700">{p.early}</td>
                      <td className="text-right px-3 py-2 text-gray-600">{p.exp}</td>
                      <td className={`text-right px-3 py-2 font-semibold ${p.total && Math.round(100*p.early/p.total) !== Math.round(100*c.early/(c.total||1)) ? "text-violet-700" : "text-gray-700"}`}>
                        {earlyPct(p.early, p.total)}
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="bg-blue-50/40">
                        <td colSpan={10} className="px-4 py-3">
                          <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2 font-semibold">Plan changes for {g}</div>
                          <div className="grid grid-cols-7 gap-2">
                            {ALL_DISPLAY_LEVELS.map(lv => {
                              const cur = current[g]?.[lv] || 0;
                              const d   = plan[g]?.[lv] || 0;
                              const pj  = Math.max(0, cur + d);
                              const isEarly = EARLY_DISPLAY_LEVELS.has(lv);
                              return (
                                <div key={lv} className={`rounded-lg border p-2 ${isEarly ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white"}`}>
                                  <div className="flex items-center justify-between">
                                    <span className={`text-xs font-bold ${isEarly ? "text-emerald-700" : "text-gray-700"}`}>{lv}</span>
                                    <span className="text-[10px] text-gray-400">{cur} → {pj}</span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <button onClick={(e) => { e.stopPropagation(); bumpDelta(g, lv, -1); }}
                                      className="w-5 h-5 rounded bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 text-xs font-bold flex items-center justify-center">−</button>
                                    <input type="number" value={d}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => setDelta(g, lv, e.target.value)}
                                      className="flex-1 min-w-0 text-xs text-center bg-white border border-gray-200 rounded px-1 py-0.5 tabular-nums"/>
                                    <button onClick={(e) => { e.stopPropagation(); bumpDelta(g, lv, 1); }}
                                      className="w-5 h-5 rounded bg-gray-100 hover:bg-green-100 text-gray-600 hover:text-green-700 text-xs font-bold flex items-center justify-center">+</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-4 py-2 text-gray-800">All groups</td>
                <td className="text-right px-3 py-2">{orgTotalCur}</td>
                <td className="text-right px-3 py-2 text-emerald-700">{orgEarlyCur}</td>
                <td className="text-right px-3 py-2">{orgTotalCur - orgEarlyCur}</td>
                <td className="text-right px-3 py-2">{earlyPct(orgEarlyCur, orgTotalCur)}</td>
                <td className={`text-center px-3 py-2 border-l border-gray-200 ${orgTotalProj - orgTotalCur > 0 ? "text-green-600" : orgTotalProj - orgTotalCur < 0 ? "text-red-600" : "text-gray-400"}`}>
                  {orgTotalProj - orgTotalCur > 0 ? `+${orgTotalProj - orgTotalCur}` : (orgTotalProj - orgTotalCur) || "—"}
                </td>
                <td className="text-right px-3 py-2">{orgTotalProj}</td>
                <td className="text-right px-3 py-2 text-emerald-700">{orgEarlyProj}</td>
                <td className="text-right px-3 py-2">{orgTotalProj - orgEarlyProj}</td>
                <td className="text-right px-3 py-2">{earlyPct(orgEarlyProj, orgTotalProj)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Early-career % comparison chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">Early-Career % — Current vs Projected (top {chartData.length} groups)</h3>
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 28)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 110, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%"/>
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100}/>
            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v) => `${v}%`}/>
            <Legend wrapperStyle={{ fontSize: 11 }}/>
            <Bar dataKey="currentEarlyPct"   name="Current"   fill="#94a3b8" radius={[0, 4, 4, 0]}/>
            <Bar dataKey="projectedEarlyPct" name="Projected" fill="#10b981" radius={[0, 4, 4, 0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      </>}

      {tab === "pyramid" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Org Pyramid — All 14 Levels (Current vs Projected)</h3>
            <div className="space-y-1">
              {pyramidData.map(row => {
                const maxVal = Math.max(...pyramidData.map(r => Math.max(r.current, r.projected)), 1);
                const curW   = (row.current / maxVal) * 100;
                const projW  = (row.projected / maxVal) * 100;
                const tierColor = row.tier === "Executive" ? "#dc2626" : row.tier === "Manager" ? "#7c3aed" : row.early ? "#10b981" : "#2563eb";
                return (
                  <div key={row.level} className="flex items-center gap-2 text-xs">
                    <div className="w-10 font-mono font-bold text-right" style={{ color: tierColor }}>{row.level}</div>
                    <div className="flex-1 grid grid-cols-2 gap-1 items-center">
                      <div className="flex justify-end items-center gap-2">
                        <span className="text-gray-500 tabular-nums w-10 text-right">{row.current}</span>
                        <div className="h-3 rounded-l" style={{ width: `${curW}%`, background: `${tierColor}55` }}/>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-3 rounded-r" style={{ width: `${projW}%`, background: tierColor }}/>
                        <span className="font-bold tabular-nums w-10" style={{ color: tierColor }}>{row.projected}</span>
                        <span className={`text-xs tabular-nums w-10 ${row.delta > 0 ? "text-green-600" : row.delta < 0 ? "text-red-600" : "text-gray-300"}`}>
                          {row.delta > 0 ? `+${row.delta}` : row.delta || ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
              <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{background:"#10b98155"}}/>Current</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{background:"#10b981"}}/>Projected (after plan)</span>
              <span className="ml-auto">Bars share a common scale across levels.</span>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { tier: "Executive", color: "#dc2626", levels: ["E1","E2","E3"] },
              { tier: "Manager",   color: "#7c3aed", levels: ["M1","M2","M3","M4"] },
              { tier: "Senior IC", color: "#2563eb", levels: ["L3","L4","L5","L6","L7"] },
              { tier: "Early Career", color: "#10b981", levels: ["L1","L2"] },
            ].map(t => {
              const cur = pyramidData.filter(r => t.levels.includes(r.level)).reduce((s, r) => s + r.current, 0);
              const prj = pyramidData.filter(r => t.levels.includes(r.level)).reduce((s, r) => s + r.projected, 0);
              const diff = prj - cur;
              return (
                <div key={t.tier} className="bg-white rounded-xl border border-gray-100 p-3">
                  <div className="text-xs text-gray-400 mb-1">{t.tier}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black" style={{ color: t.color }}>{prj}</span>
                    <span className="text-xs text-gray-500">was {cur}</span>
                    <span className={`text-xs font-bold ml-auto ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-400"}`}>
                      {diff > 0 ? `+${diff}` : diff || "—"}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">{t.levels.join(" · ")}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h3 className="text-sm font-bold text-gray-700">Plan Rollout — Quarterly</h3>
              <span className="text-xs text-gray-400">Plan additions are spread evenly across the horizon below.</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-gray-500">Start year</span>
                <input type="number" value={planStartYear} onChange={e => setPlanStartYear(parseInt(e.target.value, 10) || 2026)}
                  className="w-20 text-xs text-center border border-gray-200 rounded px-1 py-0.5"/>
                <span className="text-xs text-gray-500">Horizon (Q)</span>
                <input type="number" min="1" max="20" value={planHorizonQ} onChange={e => setPlanHorizonQ(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 text-xs text-center border border-gray-200 rounded px-1 py-0.5"/>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">{groupLabel}</th>
                    <th className="text-left px-3 py-2 font-medium">Level</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                    {horizon.map(h => (
                      <th key={h.key} className="text-center px-2 py-2 font-medium">
                        <div className="text-[10px] text-gray-400">{h.year}</div>
                        <div>{h.q}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timelineRows.length === 0 ? (
                    <tr><td colSpan={3 + horizon.length} className="px-3 py-6 text-center text-gray-400">No plan items yet — add hires/departures from the Mix tab.</td></tr>
                  ) : timelineRows.map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-700">{r.group}</td>
                      <td className="px-3 py-2 font-mono font-bold" style={{ color: EARLY_DISPLAY_LEVELS.has(r.level) ? "#10b981" : "#374151" }}>{r.level}</td>
                      <td className={`text-right px-3 py-2 font-bold ${r.delta > 0 ? "text-green-600" : "text-red-600"}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                      {r.cells.map((c, j) => (
                        <td key={j} className={`text-center px-2 py-2 tabular-nums ${c > 0 ? "text-green-600" : c < 0 ? "text-red-600" : "text-gray-300"}`}>
                          {c > 0 ? `+${c}` : c || "·"}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td colSpan={2} className="px-3 py-2 text-gray-700">Quarterly hires (early in green)</td>
                    <td className="text-right px-3 py-2"></td>
                    {timelineByQuarter.map((t, i) => (
                      <td key={i} className="text-center px-2 py-2">
                        <div className={t.hires > 0 ? "text-green-700" : "text-gray-400"}>+{t.hires}</div>
                        {t.early > 0 && <div className="text-[10px] text-emerald-600">({t.early} early)</div>}
                        {t.departures > 0 && <div className="text-[10px] text-red-500">−{t.departures}</div>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Cumulative Headcount Trajectory</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={cumulativeTrend}>
                <defs>
                  <linearGradient id="hcGradTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#2563eb" stopOpacity={0.45}/>
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="hcGradEarly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#10b981" stopOpacity={0.55}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="key" tick={{ fontSize: 10 }}/>
                <YAxis tick={{ fontSize: 10 }}/>
                <Tooltip contentStyle={{ fontSize: 11 }}/>
                <Legend wrapperStyle={{ fontSize: 11 }}/>
                <Area type="monotone" dataKey="total" name="Total HC"        stroke="#2563eb" fill="url(#hcGradTotal)"/>
                <Area type="monotone" dataKey="early" name="Early Career HC" stroke="#10b981" fill="url(#hcGradEarly)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === "plan" && (
        <div className="space-y-4">
          {/* ─── 3-YEAR ATTRITION + GROWTH MODEL ─── */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h3 className="text-sm font-bold text-gray-700">3-Year Headcount Plan</h3>
              <span className="text-xs text-gray-400">Attrition is auto-backfilled at the same level. Net growth is added on top. EC mix on the next tab is computed against this plan.</span>
            </div>

            {/* Inputs row */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              {/* Attrition */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">Annual attrition %</span>
                  <span className="text-sm font-bold text-rose-700 tabular-nums">{attritionPct}%</span>
                </div>
                <input type="range" min="0" max="30" step="0.5" value={attritionPct}
                  onChange={e => setAttritionPct(parseFloat(e.target.value))} className="w-full"/>
                <div className="text-[10px] text-gray-400 mt-1">
                  ≈ {growthModel?.yearly[0]?.attrition ?? 0} departures in Y1 ({orgTotalCur} active today). Backfilled at same level.
                </div>
              </div>
              {/* Promotions */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">Annual promotion %</span>
                  <span className="text-sm font-bold text-amber-700 tabular-nums">{promoPctPerYear}%</span>
                </div>
                <input type="range" min="0" max="30" step="0.5" value={promoPctPerYear}
                  onChange={e => setPromoPctPerYear(parseFloat(e.target.value))} className="w-full"/>
                <div className="text-[10px] text-gray-400 mt-1">
                  ≈ {growthModel?.yearly[0]?.promotions ?? 0} promotions in Y1 (incl. {growthModel?.yearly[0]?.ecPromoted ?? 0} L2→L3 leaving EC pool).
                </div>
              </div>
              {/* Growth target */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">3-year net growth target</span>
                  <input type="number" min="0" value={growthTarget3Yr}
                    onKeyDown={e => { if (e.key === "-") e.preventDefault(); }}
                    onChange={e => setGrowthTarget3Yr(Math.max(0, parseInt(e.target.value || "0", 10)))}
                    className="w-20 text-right text-sm font-bold text-gray-800 tabular-nums border border-gray-200 rounded px-2 py-0.5"/>
                </div>
                <input type="range" min="0" max={Math.max(500, growthTarget3Yr)} step="5" value={growthTarget3Yr}
                  onChange={e => setGrowthTarget3Yr(parseInt(e.target.value, 10))} className="w-full"/>
                <div className="text-[10px] text-gray-400 mt-1">
                  Net new HC over 3 yr (acquisitions count toward this). Today: {orgTotalCur} → Y3 end: {growthModel?.threeYear?.endingHC ?? orgTotalCur}.
                </div>
              </div>
              {/* Per-year shift */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">Shift growth per year (%)</span>
                  <button onClick={() => setGrowthShiftPerYear([33, 33, 34])}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100">↺ even</button>
                </div>
                <div className="space-y-1.5">
                  {[0,1,2].map(i => {
                    const total = growthShiftPerYear.reduce((s,x)=>s+x, 0) || 1;
                    const pct = Math.round(100 * growthShiftPerYear[i] / total);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-8">Y{i+1}</span>
                        <input type="range" min="0" max="100" value={growthShiftPerYear[i]}
                          onChange={e => {
                            const v = parseInt(e.target.value, 10);
                            setGrowthShiftPerYear(arr => { const next = [...arr]; next[i] = v; return next; });
                          }}
                          className="flex-1"/>
                        <span className="text-[10px] tabular-nums w-10 text-right text-gray-600">{pct}%</span>
                        <span className="text-[10px] tabular-nums text-gray-500 w-8">{growthModel?.yearly[i]?.growth ?? 0}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Acquisitions row — per-year M&A injection */}
            <div className="border-t border-gray-100 pt-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">M&A acquisitions</span>
                  <span className="text-[10px] text-gray-400">absorbs growth target — recruiting fills the gap</span>
                </div>
                <button onClick={() => setAcquisitionsPerYear([{count:0,ecPct:20},{count:0,ecPct:20},{count:0,ecPct:20}])}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100">↺ clear</button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[0,1,2].map(i => {
                  const a = acquisitionsPerYear[i] || {count:0, ecPct:0};
                  const setField = (field, v) => setAcquisitionsPerYear(arr => {
                    const next = arr.map(x => ({...x}));
                    next[i][field] = v;
                    return next;
                  });
                  return (
                    <div key={i} className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-cyan-700 uppercase">Y{i+1} · {planStartYear + i}</span>
                        <span className="text-[10px] text-gray-400 tabular-nums">{a.count > 0 ? `${Math.round(a.count * a.ecPct/100)} EC` : "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-gray-600 w-10">HC</label>
                        <input type="number" min="0" value={a.count}
                          onKeyDown={e => { if (e.key === "-") e.preventDefault(); }}
                          onChange={e => setField("count", Math.max(0, parseInt(e.target.value || "0", 10)))}
                          className="flex-1 text-right text-sm font-bold text-cyan-700 tabular-nums border border-cyan-200 rounded px-2 py-0.5 bg-white"/>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <label className="text-[10px] text-gray-600 w-10">EC %</label>
                        <input type="range" min="0" max="100" step="5" value={a.ecPct}
                          onChange={e => setField("ecPct", parseInt(e.target.value, 10))} className="flex-1"/>
                        <span className="text-[10px] tabular-nums text-gray-600 w-8 text-right">{a.ecPct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Per-year breakdown cards */}
            <div className="grid grid-cols-3 gap-3">
              {(growthModel?.yearly || []).map((y, i) => (
                <div key={y.year} className="rounded-xl border border-gray-200 p-3 bg-gradient-to-b from-white to-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-bold text-gray-800">Year {i+1} · {y.year}</div>
                    <div className="text-[10px] text-gray-500 tabular-nums">{y.startHC} → {y.endHC}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="rounded bg-rose-50 border border-rose-100 px-2 py-1">
                      <div className="text-rose-600 text-[9px] font-semibold uppercase">Attrition</div>
                      <div className="text-rose-700 font-bold tabular-nums">−{y.attrition}</div>
                    </div>
                    <div className="rounded bg-amber-50 border border-amber-100 px-2 py-1">
                      <div className="text-amber-600 text-[9px] font-semibold uppercase">Promotions</div>
                      <div className="text-amber-700 font-bold tabular-nums">↑{y.promotions || 0}</div>
                      {y.ecPromoted > 0 && (
                        <div className="text-[9px] text-amber-600 tabular-nums">L2→L3: {y.ecPromoted}</div>
                      )}
                    </div>
                    <div className="rounded bg-violet-50 border border-violet-100 px-2 py-1">
                      <div className="text-violet-600 text-[9px] font-semibold uppercase">Net growth</div>
                      <div className="text-violet-700 font-bold tabular-nums">+{y.growth}</div>
                    </div>
                    <div className="rounded bg-cyan-50 border border-cyan-100 px-2 py-1">
                      <div className="text-cyan-600 text-[9px] font-semibold uppercase">Acquired</div>
                      <div className="text-cyan-700 font-bold tabular-nums">+{y.acquired || 0}</div>
                      {y.acquiredEC > 0 && (
                        <div className="text-[9px] text-cyan-600 tabular-nums">EC: {y.acquiredEC}</div>
                      )}
                    </div>
                    <div className="rounded bg-blue-50 border border-blue-100 px-2 py-1">
                      <div className="text-blue-600 text-[9px] font-semibold uppercase">Exp hires</div>
                      <div className="text-blue-700 font-bold tabular-nums">{y.exp}</div>
                    </div>
                    <div className="rounded bg-emerald-50 border border-emerald-100 px-2 py-1">
                      <div className="text-emerald-600 text-[9px] font-semibold uppercase">EC hires</div>
                      <div className="text-emerald-700 font-bold tabular-nums">{y.ec}</div>
                    </div>
                    <div className="rounded bg-orange-50 border border-orange-100 px-2 py-1">
                      <div className="text-orange-600 text-[9px] font-semibold uppercase">Interns</div>
                      <div className="text-orange-700 font-bold tabular-nums">{y.interns}</div>
                    </div>
                    <div className="rounded bg-gray-50 border border-gray-200 px-2 py-1">
                      <div className="text-gray-600 text-[9px] font-semibold uppercase">Gross hires</div>
                      <div className="text-gray-800 font-bold tabular-nums">{y.gross}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 3-year totals strip */}
            <div className="grid grid-cols-7 gap-2 mt-3">
              <div className="rounded-lg p-2 bg-rose-50 border border-rose-100 text-center">
                <div className="text-[10px] text-rose-700 font-semibold uppercase">3yr Attrition</div>
                <div className="text-lg font-black text-rose-700 tabular-nums">{growthModel?.threeYear?.totalAttrition ?? 0}</div>
              </div>
              <div className="rounded-lg p-2 bg-amber-50 border border-amber-100 text-center">
                <div className="text-[10px] text-amber-700 font-semibold uppercase">3yr Promotions</div>
                <div className="text-lg font-black text-amber-700 tabular-nums">↑{growthModel?.threeYear?.totalPromotions ?? 0}</div>
              </div>
              <div className="rounded-lg p-2 bg-violet-50 border border-violet-100 text-center">
                <div className="text-[10px] text-violet-700 font-semibold uppercase">3yr Growth</div>
                <div className="text-lg font-black text-violet-700 tabular-nums">+{growthModel?.threeYear?.totalGrowth ?? 0}</div>
              </div>
              <div className="rounded-lg p-2 bg-cyan-50 border border-cyan-100 text-center">
                <div className="text-[10px] text-cyan-700 font-semibold uppercase">3yr Acquired</div>
                <div className="text-lg font-black text-cyan-700 tabular-nums">+{growthModel?.threeYear?.totalAcquired ?? 0}</div>
              </div>
              <div className="rounded-lg p-2 bg-gray-50 border border-gray-200 text-center">
                <div className="text-[10px] text-gray-600 font-semibold uppercase">3yr Gross hires</div>
                <div className="text-lg font-black text-gray-800 tabular-nums">{growthModel?.threeYear?.totalGross ?? 0}</div>
              </div>
              <div className="rounded-lg p-2 bg-emerald-50 border border-emerald-100 text-center">
                <div className="text-[10px] text-emerald-700 font-semibold uppercase">3yr EC hires</div>
                <div className="text-lg font-black text-emerald-700 tabular-nums">{growthModel?.threeYear?.totalEC ?? 0}</div>
              </div>
              <div className="rounded-lg p-2 bg-blue-50 border border-blue-100 text-center">
                <div className="text-[10px] text-blue-700 font-semibold uppercase">Y3 end EC %</div>
                <div className="text-lg font-black text-blue-700 tabular-nums">{growthModel?.threeYear?.endingECPct ?? 0}%</div>
              </div>
            </div>

            {/* Backfill level distribution */}
            {growthModel && Object.keys(growthModel.backfillByLevel).length > 0 && (
              <div className="mt-3 text-[11px] text-gray-600">
                <span className="font-semibold text-gray-700">Backfill by level (3yr): </span>
                {Object.entries(growthModel.backfillByLevel)
                  .sort((a,b) => ALL_DISPLAY_LEVELS.indexOf(a[0]) - ALL_DISPLAY_LEVELS.indexOf(b[0]))
                  .map(([lv, n]) => (
                    <span key={lv} className="inline-block mx-1 px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
                      <span className="font-mono font-semibold text-gray-700">{lv}</span>
                      <span className="text-gray-500 ml-1 tabular-nums">×{n}</span>
                    </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "early" && (
        <div className="space-y-4">
          {/* Read-only summary of the overall plan that drives EC */}
          <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-semibold text-gray-700">Driven by Headcount Plan:</span>
            <span className="text-[11px] text-gray-500">attrition <span className="font-bold text-rose-700 tabular-nums">{attritionPct}%</span></span>
            <span className="text-[11px] text-gray-500">·</span>
            <span className="text-[11px] text-gray-500">promo <span className="font-bold text-amber-700 tabular-nums">{promoPctPerYear}%</span> <span className="text-[10px] text-gray-400">(L2→L3 drains EC)</span></span>
            <span className="text-[11px] text-gray-500">·</span>
            <span className="text-[11px] text-gray-500">3yr growth <span className="font-bold text-violet-700 tabular-nums">+{growthTarget3Yr}</span></span>
            {(growthModel?.threeYear?.totalAcquired ?? 0) > 0 && (
              <>
                <span className="text-[11px] text-gray-500">·</span>
                <span className="text-[11px] text-gray-500">acquired <span className="font-bold text-cyan-700 tabular-nums">+{growthModel.threeYear.totalAcquired}</span></span>
              </>
            )}
            <span className="text-[11px] text-gray-500">·</span>
            <span className="text-[11px] text-gray-500">3yr gross hires <span className="font-bold text-gray-800 tabular-nums">{growthModel?.threeYear?.totalGross ?? 0}</span></span>
            <span className="text-[11px] text-gray-500">·</span>
            <span className="text-[11px] text-gray-500">3yr EC hires <span className="font-bold text-emerald-700 tabular-nums">{growthModel?.threeYear?.totalEC ?? 0}</span></span>
            <button onClick={() => setTab("plan")}
              className="ml-auto text-[10px] px-2 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100">
              Edit plan →
            </button>
          </div>

          {/* Program KPIs */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Current early-career HC",  val: orgEarlyCur,  sub: `${earlyPct(orgEarlyCur, orgTotalCur)} of org`, color: "#10b981" },
              { label: "Projected early-career HC", val: orgEarlyProj, sub: `${earlyPct(orgEarlyProj, orgTotalProj)} of org after plan`, color: "#059669" },
              { label: "Planned EC hires",          val: `+${timelineRows.filter(r => EARLY_DISPLAY_LEVELS.has(r.level) && r.delta > 0).reduce((s, r) => s + r.delta, 0)}`, sub: "L1 + L2 net additions", color: "#16a34a" },
              { label: "Quarters in plan",          val: planHorizonQ, sub: `Starting ${planStartYear} Q1`, color: "#0891b2" },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="text-xs text-gray-400 mb-1">{k.label}</div>
                <div className="text-2xl font-black" style={{ color: k.color }}>{k.val}</div>
                <div className="text-xs text-gray-500 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Hiring calculator */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h3 className="text-sm font-bold text-gray-700 flex items-center">
                Early-Career Hiring Calculator
                <Help text={`"Early-career" = interns + new-college-grads (NCG) bucketed at L1/L2. Two ways to set the target: "Target Org Mix %" works backwards from the share of total org you want to be early-career. "Target Hiring Mix %" sets the share of *new hires* that come from early-career — easier to plan against if your recruiting team thinks in headcount-per-quarter.`} />
              </h3>
              <div className="flex items-center gap-1 ml-2 bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setEarlyMode("orgMix")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${earlyMode === "orgMix" ? "bg-white text-emerald-700 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  Target Org Mix %
                </button>
                <button onClick={() => setEarlyMode("hireMix")}
                  className={`text-xs px-2.5 py-1 rounded-md transition-colors ${earlyMode === "hireMix" ? "bg-white text-emerald-700 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  Target Hiring Mix %
                </button>
              </div>
              <span className="text-xs text-gray-400 ml-auto">Horizon: {planYears} yr ({planHorizonQ} quarters)</span>
            </div>

            {/* Sliders / inputs */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              {earlyMode === "orgMix" ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600">Target % of org as Early Career</span>
                    <span className="text-sm font-bold text-emerald-700 tabular-nums">{earlyTargetPct}%</span>
                  </div>
                  <input type="range" min="0" max="50" value={earlyTargetPct}
                    onChange={e => setEarlyTargetPct(parseInt(e.target.value, 10))} className="w-full"/>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Currently {orgTotalCur ? Math.round(100 * orgEarlyCur / orgTotalCur) : 0}% ({orgEarlyCur} of {orgTotalCur})
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600">% of new hires that are Early Career</span>
                    <span className="text-sm font-bold text-emerald-700 tabular-nums">{hireMixPct}%</span>
                  </div>
                  <input type="range" min="0" max="80" value={hireMixPct}
                    onChange={e => setHireMixPct(parseInt(e.target.value, 10))} className="w-full"/>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Industry: 15–30% is typical for sustainable pipeline
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">Annual experienced hires</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={annualExpHires}
                      onKeyDown={e => { if (e.key === "-") e.preventDefault(); }}
                      onChange={e => setAnnualExpHiresOverride(Math.max(0, parseInt(e.target.value || "0", 10)))}
                      className="w-20 text-right text-sm font-bold text-gray-800 tabular-nums border border-gray-200 rounded px-2 py-0.5"/>
                    <button onClick={() => setAnnualExpHiresOverride(null)}
                      title="Reset to plan-derived value"
                      className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100">↺ reset</button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-gray-500">Interns per 1 EC hire</span>
                  <div className="flex items-center gap-2">
                    <input type="range" min="0" max="3" step="0.1" value={internRatio}
                      onChange={e => setInternRatio(parseFloat(e.target.value))} className="w-24"/>
                    <span className="text-xs font-bold text-amber-700 tabular-nums w-10 text-right">{internRatio.toFixed(1)}×</span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  Plan-derived default: {defaultAnnualExpHires}/yr (from non-EC plan deltas)
                </div>
              </div>
            </div>

            {/* Result KPI strip */}
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg p-3 bg-emerald-50 border border-emerald-100">
                <div className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wide">Early-career hires / yr</div>
                <div className="text-2xl font-black text-emerald-700 tabular-nums">{earlyCalc.ecPerYear}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">L1 + L2 new grads</div>
              </div>
              <div className="rounded-lg p-3 bg-blue-50 border border-blue-100">
                <div className="text-[10px] text-blue-700 font-semibold uppercase tracking-wide">Experienced hires / yr</div>
                <div className="text-2xl font-black text-blue-700 tabular-nums">{earlyCalc.expPerYear}</div>
                <div className="text-[10px] text-blue-600 mt-0.5">L3+ / M / E</div>
              </div>
              <div className="rounded-lg p-3 bg-gray-50 border border-gray-200">
                <div className="text-[10px] text-gray-600 font-semibold uppercase tracking-wide">Hire mix</div>
                <div className="text-2xl font-black text-gray-800 tabular-nums">{earlyCalc.ecShare}%</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{earlyCalc.ecPerYear} of {earlyCalc.totalPerYear} hires are EC</div>
              </div>
              <div className="rounded-lg p-3 bg-amber-50 border border-amber-100">
                <div className="text-[10px] text-amber-700 font-semibold uppercase tracking-wide">Intern target / yr</div>
                <div className="text-2xl font-black text-amber-700 tabular-nums">{earlyCalc.interns}</div>
                <div className="text-[10px] text-amber-600 mt-0.5">{internRatio.toFixed(1)}× EC hires</div>
              </div>
            </div>

            {earlyMode === "orgMix" && (
              <div className="text-[11px] text-gray-500 mt-2">
                Starting from the post-plan baseline (<span className="font-semibold">{orgEarlyProj}</span> EC of <span className="font-semibold">{orgTotalProj}</span>),
                reaching <span className="font-semibold text-emerald-700">{earlyTargetPct}%</span> needs{" "}
                <span className="font-semibold text-emerald-700">{earlyCalc.orgGap}</span> more EC over {planYears} yr
                — about <span className="font-semibold">{earlyCalc.ecPerYear}/yr</span> alongside{" "}
                <span className="font-semibold">{earlyCalc.expPerYear}</span> experienced.
                Final mix: <span className="font-semibold text-emerald-700">{earlyCalc.finalPct}%</span>.
              </div>
            )}
            {earlyMode === "hireMix" && (
              <div className="text-[11px] text-gray-500 mt-2">
                With <span className="font-semibold text-emerald-700">{hireMixPct}%</span> of hires as early-career and{" "}
                <span className="font-semibold">{annualExpHires}</span> exp/yr, you need{" "}
                <span className="font-semibold text-emerald-700">{earlyCalc.ecPerYear}</span> EC hires/yr +{" "}
                <span className="font-semibold text-amber-700">{earlyCalc.interns}</span> interns. Final org mix:{" "}
                <span className="font-semibold text-emerald-700">{earlyCalc.finalPct}%</span>.
              </div>
            )}
            {earlyCalc.ecPerYear > earlyCalc.expPerYear && earlyCalc.expPerYear > 0 && (
              <div className="text-[11px] text-amber-700 mt-2 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                <AlertTriangle size={12}/>
                EC hires ({earlyCalc.ecPerYear}/yr) exceed experienced hires ({earlyCalc.expPerYear}/yr). Verify onboarding capacity and mentor bandwidth.
              </div>
            )}
          </div>

          {/* Per-group hire allocation (3-year totals) */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-sm font-bold text-gray-700">EC hire allocation by {groupLabel}</h3>
              <span className="text-xs text-gray-400">
                3-year totals · distributed by {earlyAllocByGroup[0]?.basis || "size"} (largest-remainder)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">{groupLabel}</th>
                    <th className="text-right px-3 py-2 font-medium">Share</th>
                    <th className="text-right px-3 py-2 font-medium">EC hires (3yr)</th>
                    <th className="text-right px-3 py-2 font-medium">Interns (3yr)</th>
                  </tr>
                </thead>
                <tbody>
                  {earlyAllocByGroup.map(r => (
                    <tr key={r.group} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{r.group}</td>
                      <td className="text-right px-3 py-2 text-gray-600">{r.share}%</td>
                      <td className="text-right px-3 py-2 text-emerald-700 font-bold tabular-nums">{r.ecPerYear}</td>
                      <td className="text-right px-3 py-2 text-amber-700 font-semibold tabular-nums">{r.interns}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                    <td className="px-3 py-2 text-gray-800">Total</td>
                    <td className="text-right px-3 py-2 text-gray-600">100%</td>
                    <td className="text-right px-3 py-2 text-emerald-700 tabular-nums">{earlyAllocByGroup.reduce((s,r)=>s+r.ecPerYear,0)}</td>
                    <td className="text-right px-3 py-2 text-amber-700 tabular-nums">{earlyAllocByGroup.reduce((s,r)=>s+r.interns,0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Target % table — collapsed by default to keep the page short */}
          <details className="bg-white rounded-xl border border-gray-100 p-4 group">
            <summary className="cursor-pointer flex items-center gap-3 list-none [&::-webkit-details-marker]:hidden">
              <ChevronRight size={14} className="text-gray-400 transition-transform group-open:rotate-90"/>
              <h3 className="text-sm font-bold text-gray-700">Current vs Projected Mix by {groupLabel}</h3>
              <span className="text-xs text-gray-400">% L1+L2 today and after the plan executes (target = {earlyTargetPct}%).</span>
            </summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">{groupLabel}</th>
                    <th className="text-right px-3 py-2 font-medium">Current EC</th>
                    <th className="text-right px-3 py-2 font-medium">Current %</th>
                    <th className="text-right px-3 py-2 font-medium">Projected EC</th>
                    <th className="text-right px-3 py-2 font-medium">Projected %</th>
                    <th className="text-right px-3 py-2 font-medium">Target ({earlyTargetPct}%)</th>
                    <th className="text-right px-3 py-2 font-medium">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {earlyByGroup.map(r => (
                    <tr key={r.group} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{r.group}</td>
                      <td className="text-right px-3 py-2 text-emerald-700">{r.curEarly}<span className="text-gray-400 text-[10px]"> / {r.curTotal}</span></td>
                      <td className="text-right px-3 py-2 text-gray-600">{r.curPct}%</td>
                      <td className="text-right px-3 py-2 text-emerald-700 font-semibold">{r.projEarly}<span className="text-gray-400 text-[10px]"> / {r.projTotal}</span></td>
                      <td className="text-right px-3 py-2 text-gray-700 font-semibold">{r.projPct}%</td>
                      <td className="text-right px-3 py-2 text-gray-600">{r.target}</td>
                      <td className={`text-right px-3 py-2 font-bold ${r.gap > 0 ? "text-amber-700" : r.gap < 0 ? "text-blue-600" : "text-emerald-700"}`}>
                        {r.gap > 0 ? `+${r.gap} short` : r.gap < 0 ? `${-r.gap} over` : "on target"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {/* Conversion / pipeline narrative */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <TrendingUp size={18} className="text-emerald-600 mt-0.5"/>
              <div className="text-xs text-emerald-900 leading-relaxed">
                <div className="font-bold text-sm text-emerald-800 mb-1">Early-Career Program Notes</div>
                Industry benchmark: a healthy semi/tech org carries <span className="font-bold">15–25%</span> of total headcount in
                early-career roles (L1–L2) to maintain pipeline. Below 10% indicates an <span className="font-bold">aging IC base</span>;
                above 30% signals <span className="font-bold">onboarding strain</span>. New-grad funnel typically converts L1 → L2 in
                ~18 months and L2 → L3 in ~24 months — so a one-year hire pause shows up as an L3 shortfall ~3 years later.
                Track gap to target above and use the Mix tab to add L1/L2 hires where the gap is positive.
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "reqs" && (
        <div className="space-y-4">
          {/* Header / actions */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-gray-700">Open Requisitions & Product Flow</h3>
                <div className="text-xs text-gray-500">Reassign reqs across levels, sites, and projects to optimize coverage. Fit scores update live.</div>
              </div>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input type="checkbox" checked={reqIncludeECCalc} onChange={e => setReqIncludeECCalc(e.target.checked)}/>
                  Include EC calculator
                </label>
                <select value={reqStatusFilter} onChange={e => setReqStatusFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                  <option value="All">All statuses</option>
                  {REQ_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={reqLevelFilter} onChange={e => setReqLevelFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
                  <option value="All">All levels</option>
                  {ALL_DISPLAY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <button onClick={resetOverrides} disabled={!Object.keys(reqOverrides).length}
                  title="Drop all manual reassignments"
                  className="text-xs px-2.5 py-1 rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-40">
                  ↺ Reset edits
                </button>
                <div className="relative group">
                  <button className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">
                    <Download size={12}/> Export ▾
                  </button>
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 hidden group-hover:block min-w-[180px]">
                    <button onClick={exportReqsCSV} className="block w-full text-left text-xs px-3 py-2 hover:bg-gray-50">Open Reqs (CSV)</button>
                    <button onClick={exportEmployeesCSV} className="block w-full text-left text-xs px-3 py-2 hover:bg-gray-50">Current Employees (CSV)</button>
                    <button onClick={exportProjectsCSV} className="block w-full text-left text-xs px-3 py-2 hover:bg-gray-50">Projects (CSV)</button>
                    <div className="h-px bg-gray-100 my-1"/>
                    <button onClick={exportPlanJSON} className="block w-full text-left text-xs px-3 py-2 hover:bg-gray-50 font-semibold text-blue-700">Full Plan (JSON)</button>
                  </div>
                </div>
                <label className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer">
                  <Plus size={12}/> Import JSON
                  <input type="file" accept=".json,application/json" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) importPlanJSON(f); e.target.value = ""; }}/>
                </label>
                <label className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                  title="Import a hiring plan from CSV (Save As CSV from Excel). Accepts long form (group,level,delta) or wide form (group,L1,L2,…,E3). Replaces the current plan.">
                  <Plus size={12}/> Import CSV
                  <input type="file" accept=".csv,text/csv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) importPlanCSV(f); e.target.value = ""; }}/>
                </label>
              </div>
            </div>

            {/* Summary chips */}
            <div className="flex items-center gap-2 mt-3 flex-wrap text-[11px]">
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">Total: <span className="font-bold">{filteredReqsFinal.length}</span></span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">EC: <span className="font-bold">{filteredReqsFinal.filter(r => r.isEC).length}</span></span>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">Exp: <span className="font-bold">{filteredReqsFinal.filter(r => !r.isEC).length}</span></span>
              <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700">Projects: <span className="font-bold">{projects.length}</span></span>
              {Object.keys(reqOverrides).length > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  {Object.keys(reqOverrides).length} manual edit{Object.keys(reqOverrides).length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>

          {/* Product Flow cards */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-gray-700">Product Flow Coverage</h3>
              <span className="text-xs text-gray-400">How well the open reqs cover each project's target staffing pyramid and preferred sites.</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {projectFit.map(p => {
                const fitText = p.fitPct >= 80 ? "text-emerald-600" : p.fitPct >= 50 ? "text-amber-600" : "text-red-600";
                const siteCls = p.sitePct >= 70 ? "bg-emerald-50 text-emerald-700"
                              : p.sitePct >= 40 ? "bg-amber-50 text-amber-700"
                                                 : "bg-red-50 text-red-700";
                const reb = suggestRebalance(p.id);
                return (
                  <div key={p.id} className={`border rounded-lg p-3 ${p.critical ? "border-amber-300 bg-amber-50/30" : "border-gray-200"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-800">{p.name}</h4>
                          {p.critical && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-bold">CRITICAL</span>}
                        </div>
                        <div className="text-[10px] text-gray-500">{p.owningGroup} · sites: {p.preferredSites.join(", ")}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-black ${fitText} tabular-nums leading-none`}>{p.fitPct}%</div>
                        <div className="text-[9px] text-gray-500 uppercase">Pyramid fit</div>
                      </div>
                    </div>

                    {/* Per-level coverage bars */}
                    <div className="space-y-1 mb-2">
                      {p.perLevel.map(lv => {
                        const cap = Math.max(lv.target, lv.reqs, 1);
                        return (
                          <div key={lv.level} className="flex items-center gap-2 text-[10px]">
                            <span className="w-7 font-mono text-gray-500">{lv.level}</span>
                            <div className="flex-1 relative h-3 bg-gray-100 rounded-sm overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-gray-300" style={{ width: `${100*lv.target/cap}%` }} title={`Target: ${lv.target}`}/>
                              <div className={`absolute inset-y-0 left-0 ${lv.reqs >= lv.target ? "bg-emerald-500" : "bg-amber-500"}`}
                                style={{ width: `${100*lv.reqs/cap}%`, opacity: 0.85 }} title={`Reqs: ${lv.reqs}`}/>
                            </div>
                            <span className="w-12 text-right tabular-nums text-gray-600">{lv.reqs}/{lv.target}</span>
                          </div>
                        );
                      })}
                      {p.perLevel.length === 0 && <div className="text-[10px] text-gray-400 italic">No level targets set.</div>}
                    </div>

                    {/* Bottom strip: site fit, EC %, total reqs, rebalance hint */}
                    <div className="flex items-center gap-2 flex-wrap text-[10px] pt-2 border-t border-gray-100">
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${siteCls}`}>
                        Site fit: {p.sitePct}%
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-gray-50 text-gray-600">
                        Reqs: <span className="font-bold">{p.reqTotal}</span> / target {p.targetTotal}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                        EC mix: {p.ecPct}%
                      </span>
                      {p.overfill > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                          {p.overfill} over-fill
                        </span>
                      )}
                      {reb.length > 0 && (
                        <span className="ml-auto text-amber-700">
                          ⚠ {reb.length} req{reb.length===1?"":"s"} off-site
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {projectFit.length === 0 && (
                <div className="col-span-2 text-center text-gray-400 text-xs py-6">
                  No projects yet. They'll auto-generate from your active employees.
                </div>
              )}
            </div>
          </div>

          {/* Reqs table — inline editable */}
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-700">Requisitions</h3>
              <span className="text-xs text-gray-400">Click a level/site/project cell to reassign — coverage above updates instantly.</span>
            </div>
            <div className="overflow-x-auto" style={{ maxHeight: 540 }}>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">ID</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Title</th>
                    <th className="text-left px-3 py-2 font-medium">Level</th>
                    <th className="text-left px-3 py-2 font-medium">{groupLabel}</th>
                    <th className="text-left px-3 py-2 font-medium">Location</th>
                    <th className="text-left px-3 py-2 font-medium">Project</th>
                    <th className="text-left px-3 py-2 font-medium">Hiring Mgr</th>
                    <th className="text-left px-3 py-2 font-medium">Target Start</th>
                    <th className="text-left px-3 py-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReqsFinal.length === 0 && (
                    <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                      No open reqs. Add hires in the Mix tab or enable the Early-Career calculator.
                    </td></tr>
                  )}
                  {filteredReqsFinal.map(r => {
                    const proj = projects.find(p => p.id === r.projectId);
                    const sitePref = proj && proj.preferredSites.includes(r.location);
                    const edited = reqOverrides[r.id];
                    return (
                      <tr key={r.id} className={`border-t border-gray-100 hover:bg-gray-50 ${edited ? "bg-amber-50/30" : ""}`}>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-gray-500">{r.id}{edited && <span className="ml-1 text-amber-600" title="Manually edited">✎</span>}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            r.status === "Open" ? "bg-blue-50 text-blue-700" :
                            r.status === "Sourcing" ? "bg-indigo-50 text-indigo-700" :
                            r.status === "Interviewing" ? "bg-purple-50 text-purple-700" :
                            r.status === "Offer" ? "bg-amber-50 text-amber-700" :
                            "bg-emerald-50 text-emerald-700"
                          }`}>{r.status}</span>
                        </td>
                        <td className="px-3 py-1.5 text-gray-800">{r.title}</td>
                        <td className="px-3 py-1.5">
                          <select value={r.level}
                            onChange={e => overrideReq(r.id, { level: e.target.value })}
                            className={`text-[10px] font-bold rounded border-0 px-1.5 py-0.5 cursor-pointer ${r.isEC ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                            {ALL_DISPLAY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-gray-600">{r.group}</td>
                        <td className="px-3 py-1.5">
                          <select value={r.location}
                            onChange={e => overrideReq(r.id, { location: e.target.value })}
                            className={`text-[11px] rounded border-0 px-1.5 py-0.5 cursor-pointer ${sitePref ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-700"}`}>
                            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <span className="text-[10px] text-gray-400 ml-1">{r.country}</span>
                        </td>
                        <td className="px-3 py-1.5">
                          <select value={r.projectId || ""}
                            onChange={e => overrideReq(r.id, { projectId: e.target.value })}
                            className="text-[11px] rounded border border-gray-200 px-1.5 py-0.5 cursor-pointer max-w-[140px] bg-white">
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-gray-600">{r.hiringManager}</td>
                        <td className="px-3 py-1.5 text-gray-600 tabular-nums">{r.targetStart}</td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.source === "plan" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-700"}`}>
                            {r.source === "plan" ? "plan" : "EC calc"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DETAIL PANEL ───
function DetailPanel() {
  const {
    detailPanel: node, annotations, hotspots, setDetailPanel,
    focusSubtree, setDragMode, getNodeColor, focusChain, setExitSimNode, mode,
    showAnnotationForm, setShowAnnotationForm,
    annotationText, setAnnotationText, annotationType, setAnnotationType,
    saveAnnotation, removeAnnotation,
  } = useContext(AppCtx);

  if (!node) return null;

  const nodeAnnotations = annotations[node.id] || [];
  const nodeHotspots = hotspots.filter(h => h.nodeId === node.id);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-100" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Employee Details</h3>
        <button onClick={() => setDetailPanel(null)} className="p-1 hover:bg-gray-100 rounded transition-colors"><X size={16}/></button>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold" style={{ background: getNodeColor(node) }}>
            {node.first[0]}{node.last[0]}
          </div>
          <div>
            <div className="font-bold text-lg text-gray-900">{node.first} {node.last}</div>
            <div className="text-sm text-gray-500">{node.title}</div>
            <div className="text-xs text-gray-400">{node.id}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
          {[
            ["Department", node.dept], ["Business Unit", node.bg], ["Discipline", node.fn], ["Function", node.title],
            ["Location", node.location], ["Country", node.country || countryFor(node.location)],
            ["Level", displayLevel(node.level)], ["Status", node.status],
            ["Employment", node.employmentType || "FTE"],
            ["Start Date", node.startDate], ["Direct Reports", node._directReports],
            ["Total Reports", node._totalReports], ["Band", node.band],
          ].map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-lg p-2">
              <div className="text-gray-400" style={{ fontSize: 10 }}>{k}</div>
              <div className="font-medium text-gray-700">{v}</div>
            </div>
          ))}
        </div>
        {nodeHotspots.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1"><AlertTriangle size={12}/>Issues Detected</h4>
            {nodeHotspots.map((h, i) => (
              <div key={i} className={`text-xs p-2 rounded mb-1 ${h.severity === "critical" ? "bg-red-50 text-red-700" : h.severity === "warning" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                {h.msg}
              </div>
            ))}
          </div>
        )}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-600">Notes & Flags</h4>
            <button onClick={() => setShowAnnotationForm(node.id)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"><Plus size={12}/>Add</button>
          </div>
          {nodeAnnotations.map((a, i) => (
            <div key={i} className={`text-xs p-2 rounded mb-1 flex items-start gap-2 ${a.type === "hotspot" ? "bg-red-50" : a.type === "flag" ? "bg-amber-50" : "bg-blue-50"}`}>
              <span className="shrink-0 mt-0.5">{a.type === "hotspot" ? "🔴" : a.type === "flag" ? "🚩" : "📝"}</span>
              <div className="flex-1">
                <div className="text-gray-700">{a.text}</div>
                <div className="text-gray-400 mt-0.5" style={{ fontSize: 9 }}>{a.time}</div>
              </div>
              <button onClick={() => removeAnnotation(node.id, i)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={10}/></button>
            </div>
          ))}
          {showAnnotationForm === node.id && (
            <div className="mt-2 p-2 bg-gray-50 rounded-lg">
              <div className="flex gap-1 mb-2">
                {[["note", "📝 Note"], ["flag", "🚩 Flag"], ["hotspot", "🔴 Hotspot"]].map(([t, l]) => (
                  <button key={t} onClick={() => setAnnotationType(t)} className={`text-xs px-2 py-1 rounded transition-colors ${annotationType === t ? "bg-blue-600 text-white" : "bg-white text-gray-600 border"}`}>{l}</button>
                ))}
              </div>
              <textarea value={annotationText} onChange={e => setAnnotationText(e.target.value)} placeholder="Enter note..." className="w-full text-xs border rounded p-2 mb-2" rows={2}/>
              <div className="flex gap-1">
                <button onClick={() => saveAnnotation(node.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors">Save</button>
                <button onClick={() => setShowAnnotationForm(null)} className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded hover:bg-gray-300 transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
        <div className="border-t pt-3">
          <h4 className="text-xs font-bold text-gray-600 mb-2">Actions</h4>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => focusSubtree(node.id)} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 transition-colors flex items-center gap-1"><Eye size={10}/>Focus Subtree</button>
            {atLeast(mode, "advanced") && <>
              <button onClick={() => focusChain(node.id)} className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-3 py-1.5 rounded hover:bg-violet-100 transition-colors flex items-center gap-1"><GitMerge size={10}/>Full Chain</button>
              <button onClick={() => { setExitSimNode(node); setDetailPanel(null); }} className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded hover:bg-red-100 transition-colors flex items-center gap-1"><AlertOctagon size={10}/>Simulate Exit</button>
              <button onClick={() => { setDragMode("team"); setDetailPanel(null); }} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 transition-colors flex items-center gap-1"><Move size={10}/>Move Team</button>
            </>}
            <button onClick={() => setShowAnnotationForm(node.id)} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 transition-colors flex items-center gap-1"><Edit3 size={10}/>Add Note</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WHITEBOARD ORG VIEW (sketchy hand-drawn chart via rough.js) ───
// three.js is loaded on demand (only when the 3D Galaxy view is first opened) so it
// adds zero weight to normal page loads. Returns a promise that resolves once THREE exists.
let _threePromise = null;
function loadThree() {
  if (typeof THREE !== "undefined") return Promise.resolve();
  if (_threePromise) return _threePromise;
  _threePromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
    s.onload = () => resolve();
    s.onerror = () => { _threePromise = null; reject(new Error("three.js load failed")); };
    document.head.appendChild(s);
  });
  return _threePromise;
}

// 3D "galaxy" org view — CEO at the center, each org level a shell expanding outward.
// Imperative three.js (UMD global THREE) driven from a useEffect. Orbit camera by
// default; toggle into a first-person pointer-lock "fly" camera (WASD + mouse-look).
function GalaxyOrgView() {
  const { chartDisplayRoot, getNodeColor, colorBy, setDetailPanel } = useContext(AppCtx);
  const mountRef = useRef(null);
  const tipRef = useRef(null);
  const sceneRef = useRef(null);
  const labelLayerRef = useRef(null);
  const reticleRef = useRef(null);
  const hudTargetRef = useRef(null);
  const hudSpeedRef = useRef(null);
  const vignetteRef = useRef(null);
  const [camMode, setCamMode] = useState("orbit");
  const camModeRef = useRef("orbit");
  const getColorRef = useRef(getNodeColor);
  const setDetailRef = useRef(setDetailPanel);
  getColorRef.current = getNodeColor;
  setDetailRef.current = setDetailPanel;

  // Load three.js on demand the first time this view mounts
  const [threeReady, setThreeReady] = useState(typeof THREE !== "undefined");
  useEffect(() => {
    if (threeReady) return;
    let alive = true;
    loadThree().then(() => alive && setThreeReady(true)).catch(() => {});
    return () => { alive = false; };
  }, [threeReady]);

  // ── Radial 3D layout (CEO center → shells outward), reusing _totalReports weights ──
  const layout = useMemo(() => {
    if (!chartDisplayRoot) return null;
    const nodes = [];   // { node, x, y, z, depth }
    const edges = [];   // [parentIdx, childIdx]
    const SHELL = 165;
    const jr = s => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); }; // deterministic 0..1
    (function place(node, depth, t0, t1, parentIdx) {
      // superlinear radius: each level sits farther out than the last, so the
      // lower/larger ranks (directors, managers, ICs) get spread apart
      const r = depth === 0 ? 0 : SHELL * Math.pow(depth, 1.55);
      const tMid = (t0 + t1) / 2;
      const phi = depth === 0 ? 0 : 0.18 * Math.sin(tMid * 1.7) + depth * 0.05;
      const cp = Math.cos(phi), sp = Math.sin(phi);
      const idx = nodes.length;
      let x = r * cp * Math.cos(tMid);
      let z = r * cp * Math.sin(tMid);
      let y = r * sp;
      if (depth >= 4) { // scatter deep ranks into a cloud so they don't sit on a thin arc
        const j = SHELL * (0.5 + (depth - 3) * 0.45);
        x += (jr(idx * 1.7) - 0.5) * j;
        y += (jr(idx * 2.9) - 0.5) * j * 1.5;
        z += (jr(idx * 4.3) - 0.5) * j;
      }
      nodes.push({ node, x, y, z, depth });
      if (parentIdx != null) edges.push([parentIdx, idx]);
      const kids = node.children || [];
      if (!kids.length || depth > 9) return;
      const total = node._totalReports || kids.length;
      const sweep = t1 - t0;
      let a = t0;
      kids.forEach(c => {
        const share = ((c._totalReports || 0) + 1) / total;
        const ea = a + sweep * share;
        const m = (ea - a) * 0.08;
        place(c, depth + 1, a + m, ea - m, idx);
        a = ea;
      });
    })(chartDisplayRoot, 0, 0, Math.PI * 2, null);
    let maxR = 1;
    nodes.forEach(n => { maxR = Math.max(maxR, Math.hypot(n.x, n.y, n.z)); });
    return { nodes, edges, maxR };
  }, [chartDisplayRoot]);

  // ── Build the THREE scene once per layout ──
  useEffect(() => {
    if (!threeReady || !layout || !mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth || 800, H = mount.clientHeight || 600;
    const { nodes, edges, maxR } = layout;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.FogExp2(0x05060a, 0.00018);

    // Starfield backdrop — multiple dense layers for a deep, busy sky
    const starfield = new THREE.Group();
    const starLayers = [];
    function addStarLayer(count, rMin, rRange, color, size, opacity) {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const rr = rMin + Math.random() * rRange;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = rr * Math.cos(ph);
        pos[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity });
      const p = new THREE.Points(g, m);
      p.frustumCulled = false;
      starfield.add(p);
      starLayers.push({ g, m });
    }
    addStarLayer(34000, 6000, 18000, 0x9aa8c8, 1.6, 0.85); // deep dense field
    addStarLayer(14000, 4500, 10000, 0xd6e2ff, 2.4, 0.95); // mid
    addStarLayer(6000, 3000, 6500, 0xf2f7ff, 3.4, 1.0);    // near bright
    addStarLayer(900, 4000, 15000, 0xffffff, 4.8, 1.0);    // sparse blazing "hero" stars
    scene.add(starfield);

    // Shooting stars — a small pool of streaking meteors (visible in both modes)
    const METEOR_N = 10;
    const meteors = [];
    for (let i = 0; i < METEOR_N; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      const m = new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0 });
      const ln = new THREE.Line(g, m);
      ln.frustumCulled = false;
      scene.add(ln);
      meteors.push({ ln, g, m, life: 0, maxLife: 1, head: new THREE.Vector3(), vel: new THREE.Vector3() });
    }

    // Connectors — one merged LineSegments
    const linePos = new Float32Array(edges.length * 6);
    edges.forEach(([pi, ci], k) => {
      const p = nodes[pi], c = nodes[ci];
      linePos[k * 6] = p.x; linePos[k * 6 + 1] = p.y; linePos[k * 6 + 2] = p.z;
      linePos[k * 6 + 3] = c.x; linePos[k * 6 + 4] = c.y; linePos[k * 6 + 5] = c.z;
    });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x3b4a66, transparent: true, opacity: 0.32 });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lines);

    // Node bodies — single InstancedMesh
    // Sphere size scales with how many people report up through this node — the CEO
    // (most reports) becomes the central "sun"; managers dwarf their individual ICs.
    const sizeForNode = n => 3.2 + Math.sqrt((n.node && n.node._totalReports) || 0) * 1.5;
    const sphereGeo = new THREE.SphereGeometry(1, 18, 14);
    const sphereMat = new THREE.MeshBasicMaterial();
    const inst = new THREE.InstancedMesh(sphereGeo, sphereMat, nodes.length);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const SUN_BOOST = 2.4; // make the CEO "sun" much bigger than its raw team-size scale
    nodes.forEach((n, i) => {
      dummy.position.set(n.x, n.y, n.z);
      let s = sizeForNode(n);
      if (n.depth === 0) s *= SUN_BOOST;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      col.set(getColorRef.current(n.node) || "#64748b");
      inst.setColorAt(i, col);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.frustumCulled = false; // bounding sphere is the unit geometry at origin; keep all instances visible
    scene.add(inst);

    // Warm "sun" glow halo on the root (CEO / largest) node
    const root0 = nodes[0];
    const gCanvas = document.createElement("canvas"); gCanvas.width = gCanvas.height = 128;
    const gCtx = gCanvas.getContext("2d");
    const gGrad = gCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gGrad.addColorStop(0, "rgba(255,244,214,0.95)");
    gGrad.addColorStop(0.25, "rgba(255,214,140,0.55)");
    gGrad.addColorStop(1, "rgba(255,180,80,0)");
    gCtx.fillStyle = gGrad; gCtx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(gCanvas);
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false });
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(root0.x, root0.y, root0.z);
    const gs = sizeForNode(root0) * SUN_BOOST * 5; // big corona; fog-immune so the sun stays a visible beacon
    glow.scale.set(gs, gs, 1);
    glow.renderOrder = -1;
    scene.add(glow);

    // Labels for senior levels (depth <= 3): canvas-texture sprites
    function makeLabel(text) {
      const pad = 8, fs = 30;
      const c = document.createElement("canvas");
      const cx = c.getContext("2d");
      cx.font = `600 ${fs}px 'DM Sans', sans-serif`;
      const tw = cx.measureText(text).width;
      c.width = Math.ceil(tw + pad * 2);
      c.height = fs + pad * 2;
      cx.font = `600 ${fs}px 'DM Sans', sans-serif`;
      cx.fillStyle = "rgba(5,8,16,0.66)";
      cx.fillRect(0, 0, c.width, c.height);
      cx.fillStyle = "#e8eefc";
      cx.textBaseline = "middle";
      cx.fillText(text, pad, c.height / 2);
      const tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      const scaleH = 13;
      sp.scale.set(scaleH * (c.width / c.height), scaleH, 1);
      return sp;
    }
    const labels = [];
    nodes.forEach(n => {
      if (n.depth <= 3) {
        const sp = makeLabel(`${n.node.first} ${n.node.last}`);
        sp.position.set(n.x, n.y + sizeForNode(n) + 9, n.z);
        scene.add(sp);
        labels.push(sp);
      }
    });

    // Cameras
    const orbitCam = new THREE.PerspectiveCamera(55, W / H, 0.5, 30000);
    const flyCam = new THREE.PerspectiveCamera(72, W / H, 0.5, 30000);
    const target = new THREE.Vector3(0, 0, 0);
    const orbit = { theta: 0.9, phi: 1.05, radius: Math.max(260, maxR * 2.4) };
    const fly = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, speed: Math.max(160, maxR * 0.9) };
    const keys = new Set();
    scene.add(flyCam); // so the camera-attached hyperdrive streaks render
    const FOV_BASE = 72, FOV_HYPER = 108;

    // Hyperdrive warp streaks — camera-local space, attached to flyCam
    const WARP_N = 320;
    const warpState = new Float32Array(WARP_N * 3);
    for (let i = 0; i < WARP_N; i++) {
      const a = Math.random() * Math.PI * 2, rad = 18 + Math.random() * 560;
      warpState[i * 3] = Math.cos(a) * rad;
      warpState[i * 3 + 1] = Math.sin(a) * rad;
      warpState[i * 3 + 2] = -(60 + Math.random() * 1700);
    }
    const warpArr = new Float32Array(WARP_N * 6);
    const warpGeo = new THREE.BufferGeometry();
    warpGeo.setAttribute("position", new THREE.BufferAttribute(warpArr, 3));
    const warpMat = new THREE.LineBasicMaterial({ color: 0xbcd8ff, transparent: true, opacity: 0 });
    const warp = new THREE.LineSegments(warpGeo, warpMat);
    warp.frustumCulled = false; warp.visible = false;
    flyCam.add(warp);

    // Smooth orbit "fly-to-node" tween
    const flyTo = { t: 1, dur: 0.9, fromT: new THREE.Vector3(), toT: new THREE.Vector3(), fromR: 0, toR: 0 };

    // LOD label pool (HTML overlay) — reveals nearby names in both modes
    const labelDivs = [];
    if (labelLayerRef.current) {
      for (let i = 0; i < 16; i++) {
        const d = document.createElement("div");
        d.style.cssText = "position:absolute;transform:translate(-50%,-150%);pointer-events:none;white-space:nowrap;font:600 11px 'DM Sans',sans-serif;color:#dbe7ff;text-shadow:0 1px 3px rgba(0,0,0,0.95);display:none;";
        labelLayerRef.current.appendChild(d);
        labelDivs.push(d);
      }
    }

    function applyOrbit() {
      const { theta, phi, radius } = orbit;
      orbitCam.position.set(
        target.x + radius * Math.sin(phi) * Math.cos(theta),
        target.y + radius * Math.cos(phi),
        target.z + radius * Math.sin(phi) * Math.sin(theta)
      );
      orbitCam.lookAt(target);
    }
    applyOrbit();

    function enterFly() {
      fly.pos.copy(orbitCam.position);
      const dir = target.clone().sub(orbitCam.position).normalize();
      fly.yaw = Math.atan2(dir.x, dir.z) + Math.PI;
      fly.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
      renderer.domElement.requestPointerLock?.();
    }
    function exitFly() {
      orbit.radius = THREE.MathUtils.clamp(flyCam.position.distanceTo(target), 50, maxR * 3);
      orbit.theta = Math.atan2(flyCam.position.z, flyCam.position.x);
      orbit.phi = Math.acos(THREE.MathUtils.clamp(flyCam.position.y / (orbit.radius || 1), -1, 1));
    }

    // Orbit controls — pointer drag + wheel
    let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, moved = false, lastHover = 0;
    const el = renderer.domElement;
    el.style.cursor = "grab";
    function onPointerDown(e) {
      if (camModeRef.current !== "orbit") return;
      dragging = true; moved = false;
      lastX = downX = e.clientX; lastY = downY = e.clientY;
    }
    function onPointerMove(e) {
      if (camModeRef.current === "orbit" && !dragging) { updateHover(e); return; }
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) moved = true;
      orbit.theta -= dx * 0.005;
      orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * 0.005, 0.08, Math.PI - 0.08);
    }
    function onPointerUp() { dragging = false; }
    function onWheel(e) {
      e.preventDefault();
      orbit.radius = THREE.MathUtils.clamp(orbit.radius * (1 + (e.deltaY > 0 ? 0.12 : -0.12)), 35, maxR * 3);
    }
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    // Raycast selection + hover
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pickAt(clientX, clientY, cam) {
      const rect = el.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, cam);
      const hit = raycaster.intersectObject(inst, false)[0];
      return hit && hit.instanceId != null ? hit.instanceId : -1;
    }
    let hoverId = -1;
    function updateHover(e) {
      const now = performance.now();
      if (now - lastHover < 50) return;
      lastHover = now;
      const id = pickAt(e.clientX, e.clientY, orbitCam);
      const tip = tipRef.current;
      if (!tip) return;
      if (id >= 0) {
        const n = nodes[id].node;
        tip.textContent = `${n.first} ${n.last} · ${n.title || ""}`;
        const rect = el.getBoundingClientRect();
        tip.style.left = (e.clientX - rect.left + 12) + "px";
        tip.style.top = (e.clientY - rect.top + 12) + "px";
        tip.style.display = "block";
        if (id !== hoverId) { el.style.cursor = "pointer"; hoverId = id; }
      } else if (hoverId !== -1) {
        tip.style.display = "none"; el.style.cursor = "grab"; hoverId = -1;
      }
    }
    function onClick(e) {
      if (camModeRef.current === "fly") {
        raycaster.setFromCamera({ x: 0, y: 0 }, flyCam);
        const hit = raycaster.intersectObject(inst, false)[0];
        if (hit && hit.instanceId != null) setDetailRef.current(nodes[hit.instanceId].node);
        return;
      }
      if (moved) return;
      const id = pickAt(e.clientX, e.clientY, orbitCam);
      if (id >= 0) {
        const n = nodes[id];
        flyTo.fromT.copy(target); flyTo.toT.set(n.x, n.y, n.z);
        flyTo.fromR = orbit.radius;
        flyTo.toR = THREE.MathUtils.clamp(sizeForNode(n) * 6 + 60, 60, maxR * 2);
        flyTo.t = 0; flyTo.dur = 0.9;
        setDetailRef.current(n.node);
      }
    }
    el.addEventListener("click", onClick);

    // Fly controls — pointer lock + WASD
    function onKeyDown(e) {
      if (camModeRef.current !== "fly") return;
      const k = e.key.toLowerCase();
      keys.add(k);
      if ([" ", "w", "a", "s", "d"].includes(k)) e.preventDefault();
    }
    function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    function onMouseMoveLocked(e) {
      if (document.pointerLockElement !== el) return;
      fly.yaw -= e.movementX * 0.0022;
      fly.pitch = THREE.MathUtils.clamp(fly.pitch - e.movementY * 0.0022, -1.5, 1.5);
    }
    document.addEventListener("mousemove", onMouseMoveLocked);
    function onPointerLockChange() {
      if (document.pointerLockElement !== el && camModeRef.current === "fly") {
        exitFly(); setCamMode("orbit");
      }
    }
    document.addEventListener("pointerlockchange", onPointerLockChange);

    // Resize
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      orbitCam.aspect = flyCam.aspect = w / h;
      orbitCam.updateProjectionMatrix(); flyCam.updateProjectionMatrix();
    });
    ro.observe(mount);

    // Animation loop
    let raf = 0, last = performance.now();
    const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), move = new THREE.Vector3();
    const flyEuler = new THREE.Euler(0, 0, 0, "YXZ");
    const CENTER = new THREE.Vector2(0, 0), _tmpV = new THREE.Vector3(), _tmpV2 = new THREE.Vector3();
    let prevYaw = 0, roll = 0, hyperInt = 0, hudTimer = 0, lodTimer = 0, meteorTimer = 1.0, autoT = 0;
    const cand = [];

    function spawnMeteor() {
      const slot = meteors.find(o => o.life <= 0);
      if (!slot) return;
      const R = maxR * 2.4 + 250;
      const d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      slot.head.copy(d).multiplyScalar(R);
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      slot.vel.copy(v).multiplyScalar(maxR * 1.2 + 350);
      slot.maxLife = 1.0 + Math.random() * 1.2;
      slot.life = slot.maxLife;
    }
    function updateMeteors(dt) {
      meteorTimer -= dt;
      if (meteorTimer <= 0) { spawnMeteor(); meteorTimer = 0.35 + Math.random() * 1.2; }
      for (const o of meteors) {
        if (o.life <= 0) { if (o.m.opacity !== 0) o.m.opacity = 0; continue; }
        o.life -= dt;
        o.head.addScaledVector(o.vel, dt);
        const pa = o.g.attributes.position.array;
        pa[0] = o.head.x; pa[1] = o.head.y; pa[2] = o.head.z;
        pa[3] = o.head.x - o.vel.x * 0.05; pa[4] = o.head.y - o.vel.y * 0.05; pa[5] = o.head.z - o.vel.z * 0.05;
        o.g.attributes.position.needsUpdate = true;
        o.m.opacity = Math.sin(THREE.MathUtils.clamp(o.life / o.maxLife, 0, 1) * Math.PI) * 0.9;
      }
    }
    function updateWarp(dt, intensity) {
      warp.visible = intensity > 0.02;
      if (!warp.visible) return;
      const adv = (700 + intensity * 6000) * dt;
      const streak = 8 + intensity * 320;
      for (let i = 0; i < WARP_N; i++) {
        let z = warpState[i * 3 + 2] + adv;
        if (z > 40) { const a = Math.random() * Math.PI * 2, rad = 18 + Math.random() * 560; warpState[i * 3] = Math.cos(a) * rad; warpState[i * 3 + 1] = Math.sin(a) * rad; z = -(1300 + Math.random() * 800); }
        warpState[i * 3 + 2] = z;
        const rx = warpState[i * 3], ry = warpState[i * 3 + 1];
        warpArr[i * 6] = rx; warpArr[i * 6 + 1] = ry; warpArr[i * 6 + 2] = z;
        warpArr[i * 6 + 3] = rx; warpArr[i * 6 + 4] = ry; warpArr[i * 6 + 5] = z - streak;
      }
      warpGeo.attributes.position.needsUpdate = true;
      warpMat.opacity = intensity * 0.85;
    }
    function updateLODLabels(cam) {
      const layer = labelLayerRef.current; if (!layer) return;
      cam.updateMatrixWorld();
      cam.matrixWorldInverse.copy(cam.matrixWorld).invert(); // project() needs a current inverse
      cam.getWorldPosition(_tmpV);
      const D = 280;
      cand.length = 0;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]; if (n.depth <= 3) continue;
        const dx = n.x - _tmpV.x, dy = n.y - _tmpV.y, dz = n.z - _tmpV.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < D * D) cand.push([i, d2]);
      }
      cand.sort((a, b) => a[1] - b[1]);
      const rect = el.getBoundingClientRect();
      for (let k = 0; k < labelDivs.length; k++) {
        const div = labelDivs[k];
        if (k < cand.length) {
          const n = nodes[cand[k][0]];
          _tmpV2.set(n.x, n.y, n.z).project(cam);
          if (_tmpV2.z >= 1 || Math.abs(_tmpV2.x) > 1.05 || Math.abs(_tmpV2.y) > 1.05) { div.style.display = "none"; continue; }
          div.textContent = `${n.node.first} ${n.node.last}`;
          div.style.left = ((_tmpV2.x * 0.5 + 0.5) * rect.width) + "px";
          div.style.top = ((-_tmpV2.y * 0.5 + 0.5) * rect.height) + "px";
          div.style.opacity = String(Math.max(0.18, 1 - Math.sqrt(cand[k][1]) / D));
          div.style.display = "block";
        } else div.style.display = "none";
      }
    }
    function updateFlyHUD(spd, hyperActive) {
      flyCam.updateMatrixWorld();
      raycaster.setFromCamera(CENTER, flyCam);
      const hit = raycaster.intersectObject(inst, false)[0];
      const tgt = hudTargetRef.current, ret = reticleRef.current;
      if (hit && hit.instanceId != null) {
        const n = nodes[hit.instanceId].node;
        if (tgt) { tgt.style.display = "block"; tgt.innerHTML = `<div style="font-weight:700;color:#e6f4ff">${n.first} ${n.last}</div><div style="opacity:.85">${(n.title || "").replace(/[<>]/g, "")}</div><div style="opacity:.6">${(n.dept || "").replace(/[<>]/g, "")}</div>`; }
        if (ret) { ret.style.borderColor = "#7dd3fc"; ret.style.width = ret.style.height = "26px"; }
      } else {
        if (tgt) tgt.style.display = "none";
        if (ret) { ret.style.borderColor = "rgba(220,235,255,0.55)"; ret.style.width = ret.style.height = "20px"; }
      }
      const sp = hudSpeedRef.current;
      if (sp) sp.textContent = `SPD ${Math.round(spd)}${hyperActive ? "   ⚡ HYPERDRIVE" : ""}`;
    }

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      let cam;
      if (camModeRef.current === "fly") {
        const hyperActive = keys.has("shift");
        hyperInt += ((hyperActive ? 1 : 0) - hyperInt) * Math.min(1, dt * 4);
        const fov = FOV_BASE + hyperInt * (FOV_HYPER - FOV_BASE);
        if (Math.abs(flyCam.fov - fov) > 0.05) { flyCam.fov = fov; flyCam.updateProjectionMatrix(); }
        // banking roll from turn rate + strafe
        const yawRate = (fly.yaw - prevYaw) / Math.max(dt, 0.001); prevYaw = fly.yaw;
        let rollTarget = THREE.MathUtils.clamp(-yawRate * 0.05, -0.45, 0.45);
        if (keys.has("a")) rollTarget += 0.16;
        if (keys.has("d")) rollTarget -= 0.16;
        roll += (rollTarget - roll) * Math.min(1, dt * 5);
        flyEuler.set(fly.pitch, fly.yaw, roll);
        flyCam.quaternion.setFromEuler(flyEuler);
        fwd.set(0, 0, -1).applyQuaternion(flyCam.quaternion);
        right.set(1, 0, 0).applyQuaternion(flyCam.quaternion);
        move.set(0, 0, 0);
        if (keys.has("w") || hyperActive) move.add(fwd); // hyperdrive auto-thrusts forward
        if (keys.has("s")) move.sub(fwd);
        if (keys.has("d")) move.add(right);
        if (keys.has("a")) move.sub(right);
        if (keys.has(" ")) move.add(up);
        if (keys.has("control")) move.sub(up);
        const spd = fly.speed * (hyperActive ? 7 : 1);
        const moving = move.lengthSq() > 0;
        if (moving) fly.pos.addScaledVector(move.normalize(), spd * dt);
        const LEASH = maxR * 1.7; // keep the sun in view — don't let the ship fly off into the void
        if (fly.pos.lengthSq() > LEASH * LEASH) fly.pos.setLength(LEASH);
        flyCam.position.copy(fly.pos);
        updateWarp(dt, hyperInt);
        if (vignetteRef.current) vignetteRef.current.style.opacity = String(0.3 + hyperInt * 0.5);
        hudTimer -= dt; if (hudTimer <= 0) { hudTimer = 0.07; updateFlyHUD(moving ? spd : 0, hyperActive); }
        cam = flyCam;
      } else {
        if (camModeRef.current === "auto") { // slowly circle the constellation
          autoT += dt;
          orbit.theta += dt * 0.12;
          orbit.phi = 1.0 + Math.sin(autoT * 0.25) * 0.16;
        }
        if (flyTo.t < 1) {
          flyTo.t = Math.min(1, flyTo.t + dt / flyTo.dur);
          const e = flyTo.t < 0.5 ? 2 * flyTo.t * flyTo.t : 1 - Math.pow(-2 * flyTo.t + 2, 2) / 2;
          target.lerpVectors(flyTo.fromT, flyTo.toT, e);
          orbit.radius = flyTo.fromR + (flyTo.toR - flyTo.fromR) * e;
        }
        applyOrbit();
        if (warp.visible) warp.visible = false;
        cam = orbitCam;
      }
      updateMeteors(dt);
      lodTimer -= dt; if (lodTimer <= 0) { lodTimer = 0.1; updateLODLabels(cam); }
      starfield.rotation.y += dt * 0.004;
      renderer.render(scene, cam);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    sceneRef.current = {
      enterFly, exitFly,
      recolor() {
        nodes.forEach((n, i) => { col.set(getColorRef.current(n.node) || "#64748b"); inst.setColorAt(i, col); });
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMoveLocked);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      if (document.pointerLockElement === el) document.exitPointerLock?.();
      sphereGeo.dispose(); sphereMat.dispose();
      lineGeo.dispose(); lineMat.dispose();
      starLayers.forEach(s => { s.g.dispose(); s.m.dispose(); });
      warpGeo.dispose(); warpMat.dispose();
      meteors.forEach(o => { o.g.dispose(); o.m.dispose(); });
      glowTex.dispose(); glowMat.dispose();
      labelDivs.forEach(d => d.remove());
      labels.forEach(sp => { sp.material.map?.dispose(); sp.material.dispose(); });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [layout, threeReady]);

  useEffect(() => { camModeRef.current = camMode; }, [camMode]);
  useEffect(() => { sceneRef.current?.recolor(); }, [colorBy]);

  function setCam(m) {
    const prev = camModeRef.current;
    camModeRef.current = m;
    setCamMode(m);
    if (m === "fly") sceneRef.current?.enterFly();
    else if (prev === "fly") { sceneRef.current?.exitFly(); if (document.pointerLockElement) document.exitPointerLock?.(); }
  }

  if (!threeReady) {
    return <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">Loading 3D engine…</div>;
  }
  if (!chartDisplayRoot) {
    return <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">No data</div>;
  }

  return (
    <div className="flex-1 min-h-0 w-full relative overflow-hidden" style={{ background: "#05060a" }}>
      <div ref={mountRef} className="absolute inset-0" />
      <div ref={tipRef} className="absolute pointer-events-none px-2 py-1 rounded text-white text-xs"
        style={{ display: "none", background: "rgba(15,23,42,0.92)", border: "1px solid rgba(148,163,184,0.4)", zIndex: 20, whiteSpace: "nowrap" }} />
      {/* near-node LOD label layer (both modes) */}
      <div ref={labelLayerRef} className="absolute inset-0 z-10 pointer-events-none" />
      {/* First-person cockpit HUD */}
      {camMode === "fly" && (<>
        <div ref={vignetteRef} className="absolute inset-0 pointer-events-none z-20"
          style={{ boxShadow: "inset 0 0 220px 70px rgba(2,6,20,0.92)", opacity: 0.3, transition: "opacity 0.2s" }} />
        <div className="absolute pointer-events-none z-30" style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <div ref={reticleRef} style={{ width: 20, height: 20, border: "1.5px solid rgba(220,235,255,0.55)", borderRadius: "50%", transition: "width .12s, height .12s, border-color .12s", boxShadow: "0 0 8px rgba(125,211,252,0.4)" }} />
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 3, height: 3, background: "#bfe3ff", transform: "translate(-50%,-50%)", borderRadius: "50%" }} />
        </div>
        <div ref={hudTargetRef} className="absolute pointer-events-none z-30"
          style={{ display: "none", left: "50%", top: "calc(50% + 28px)", transform: "translateX(-50%)", textAlign: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#cfe6ff", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }} />
        <div className="absolute pointer-events-none z-30"
          style={{ left: "50%", bottom: 16, transform: "translateX(-50%)", fontFamily: "monospace", fontSize: 12, letterSpacing: 1, color: "#9fd0ff", background: "rgba(2,8,23,0.5)", border: "1px solid rgba(125,211,252,0.3)", borderRadius: 8, padding: "5px 14px", backdropFilter: "blur(3px)" }}>
          <span ref={hudSpeedRef}>SPD 0</span>
        </div>
      </>)}
      <div className="absolute top-3 left-3 z-10 flex gap-1 bg-black/40 rounded-lg p-1" style={{ backdropFilter: "blur(4px)" }}>
        {[["orbit", "🛰 Orbit"], ["fly", "🚀 Fly"], ["auto", "🌀 Auto-orbit"]].map(([m, l]) => (
          <button key={m} onClick={() => setCam(m)}
            className="text-xs px-2.5 py-1 rounded-md transition-colors"
            style={{ background: camMode === m ? "#2563eb" : "transparent", color: camMode === m ? "white" : "#cbd5e1", fontWeight: camMode === m ? 600 : 400 }}>
            {l}
          </button>
        ))}
      </div>
      <div className="absolute top-3 right-3 z-10 text-white px-3 py-1.5 rounded-md" style={{ fontSize: 11, background: "rgba(0,0,0,0.4)", color: "#cbd5e1", backdropFilter: "blur(4px)" }}>
        Colored by {colorBy === "business_group" ? "Business Unit" : colorBy === "department" ? "Department" : colorBy === "discipline" ? "Discipline" : "Location"} · CEO at center, levels fan outward
      </div>
      <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-md" style={{ fontSize: 11, maxWidth: 380, background: "rgba(0,0,0,0.4)", color: "#cbd5e1", backdropFilter: "blur(4px)" }}>
        {camMode === "fly"
          ? "Fly: mouse to look · W/A/S/D thrust · Space up · Ctrl down · hold Shift = ⚡HYPERDRIVE · click to select target · Esc exits"
          : camMode === "auto"
          ? "Auto-orbit: the camera slowly circles the constellation · scroll to zoom · pick Orbit to take control"
          : "Orbit: drag to rotate · scroll to zoom · hover for name · click to fly to a node + open details"}
      </div>
    </div>
  );
}

const SKIN = ["#f1c9a5", "#e0ac80", "#c68642", "#a06a3b", "#ffdbac"];
// Pick a building archetype from the department name so the skyline reads varied.
function cityStyle(name) {
  const s = (name || "").toLowerCase();
  if (/manufactur|operation|supply|process|\bfab|logistic|quality|assembly|packag/.test(s)) return "factory";
  if (/sales|market|applicat|field|customer|brand|account|revenue/.test(s)) return "retail";
  if (/design|verif|silicon|rtl|analog|physical|software|systems|engineer|dft|emulation|architect|research|product|\btest/.test(s)) return "lab";
  if (/finance|\bhr\b|people|legal|\bit\b|security|corporate|strategy|exec|g&a|admin|talent/.test(s)) return "office";
  return "tower";
}
// A building silhouette, varied by team size, archetype, and a stable seed, for a diverse skyline.
function cityShape(count, style, seed) {
  if (count <= 4) return seed % 3 === 0 ? "house" : "box";
  if (style === "lab") return seed % 2 ? "dome" : "cylinder";
  return ["box", "cylinder", "stepped", "pyramid", "box", "stepped", "cylinder", "box"][seed % 8];
}

// ── Day/night helpers (shared by the city + interior) ──
function hexRGB(h) { return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function mix(a, b, t) { t = Math.max(0, Math.min(1, t)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rgbStr(c) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
const DAY_SECONDS = 90; // one full day/night cycle
function timeOfDay() { return (Date.now() / 1000 % DAY_SECONDS) / DAY_SECONDS; }
function skyState(tod) {
  const ang = tod * Math.PI * 2 - Math.PI / 2;
  const s = Math.sin(ang);                                  // -1 midnight .. +1 noon
  const day = Math.max(0, Math.min(1, s * 1.0 + 0.28));
  const night = 1 - day;
  const dusk = Math.max(0, 1 - Math.abs(s) * 2.6) * Math.max(0, Math.min(1, s + 0.6));
  const top = rgbStr(mix(mix(hexRGB("0a0f24"), hexRGB("3a7bd5"), day), hexRGB("5b3a6e"), dusk * 0.55));
  const bot = rgbStr(mix(mix(hexRGB("16203f"), hexRGB("bfe3ff"), day), hexRGB("f4a368"), dusk * 0.85));
  return { ang, day, night, dusk, top, bot };
}
const SEASON_SECONDS = 80; // each season lasts this long
const SEASONS = [
  { grass: "b6dd8c", top: "5fb567", mid: "7cc77f", snow: 0, leaves: 0, name: "Spring", emoji: "🌸" },
  { grass: "93c46f", top: "4e9d54", mid: "62b56a", snow: 0, leaves: 0, name: "Summer", emoji: "☀️" },
  { grass: "c2a24e", top: "d98a3a", mid: "e0a657", snow: 0, leaves: 1, name: "Autumn", emoji: "🍂" },
  { grass: "e6edf0", top: "9fb0bb", mid: "c4d2da", snow: 1, leaves: 0, name: "Winter", emoji: "❄️" },
];
function seasonState(t) {
  const f = (t % (SEASON_SECONDS * 4)) / SEASON_SECONDS, i = Math.floor(f) % 4, k = f - Math.floor(f), a = SEASONS[i], b = SEASONS[(i + 1) % 4];
  return {
    grass: rgbStr(mix(hexRGB(a.grass), hexRGB(b.grass), k)),
    top: rgbStr(mix(hexRGB(a.top), hexRGB(b.top), k)),
    mid: rgbStr(mix(hexRGB(a.mid), hexRGB(b.mid), k)),
    snow: a.snow + (b.snow - a.snow) * k,
    leaves: a.leaves + (b.leaves - a.leaves) * k,
    name: (k < 0.5 ? a : b).name, emoji: (k < 0.5 ? a : b).emoji,
  };
}

// Step inside a building: every employee of that department is a little person at a desk (1:1).
// Cached radial-glow sprites: baking one per color and blitting it (drawImage) is far cheaper
// than calling createRadialGradient + fill for every light source every frame.
const _glowCache = {};
function glowSprite(rgb) {
  if (_glowCache[rgb]) return _glowCache[rgb];
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), rad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rad.addColorStop(0, `rgba(${rgb},1)`); rad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = rad; g.fillRect(0, 0, 128, 128);
  _glowCache[rgb] = c; return c;
}
function blitGlow(ctx, x, y, rx, ry, rgb, alpha) { // caller sets globalCompositeOperation (usually "lighter")
  if (alpha <= 0.002) return;
  const a = ctx.globalAlpha; ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(glowSprite(rgb), x - rx, y - ry, rx * 2, ry * 2); ctx.globalAlpha = a;
}
function BuildingInterior({ building, onClose, onSelect }) {
  const mountRef = useRef(null), tipRef = useRef(null);
  const selRef = useRef(onSelect); selRef.current = onSelect;
  const [fp, setFp] = useState(null); // first-person 3D overlay: null=off, true=enter at the door, or a focused employee
  const fpRef = useRef(null); fpRef.current = emp => setFp(emp || true);
  const fpOpenRef = useRef(false); useEffect(() => { fpOpenRef.current = !!fp; }, [fp]);
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const all = building.members || [];
    let mgr = all[0] || null; all.forEach(e => { if (mgr && levelIndex(e.level) > levelIndex(mgr.level)) mgr = e; });
    const staff = all.filter(e => e !== mgr);
    const canvas = document.createElement("canvas"); canvas.style.display = "block"; canvas.style.cursor = "grab"; mount.appendChild(canvas);
    const ctx = canvas.getContext("2d"); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const TW = 46, TH = 23, WALLH = 40;
    let W = 1, H = 1;
    const HAIR = ["#2b2b2b", "#6b4f2a", "#3a2a1a", "#8a7b5a", "#1a1a1a", "#a85b34", "#cfcfcf"];
    // ── floor plan: a north strip of named rooms + clustered desk pods below ──
    const ZONE = 3.4, PODW = 3.4, nStaff = staff.length;
    const podN = Math.max(1, Math.ceil(nStaff / 4)), podCols = Math.max(1, Math.round(Math.sqrt(podN * 1.7))), podRows = Math.ceil(podN / podCols), workW = podCols * PODW;
    // is this an engineering / technical team? (drives lab + server room vs offices)
    const ENG_KW = /eng|verif|emul|silicon|hardware|software|firmware|rtl|asic|fpga|\blab\b|research|r&d|\bml\b|\bai\b|platform|infra|\bqa\b|\btest\b|devops|cloud|systems|robot|mechanical|electrical|physics|chip|semiconductor/i;
    let engN = 0; all.forEach(m => { if (ENG_KW.test((m.fn || "") + " " + (m.title || "") + " " + (m.bucket || ""))) engN++; });
    const isEng = building.style === "lab" || building.style === "factory" || ENG_KW.test(building.name || "") || (all.length > 0 && engN >= all.length * 0.4);
    const rooms = []; let rxc = 0;
    const addRoom = (kind, w) => { rooms.push({ kind, x0: rxc, y0: 0, x1: rxc + w, y1: ZONE }); rxc += w + 0.3; };
    addRoom("office", 3);
    if (isEng) { addRoom("server", 3); if (nStaff >= 6) addRoom("lab", 4.2); if (nStaff >= 8) addRoom("meet", 4); if (nStaff >= 11) addRoom("break", 4); }
    else { if (nStaff >= 6) addRoom("meet", 4); if (nStaff >= 8) addRoom("priv", 3.4); if (nStaff >= 11) addRoom("break", 4); if (nStaff >= 15) addRoom("lounge", 3.4); }
    const office = rooms.find(r => r.kind === "office"), meet = rooms.find(r => r.kind === "meet"), brk = rooms.find(r => r.kind === "break"), lounge = rooms.find(r => r.kind === "lounge"), server = rooms.find(r => r.kind === "server"), lab = rooms.find(r => r.kind === "lab"), priv = rooms.find(r => r.kind === "priv");
    const serverSpot = server ? { gx: (server.x0 + server.x1) / 2, gy: server.y1 - 0.8 } : null, labSpot = lab ? { gx: lab.x0 + 1.0, gy: lab.y1 - 1.0 } : null;
    const FW = Math.max(workW, rxc - 0.3, 6), FH = ZONE + podRows * PODW + 0.6;
    const mcx = meet ? (meet.x0 + meet.x1) / 2 : 0, mcy = meet ? (meet.y0 + meet.y1) / 2 + 0.1 : 0;
    const mseats = meet ? [[-1.15, 0], [1.15, 0], [-0.6, -0.7], [0.6, -0.7], [-0.6, 0.7], [0.6, 0.7]].map(([dx, dy]) => ({ gx: mcx + dx, gy: mcy + dy })) : [];
    const coffeeSpot = brk ? { gx: brk.x0 + 1.5, gy: brk.y0 + 1.1 } : { gx: 0, gy: ZONE };
    const errands = []; if (brk) errands.push({ gx: coffeeSpot.gx, gy: coffeeSpot.gy, ic: "☕" }); if (serverSpot) errands.push({ gx: serverSpot.gx, gy: serverSpot.gy, ic: "🔧" }); if (labSpot) errands.push({ gx: labSpot.gx, gy: labSpot.gy, ic: "🔬" });
    // staff home desks, clustered in pods of 4 with walking aisles between
    const desks = staff.map((e, i) => {
      const p = Math.floor(i / 4), sub = i % 4, col = p % podCols, row = Math.floor(p / podCols);
      return { e, gx: col * PODW + (sub % 2) * 1.05 + 0.5, gy: ZONE + row * PODW + Math.floor(sub / 2) * 1.2 + 0.5, dual: levelIndex(e.level) >= 6 };
    });
    const offDesk = { gx: office ? (office.x0 + office.x1) / 2 : 1.5, gy: office ? office.y1 - 1.0 : 1.5 };
    const mkW = (e, home, i, mgrFlag) => ({ e, home, x: home.gx, y: home.gy, tx: home.gx, ty: home.gy, state: "work", after: "work", t: 2 + Math.random() * 6, dwell: 3, skin: SKIN[(i * 13) % SKIN.length], hair: HAIR[(i * 7) % HAIR.length], bald: i % 9 === 4, senior: !!mgrFlag || (e ? levelIndex(e.level) >= 6 : false), dual: !!mgrFlag || (e ? levelIndex(e.level) >= 6 : false), isMgr: !!mgrFlag, bob: Math.random() * 6.28, seedi: i, idea: false, chatWith: null, inMeeting: false });
    const workers = desks.map((d, i) => mkW(d.e, d, i, false));
    if (mgr) workers.push(mkW(mgr, offDesk, 901, true));
    const meeting = { active: false, t: 8 + Math.random() * 8, roster: [], presenter: null };
    // static furniture (depth-sorted together with people each frame)
    const furn = [];
    desks.forEach(d => furn.push({ gx: d.gx, gy: d.gy, kind: "desk", d }));
    if (office) { furn.push({ gx: offDesk.gx, gy: offDesk.gy, kind: "execdesk" }); furn.push({ gx: office.x0 + 0.5, gy: office.y0 + 0.35, kind: "bookshelf" }); furn.push({ gx: office.x1 - 0.5, gy: office.y0 + 0.45, kind: "plant" }); }
    if (meet) { furn.push({ gx: mcx, gy: mcy, kind: "conftable" }); furn.push({ gx: mcx, gy: meet.y0 + 0.2, kind: "screen" }); }
    if (brk) { furn.push({ gx: (brk.x0 + brk.x1) / 2, gy: brk.y0 + 0.35, kind: "counter", r: brk }); furn.push({ gx: brk.x0 + 0.5, gy: brk.y0 + 0.5, kind: "fridge" }); furn.push({ gx: brk.x0 + 1.5, gy: brk.y0 + 0.5, kind: "coffee" }); furn.push({ gx: brk.x0 + 1.1, gy: brk.y1 - 0.9, kind: "rtable" }); furn.push({ gx: brk.x0 + 2.8, gy: brk.y1 - 0.9, kind: "rtable" }); }
    if (lounge) { const lcx = (lounge.x0 + lounge.x1) / 2; furn.push({ gx: lcx, gy: lounge.y0 + 0.8, kind: "couch" }); furn.push({ gx: lcx, gy: lounge.y0 + 1.6, kind: "ctable" }); furn.push({ gx: lounge.x1 - 0.4, gy: lounge.y1 - 0.4, kind: "plant" }); }
    if (server) { for (let i = 0; i < 3; i++) furn.push({ gx: server.x0 + 0.6 + i * 0.75, gy: server.y0 + 0.5, kind: "rack", seed: i * 7 + 1 }); furn.push({ gx: server.x1 - 0.5, gy: server.y1 - 0.7, kind: "rack", seed: 5 }); }
    if (lab) { furn.push({ gx: lab.x0 + 1.0, gy: lab.y0 + 0.6, kind: "bench", seed: 1 }); furn.push({ gx: lab.x0 + 2.6, gy: lab.y0 + 0.6, kind: "bench", seed: 2 }); furn.push({ gx: lab.x0 + 1.8, gy: lab.y1 - 0.8, kind: "bench", seed: 3 }); }
    if (priv) { furn.push({ gx: priv.x0 + 0.8, gy: priv.y0 + 0.9, kind: "privdesk" }); furn.push({ gx: priv.x1 - 0.8, gy: priv.y0 + 0.9, kind: "privdesk" }); furn.push({ gx: priv.x1 - 0.5, gy: priv.y1 - 0.5, kind: "plant" }); }
    const boards = []; const mkBoard = (r, frac) => { if (!r) return; const bw = (r.x1 - r.x0) * frac, cx = (r.x0 + r.x1) / 2; boards.push({ x0: cx - bw / 2, x1: cx + bw / 2, scr: genScribbles() }); };
    mkBoard(meet, 0.6); if (isEng) mkBoard(lab, 0.5);
    furn.push({ gx: -0.3, gy: ZONE + 0.4, kind: "cooler" });
    furn.push({ gx: FW - 0.5, gy: ZONE + 0.4, kind: "plant" });
    if (podCols >= 2 && nStaff >= 6) furn.push({ gx: workW - 0.6, gy: ZONE + 1.6, kind: "printer" });
    const cam = { ox: 0, oy: 0, zoom: 1 };
    function w2s(gx, gy) { return [((gx - gy) * TW / 2) * cam.zoom + cam.ox, ((gx + gy) * TH / 2) * cam.zoom + cam.oy]; }
    function poly(pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    const up = (p, d) => [p[0], p[1] - d];
    function shade(hex, fr) { const s = (hex || "#889").replace("#", ""); const n = s.length === 3 ? s.split("").map(x => x + x).join("") : s; const r = Math.min(255, Math.round(parseInt(n.slice(0, 2), 16) * fr)), g = Math.min(255, Math.round(parseInt(n.slice(2, 4), 16) * fr)), b = Math.min(255, Math.round(parseInt(n.slice(4, 6), 16) * fr)); return `rgb(${r},${g},${b})`; }
    function box(cgx, cgy, hx, hy, b0, b1, color) { // iso box from height b0..b1 (px) with footprint hx,hy (tiles)
      const A = w2s(cgx - hx, cgy - hy), B = w2s(cgx + hx, cgy - hy), C = w2s(cgx + hx, cgy + hy), D = w2s(cgx - hx, cgy + hy);
      const lo = p => [p[0], p[1] - b0], hf = p => [p[0], p[1] - b1];
      poly([lo(B), lo(C), hf(C), hf(B)], shade(color, 0.72));
      poly([lo(D), lo(C), hf(C), hf(D)], shade(color, 0.55));
      poly([hf(A), hf(B), hf(C), hf(D)], shade(color, 1.0));
    }
    function tile(gx, gy, c) { poly([w2s(gx - 0.5, gy - 0.5), w2s(gx + 0.5, gy - 0.5), w2s(gx + 0.5, gy + 0.5), w2s(gx - 0.5, gy + 0.5)], c); }
    function zoneAt(gx, gy) { for (const r of rooms) if (gx >= r.x0 - 0.5 && gx <= r.x1 - 0.5 && gy >= r.y0 - 0.5 && gy <= r.y1 - 0.5) return r.kind; return "work"; }
    function drawHair(hx, hy, w, z) { if (w.bald) return; ctx.fillStyle = w.hair; ctx.beginPath(); ctx.arc(hx, hy - 1.1 * z, 3.95 * z, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); }
    function statusIcon(w, x, y, z) { if (z < 0.55) return; let ic = ""; if (w.state === "errand") ic = w.errIc || "☕"; else if (w.state === "chat") ic = "💬"; else if (w.state === "sit" && meeting.presenter === w) ic = "📊"; else if (w.idea && w.state === "work") ic = "💡"; if (!ic) return; ctx.font = `${9 * z}px sans-serif`; ctx.textAlign = "center"; ctx.fillText(ic, x, y); }
    function nameTag(w, sx, sy, z) { if (z < 1.2) return; const nm = `${w.e.first} ${(w.e.last || "")[0] || ""}.`; ctx.textAlign = "center"; ctx.font = `${5.5 * z}px 'DM Sans', sans-serif`; const pw = ctx.measureText(nm).width + 4 * z; ctx.fillStyle = "rgba(2,8,23,0.72)"; ctx.fillRect(sx - pw / 2, sy + 4 * z, pw, 8 * z); ctx.fillStyle = "#dbe7ff"; ctx.fillText(nm, sx, sy + 10 * z); }
    function drawWorker(w, hi) {
      const z = cam.zoom, color = FN_COLORS[w.e.fn] || building.color || "#6b9", seated = w.state === "work" || w.state === "sit";
      if (seated) {
        const atDesk = w.state === "work", pB = w2s(w.x, w.y + 0.06), seatH = (atDesk ? 5.5 : 4.2) * z, torso = (w.senior ? 13 : 11) * z, bw = 5.5 * z, topY = pB[1] - seatH - torso;
        ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.beginPath(); ctx.ellipse(pB[0], pB[1] + 2 * z, 9 * z, 4 * z, 0, 0, 6.28); ctx.fill();
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(pB[0] - bw, pB[1] - seatH); ctx.lineTo(pB[0] + bw, pB[1] - seatH); ctx.lineTo(pB[0] + bw * 0.65, topY); ctx.lineTo(pB[0] - bw * 0.65, topY); ctx.closePath(); ctx.fill();
        const hT = w2s(w.x, w.y - (atDesk ? 0.10 : 0.16)), dip = Math.sin(clock * 9 + w.bob) * 1.6 * z, handY = hT[1] - (atDesk ? 9 : 5) * z;
        ctx.strokeStyle = shade(color, 0.82); ctx.lineWidth = 2.4 * z; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(pB[0] - bw * 0.7, topY + torso * 0.5); ctx.lineTo(pB[0] - 2.5 * z, handY + (atDesk ? dip : 0)); ctx.moveTo(pB[0] + bw * 0.7, topY + torso * 0.5); ctx.lineTo(pB[0] + 2.5 * z, handY - (atDesk ? dip : 0)); ctx.stroke();
        ctx.fillStyle = w.skin; ctx.beginPath(); ctx.arc(pB[0], topY - 3.5 * z, 3.8 * z, 0, 6.28); ctx.fill(); drawHair(pB[0], topY - 3.5 * z, w, z);
        if (w.senior) { ctx.fillStyle = "#fde047"; ctx.fillRect(pB[0] - 1 * z, topY, 2 * z, torso * 0.45); }
        if (hi) { ctx.strokeStyle = "#fde047"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pB[0], topY + torso * 0.3, 13 * z, 0, 6.28); ctx.stroke(); }
        statusIcon(w, pB[0], topY - 9 * z, z); nameTag(w, pB[0], pB[1], z);
      } else {
        const base = w2s(w.x, w.y), torso = (w.senior ? 15 : 13) * z, bw = 5.2 * z, hipY = base[1] - 8 * z, topY = hipY - torso, stride = w.state === "walk" ? Math.sin(w.bob) * 3 * z : 0;
        ctx.fillStyle = "rgba(0,0,0,0.26)"; ctx.beginPath(); ctx.ellipse(base[0], base[1] + 1 * z, 6.5 * z, 3 * z, 0, 0, 6.28); ctx.fill();
        ctx.strokeStyle = "#2c3242"; ctx.lineWidth = 2.6 * z; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(base[0] - 1.5 * z, hipY); ctx.lineTo(base[0] - 1.5 * z + stride, base[1]); ctx.moveTo(base[0] + 1.5 * z, hipY); ctx.lineTo(base[0] + 1.5 * z - stride, base[1]); ctx.stroke();
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(base[0] - bw, hipY); ctx.lineTo(base[0] + bw, hipY); ctx.lineTo(base[0] + bw * 0.7, topY); ctx.lineTo(base[0] - bw * 0.7, topY); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = shade(color, 0.85); ctx.lineWidth = 2.4 * z;
        if (w.state === "errand") { ctx.beginPath(); ctx.moveTo(base[0] + bw * 0.6, topY + torso * 0.4); ctx.lineTo(base[0] + 5 * z, topY + torso * 0.62); ctx.stroke(); if (w.errIc === "☕") { ctx.fillStyle = "#fff"; ctx.fillRect(base[0] + 3.6 * z, topY + torso * 0.55, 3 * z, 4 * z); } }
        else { const sw = stride * 0.6; ctx.beginPath(); ctx.moveTo(base[0] - bw * 0.7, topY + torso * 0.3); ctx.lineTo(base[0] - bw * 0.85 - sw, hipY + 1 * z); ctx.moveTo(base[0] + bw * 0.7, topY + torso * 0.3); ctx.lineTo(base[0] + bw * 0.85 + sw, hipY + 1 * z); ctx.stroke(); }
        ctx.fillStyle = w.skin; ctx.beginPath(); ctx.arc(base[0], topY - 4 * z, 3.8 * z, 0, 6.28); ctx.fill(); drawHair(base[0], topY - 4 * z, w, z);
        if (w.senior) { ctx.fillStyle = "#fde047"; ctx.fillRect(base[0] - 1 * z, topY, 2 * z, torso * 0.4); }
        if (hi) { ctx.strokeStyle = "#fde047"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(base[0], topY + torso * 0.2, 14 * z, 0, 6.28); ctx.stroke(); }
        statusIcon(w, base[0], topY - 9 * z, z); nameTag(w, base[0], base[1], z);
      }
    }
    function chairAt(gx, gy, z, back) { box(gx, gy, 0.12, 0.05, 5.5 * z, 5.5 * z + (back ? 11 : 6) * z, "#3a4866"); box(gx, gy + 0.06, 0.13, 0.13, 0, 5.5 * z, "#2f3a52"); }
    function drawFurn(f) {
      const z = cam.zoom, s = w2s(f.gx, f.gy);
      if (f.kind === "desk") {
        const deskH = 8 * z, d = f.d;
        box(f.gx, f.gy - 0.18, 0.30, 0.16, 0, deskH, "#7a5a3a"); box(f.gx, f.gy - 0.18, 0.35, 0.20, deskH - 1.5 * z, deskH, "#8a6a44");
        box(f.gx, f.gy - 0.26, 0.08, 0.04, deskH, deskH + 8 * z, "#15181f");
        if (d.dual) { box(f.gx - 0.17, f.gy - 0.24, 0.07, 0.04, deskH, deskH + 7 * z, "#15181f"); box(f.gx + 0.17, f.gy - 0.24, 0.07, 0.04, deskH, deskH + 7 * z, "#15181f"); }
        const ml = w2s(f.gx - 0.08, f.gy - 0.22), mr = w2s(f.gx + 0.08, f.gy - 0.22), fl = 0.55 + 0.4 * Math.abs(Math.sin(clock * 5 + f.gx));
        poly([[ml[0], ml[1] - deskH - 1.5 * z], [mr[0], mr[1] - deskH - 1.5 * z], [mr[0], mr[1] - deskH - 7 * z], [ml[0], ml[1] - deskH - 7 * z]], `rgba(120,220,255,${fl})`);
        chairAt(f.gx, f.gy, z, true);
        const pp = w2s(f.gx + 0.16, f.gy - 0.14); ctx.fillStyle = "#e6e0d2"; ctx.fillRect(pp[0] - 1.5 * z, pp[1] - deskH - 2 * z, 3 * z, 2.4 * z);
        const mu = w2s(f.gx - 0.17, f.gy - 0.12); ctx.fillStyle = "#d2654f"; ctx.beginPath(); ctx.arc(mu[0], mu[1] - deskH - 1 * z, 1.5 * z, 0, 6.28); ctx.fill();
        const la = w2s(f.gx + 0.22, f.gy - 0.18); ctx.strokeStyle = "#3b4250"; ctx.lineWidth = 1.4 * z; ctx.beginPath(); ctx.moveTo(la[0], la[1] - deskH); ctx.lineTo(la[0], la[1] - deskH - 6 * z); ctx.lineTo(la[0] - 3 * z, la[1] - deskH - 6.5 * z); ctx.stroke();
      } else if (f.kind === "execdesk") {
        const deskH = 9 * z;
        box(f.gx, f.gy, 0.5, 0.22, 0, deskH, "#5b3f28"); box(f.gx, f.gy, 0.56, 0.27, deskH - 2 * z, deskH, "#6e4f33");
        box(f.gx, f.gy - 0.1, 0.1, 0.05, deskH, deskH + 9 * z, "#15181f");
        chairAt(f.gx, f.gy + 0.22, z, true);
      } else if (f.kind === "bookshelf") {
        box(f.gx, f.gy, 0.5, 0.1, 0, 22 * z, "#6a4a30");
        const a = w2s(f.gx - 0.45, f.gy - 0.08), c = ["#b5443a", "#3f6ea5", "#c9a23f", "#4a8d5b"]; for (let r = 0; r < 3; r++) for (let b = 0; b < 6; b++) { ctx.fillStyle = c[(r + b) % 4]; ctx.fillRect(a[0] + b * 2.0 * z, a[1] - 6 * z - r * 6.5 * z, 1.7 * z, 6 * z); }
      } else if (f.kind === "plant") {
        box(f.gx, f.gy, 0.1, 0.1, 0, 6 * z, "#7a4a30"); ctx.fillStyle = "#3f8f48"; ctx.beginPath(); ctx.arc(s[0], s[1] - 9 * z, 6.5 * z, 0, 6.28); ctx.fill(); ctx.fillStyle = "#56b061"; ctx.beginPath(); ctx.arc(s[0] - 3 * z, s[1] - 12 * z, 4.5 * z, 0, 6.28); ctx.fill();
      } else if (f.kind === "cooler") {
        box(f.gx, f.gy, 0.12, 0.12, 0, 9 * z, "#dfe7ef"); ctx.fillStyle = "#5cb3e6"; ctx.beginPath(); ctx.arc(s[0], s[1] - 13 * z, 4 * z, 0, 6.28); ctx.fill();
        const bb = (clock * 2) % 1; ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - bb)})`; ctx.beginPath(); ctx.arc(s[0], s[1] - 13 * z - bb * 4 * z, 1.2 * z, 0, 6.28); ctx.fill();
      } else if (f.kind === "coffee") {
        box(f.gx, f.gy, 0.12, 0.1, 9 * z, 18 * z, "#2b2f3a"); const cc = w2s(f.gx, f.gy); ctx.fillStyle = "#c44"; ctx.fillRect(cc[0] - 2 * z, cc[1] - 21 * z, 4 * z, 2 * z);
      } else if (f.kind === "fridge") {
        box(f.gx, f.gy, 0.16, 0.14, 0, 20 * z, "#cfd6de"); const fc = w2s(f.gx + 0.16, f.gy - 0.14); ctx.fillStyle = "#9aa3b0"; ctx.fillRect(fc[0] - 1 * z, fc[1] - 14 * z, 1.5 * z, 5 * z);
      } else if (f.kind === "counter") {
        const r = f.r, cx2 = (r.x0 + r.x1) / 2, hw = (r.x1 - r.x0) / 2 - 0.2; box(cx2, r.y0 + 0.35, hw, 0.16, 0, 9 * z, "#9aa6b4"); box(cx2, r.y0 + 0.35, hw, 0.18, 7.5 * z, 9 * z, "#c4ccd6");
      } else if (f.kind === "rtable") {
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(s[0], s[1] + 2 * z, 9 * z, 4 * z, 0, 0, 6.28); ctx.fill();
        box(f.gx, f.gy, 0.06, 0.06, 0, 7 * z, "#8a8f98"); ctx.fillStyle = "#dfe4ea"; ctx.beginPath(); ctx.ellipse(s[0], s[1] - 7 * z, 9 * z, 4.4 * z, 0, 0, 6.28); ctx.fill();
        for (const a of [0, 2.1, 4.2]) box(f.gx + Math.cos(a) * 0.5, f.gy + Math.sin(a) * 0.3, 0.06, 0.06, 0, 5 * z, "#5b6478");
      } else if (f.kind === "couch") {
        box(f.gx, f.gy, 0.45, 0.16, 0, 6 * z, "#48648f"); box(f.gx, f.gy - 0.12, 0.45, 0.05, 6 * z, 13 * z, "#3c557c"); box(f.gx - 0.42, f.gy, 0.05, 0.16, 0, 9 * z, "#3c557c"); box(f.gx + 0.42, f.gy, 0.05, 0.16, 0, 9 * z, "#3c557c");
      } else if (f.kind === "ctable") {
        box(f.gx, f.gy, 0.22, 0.12, 0, 4 * z, "#6a4a32"); box(f.gx, f.gy, 0.26, 0.15, 3 * z, 4 * z, "#7a5a3a");
      } else if (f.kind === "conftable") {
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(s[0], s[1] + 3 * z, 24 * z, 10 * z, 0, 0, 6.28); ctx.fill();
        box(f.gx, f.gy, 0.95, 0.42, 0, 7.5 * z, "#5a4632"); box(f.gx, f.gy, 1.02, 0.48, 6 * z, 7.5 * z, "#6e573c");
      } else if (f.kind === "screen") {
        box(f.gx, f.gy, 0.5, 0.04, 12 * z, 30 * z, "#10131b");
        const a = w2s(f.gx - 0.46, f.gy), b = w2s(f.gx + 0.46, f.gy), sl = Math.floor(clock / 3) % 3;
        ctx.fillStyle = ["#2d6cdf", "#28a36b", "#d98a3a"][sl]; poly([[a[0], a[1] - 13 * z], [b[0], b[1] - 13 * z], [b[0], b[1] - 29 * z], [a[0], a[1] - 29 * z]], ctx.fillStyle);
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect((a[0] + b[0]) / 2 - 10 * z, a[1] - 24 * z, 20 * z, 2 * z); ctx.fillRect((a[0] + b[0]) / 2 - 7 * z, a[1] - 20 * z, 14 * z, 2 * z);
      } else if (f.kind === "printer") {
        box(f.gx, f.gy, 0.14, 0.12, 0, 11 * z, "#3a4150"); box(f.gx, f.gy, 0.15, 0.13, 11 * z, 13 * z, "#525b6c"); const pc = w2s(f.gx, f.gy - 0.1); ctx.fillStyle = "#e8edf2"; ctx.fillRect(pc[0] - 2 * z, pc[1] - 13 * z, 4 * z, 3 * z);
      } else if (f.kind === "rack") {
        box(f.gx, f.gy, 0.16, 0.14, 0, 26 * z, "#20262f"); box(f.gx, f.gy, 0.17, 0.15, 26 * z, 28 * z, "#2b323d");
        const c = w2s(f.gx, f.gy + 0.14); for (let r = 0; r < 8; r++) for (let cc = 0; cc < 2; cc++) { const on = Math.sin(clock * (3 + (r + cc + f.seed) % 5) + r * 1.7 + cc * 2) > 0; ctx.fillStyle = on ? (((r + cc) % 3) ? "#46e07a" : "#ffcf4d") : "#173024"; ctx.fillRect(c[0] - 5 * z + cc * 6 * z, c[1] - 9 * z - r * 2.7 * z, 2.4 * z, 1.6 * z); }
      } else if (f.kind === "bench") {
        const bh = 8 * z; box(f.gx, f.gy, 0.42, 0.18, 0, bh, "#8a9099"); box(f.gx, f.gy, 0.46, 0.22, bh - 1.5 * z, bh, "#aeb6bf");
        const o = w2s(f.gx - 0.22, f.gy - 0.04); box(f.gx - 0.22, f.gy - 0.04, 0.08, 0.05, bh, bh + 9 * z, "#22282f"); ctx.strokeStyle = "#46e07a"; ctx.lineWidth = 1.2 * z; ctx.beginPath(); for (let i = 0; i <= 10; i++) { const xx = o[0] - 3 * z + i * 0.6 * z, yy = o[1] - bh - 4 * z + Math.sin(clock * 4 + i + f.seed) * 2 * z; i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
        const d = w2s(f.gx + 0.18, f.gy - 0.02); box(f.gx + 0.18, f.gy - 0.02, 0.07, 0.05, bh, bh + 5 * z, "#3a4658"); ctx.fillStyle = Math.sin(clock * 5 + f.seed) > 0 ? "#ff5a5a" : "#5a2222"; ctx.beginPath(); ctx.arc(d[0], d[1] - bh - 4 * z, 1.3 * z, 0, 6.28); ctx.fill();
        const si = w2s(f.gx, f.gy + 0.05); ctx.fillStyle = "rgba(255,140,60,0.85)"; ctx.beginPath(); ctx.arc(si[0], si[1] - bh, 1.2 * z, 0, 6.28); ctx.fill();
        box(f.gx, f.gy + 0.3, 0.07, 0.07, 0, 6 * z, "#444b55");
      } else if (f.kind === "privdesk") {
        const dh = 8 * z; box(f.gx, f.gy - 0.12, 0.26, 0.14, 0, dh, "#6e4f33"); box(f.gx, f.gy - 0.12, 0.30, 0.17, dh - 1.5 * z, dh, "#7d5b3c");
        box(f.gx, f.gy - 0.18, 0.07, 0.04, dh, dh + 7 * z, "#15181f"); chairAt(f.gx, f.gy, z, true);
      }
    }
    function goTo(w, tgt, after, dwell) { w.tx = tgt.gx; w.ty = tgt.gy; w.state = "walk"; w.after = after; w.dwell = dwell; }
    function goHome(w) { w.tx = w.home.gx; w.ty = w.home.gy; w.state = "walk"; w.after = "return"; }
    function chooseNext(w) {
      const r = Math.random();
      if (errands.length && r < 0.24) { const er = errands[Math.floor(Math.random() * errands.length)]; w.errIc = er.ic; goTo(w, er, "errand", 2.5 + Math.random() * 3); }
      else if (r < 0.30 && desks.length > 1) { const o = desks[Math.floor(Math.random() * desks.length)]; w.chatWith = o; goTo(w, { gx: o.gx + 0.5, gy: o.gy + 0.5 }, "chat", 2.5 + Math.random() * 3); }
      else { w.state = "work"; w.t = 4 + Math.random() * 7; w.x = w.home.gx; w.y = w.home.gy; w.idea = Math.random() < 0.25; }
    }
    function updWorker(w, dt) {
      if (w.state === "walk") {
        const dx = w.tx - w.x, dy = w.ty - w.y, dist = Math.hypot(dx, dy);
        if (dist < 0.05) { w.x = w.tx; w.y = w.ty; w.state = w.after; w.t = w.dwell || 3; } else { const step = Math.min(dist, 2.0 * dt); w.x += dx / dist * step; w.y += dy / dist * step; w.bob += dt * 9; }
        return;
      }
      if (w.state === "sit") return;
      if (w.state === "errand" || w.state === "chat") { w.t -= dt; if (w.t <= 0) { w.chatWith = null; goHome(w); } return; }
      if (w.state === "return") { w.state = "work"; w.t = 3 + Math.random() * 6; w.x = w.home.gx; w.y = w.home.gy; return; }
      if (!w.inMeeting) { w.t -= dt; if (w.t <= 0) chooseNext(w); }
      if (w.state === "work") { w.x = w.home.gx; w.y = w.home.gy; }
    }
    function updMeeting(dt) {
      if (!meet) return; meeting.t -= dt;
      if (!meeting.active && meeting.t <= 0) {
        const avail = workers.filter(w => !w.inMeeting && w.state === "work"); for (let i = avail.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const tmp = avail[i]; avail[i] = avail[j]; avail[j] = tmp; }
        const k = Math.min(mseats.length, Math.max(2, Math.round(avail.length * 0.35))); meeting.roster = avail.slice(0, k);
        meeting.roster.forEach((w, i) => { w.inMeeting = true; w.chatWith = null; goTo(w, mseats[i], "sit", 99); });
        meeting.presenter = meeting.roster[0] || null; meeting.active = true; meeting.t = 14 + Math.random() * 10;
      } else if (meeting.active && meeting.t <= 0) {
        meeting.roster.forEach(w => { w.inMeeting = false; goHome(w); }); meeting.roster = []; meeting.presenter = null; meeting.active = false; meeting.t = 12 + Math.random() * 14;
      }
    }
    function genScribbles() {
      const out = [];
      out.push({ t: "rect", x: 0.08, y: 0.3, w: 0.16, h: 0.2, c: "#2d6cdf" });
      out.push({ t: "rect", x: 0.42, y: 0.3, w: 0.16, h: 0.2, c: "#2d6cdf" });
      out.push({ t: "arrow", x1: 0.24, y1: 0.4, x2: 0.42, y2: 0.4, c: "#1b2330" });
      out.push({ t: "arrow", x1: 0.58, y1: 0.4, x2: 0.74, y2: 0.32 + Math.random() * 0.16, c: "#1b2330" });
      out.push({ t: "wave", x: 0.62, y: 0.74, w: 0.3, a: 0.05 + Math.random() * 0.04, c: "#cc3b3b" });
      for (let i = 0; i < 3; i++) { const yy = 0.6 + i * 0.1; out.push({ t: "dot", x: 0.1, y: yy, c: "#1b2330" }); out.push({ t: "line", x1: 0.14, y1: yy, x2: 0.32 + Math.random() * 0.12, y2: yy, c: "#1b2330" }); }
      out.push({ t: "tri", x: 0.78, y: 0.12, s: 0.13, c: "#2a9d5b" });
      return out;
    }
    function drawBoards() {
      const z = cam.zoom, wh = WALLH * z; if (z < 0.32) return;
      boards.forEach(bd => {
        const vLo = wh * 0.42, vHi = wh * 0.82, map = (u, y) => { const p = w2s(bd.x0 + u * (bd.x1 - bd.x0), -0.5); return [p[0], p[1] - (vLo + (1 - y) * (vHi - vLo))]; };
        const c0 = map(0, 0), c1 = map(1, 0), c2 = map(1, 1), c3 = map(0, 1);
        poly([c0, c1, c2, c3], "#eef2f5"); ctx.strokeStyle = "#9aa6b2"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(c0[0], c0[1]); ctx.lineTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(c3[0], c3[1]); ctx.closePath(); ctx.stroke();
        if (z < 0.5) return;
        bd.scr.forEach(s => {
          ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineWidth = 1.3 * z; ctx.lineCap = "round";
          if (s.t === "rect") { const p = [map(s.x, s.y), map(s.x + s.w, s.y), map(s.x + s.w, s.y + s.h), map(s.x, s.y + s.h)]; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); ctx.stroke(); }
          else if (s.t === "line") { const a = map(s.x1, s.y1), b = map(s.x2, s.y2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
          else if (s.t === "arrow") { const a = map(s.x1, s.y1), b = map(s.x2, s.y2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] - Math.cos(ang - 0.4) * 4 * z, b[1] - Math.sin(ang - 0.4) * 4 * z); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0] - Math.cos(ang + 0.4) * 4 * z, b[1] - Math.sin(ang + 0.4) * 4 * z); ctx.stroke(); }
          else if (s.t === "wave") { ctx.beginPath(); for (let i = 0; i <= 16; i++) { const p = map(s.x + (i / 16) * s.w, s.y + Math.sin(i * 0.8) * s.a); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke(); }
          else if (s.t === "dot") { const p = map(s.x, s.y); ctx.beginPath(); ctx.arc(p[0], p[1], 1.4 * z, 0, 6.28); ctx.fill(); }
          else if (s.t === "tri") { const p = [map(s.x, s.y + s.s), map(s.x + s.s, s.y + s.s), map(s.x + s.s / 2, s.y)]; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.closePath(); ctx.stroke(); }
        });
      });
    }
    function fit() {
      const spanX = (FW + FH) * TW / 2, spanY = (FW + FH) * TH / 2 + WALLH + 30;
      cam.zoom = Math.max(0.28, Math.min(2.4, Math.min((W * 0.92) / Math.max(1, spanX), (H * 0.8) / Math.max(1, spanY))));
      const cx = (FW - 1) / 2, cy = (FH - 1) / 2;
      cam.ox = W / 2 - ((cx - cy) * TW / 2) * cam.zoom;
      cam.oy = H / 2 - ((cx + cy) * TH / 2) * cam.zoom + WALLH * 0.4;
    }
    let raf = 0, last = performance.now(), clock = 0, hover = -1;
    function frame(now) {
      if (document.hidden || fpOpenRef.current) { last = now; raf = requestAnimationFrame(frame); return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
      const tod = timeOfDay(), sky = skyState(tod), z = cam.zoom, wh = WALLH * z;
      workers.forEach(w => updWorker(w, dt)); updMeeting(dt);
      ctx.fillStyle = "#0e1018"; ctx.fillRect(0, 0, W, H);
      for (let x = 0; x < Math.ceil(FW); x++) for (let y = 0; y < Math.ceil(FH); y++) { const zk = zoneAt(x, y); let c; if (zk === "office") c = (x + y) % 2 ? "#544066" : "#5b4a6e"; else if (zk === "meet") c = (x + y) % 2 ? "#39506e" : "#3f5a7a"; else if (zk === "break") c = (x + y) % 2 ? "#646b78" : "#6c7480"; else if (zk === "lounge") c = (x + y) % 2 ? "#6f5446" : "#7a5a4a"; else if (zk === "server") c = (x + y) % 2 ? "#1f2a3a" : "#243043"; else if (zk === "lab") c = (x + y) % 2 ? "#ccd5dc" : "#d6dee4"; else if (zk === "priv") c = (x + y) % 2 ? "#5a4e44" : "#63564a"; else c = (x + y) % 2 ? "#3a4150" : "#424a5b"; tile(x, y, c); }
      const Nc = w2s(-0.5, -0.5), Lc = w2s(-0.5, FH - 0.5), Rc = w2s(FW - 0.5, -0.5);
      poly([Nc, Lc, up(Lc, wh), up(Nc, wh)], "#2a2f3d"); poly([Nc, Rc, up(Rc, wh), up(Nc, wh)], "#343b4d");
      const winCol = rgbStr(mix([24, 30, 46], hexRGB("bfe3ff"), sky.day)); // window shows the sky outside
      for (let g = 0.5; g < FH; g += 2) { const a = w2s(-0.5, g), b = w2s(-0.5, g + 0.9); poly([up(a, wh * 0.82), up(b, wh * 0.82), up(b, wh * 0.42), up(a, wh * 0.42)], winCol); ctx.fillStyle = "rgba(18,26,46,0.7)"; const sb = up(a, wh * 0.5); ctx.fillRect(sb[0] + 2 * z, sb[1] - 5 * z, 3 * z, 7 * z); }
      for (let g = 0.5; g < FW; g += 2) { const a = w2s(g, -0.5), b = w2s(g + 0.9, -0.5); poly([up(a, wh * 0.82), up(b, wh * 0.82), up(b, wh * 0.42), up(a, wh * 0.42)], winCol); ctx.fillStyle = "rgba(18,26,46,0.7)"; const sb = up(b, wh * 0.5); ctx.fillRect(sb[0] - 5 * z, sb[1] - 6 * z, 3 * z, 8 * z); }
      drawBoards(); // whiteboards on the back wall
      if (server) { ctx.save(); ctx.globalCompositeOperation = "lighter"; const c = w2s((server.x0 + server.x1) / 2, server.y0 + 1); blitGlow(ctx, c[0], c[1], 52 * z, 28 * z, "60,120,210", 0.12); ctx.restore(); }
      ctx.save(); ctx.globalCompositeOperation = "lighter"; // soft ceiling lighting pools
      for (let x = 1.2; x < FW; x += 2.6) for (let y = ZONE - 1; y < FH; y += 2.6) { const c = w2s(x, y), R = 34 * z; blitGlow(ctx, c[0], c[1], R, R * 0.5, "255,250,235", 0.05 + 0.05 * sky.day); }
      ctx.restore();
      const items = [];
      furn.forEach(f => items.push({ k: f.gx + f.gy, f }));
      workers.forEach(w => items.push({ k: w.x + w.y + 0.02, w }));
      items.sort((a, b) => a.k - b.k);
      items.forEach(it => { if (it.f) drawFurn(it.f); else drawWorker(it.w, workers[hover] === it.w); });
      [office, meet].forEach(r => { if (!r) return; const midx = (r.x0 + r.x1) / 2, gh = 15 * z, seg = (x0, x1) => { const a = w2s(x0, r.y1 - 0.5), b = w2s(x1, r.y1 - 0.5); poly([a, b, up(b, gh), up(a, gh)], "rgba(150,190,235,0.16)"); ctx.strokeStyle = "rgba(200,225,255,0.5)"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(up(a, gh)[0], up(a, gh)[1]); ctx.lineTo(up(b, gh)[0], up(b, gh)[1]); ctx.stroke(); }; seg(r.x0 - 0.5, midx - 0.6); seg(midx + 0.6, r.x1 - 0.5); }); // glass partitions
      if (z > 0.5) { ctx.textAlign = "center"; ctx.font = `${6.5 * z}px 'DM Sans', sans-serif`; const plaque = (r, t) => { if (!r) return; const p = w2s((r.x0 + r.x1) / 2, r.y0 - 0.4), pw = ctx.measureText(t).width + 6 * z; ctx.fillStyle = "rgba(2,8,23,0.55)"; ctx.fillRect(p[0] - pw / 2, p[1] - 6 * z, pw, 9 * z); ctx.fillStyle = "#cfe0ff"; ctx.fillText(t, p[0], p[1] + 1 * z); }; plaque(office, "👔 " + (mgr ? mgr.first + "'s Office" : "Office")); plaque(meet, meeting.active ? "Meeting (live)" : "Meeting Room"); plaque(brk, "☕ Break Room"); plaque(lounge, "Lounge"); plaque(server, "🖥️ Server Room"); plaque(lab, "🔬 Lab"); plaque(priv, "Offices"); }
      // night: dim the room; monitors + coffee machine glow
      if (sky.night > 0.02) {
        ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = rgbStr(mix([255, 255, 255], [42, 50, 84], sky.night * 0.6)); ctx.fillRect(0, 0, W, H); ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        desks.forEach(d => { const m = w2s(d.gx, d.gy - 0.22), cy = m[1] - 12 * z, R = 14 * z; blitGlow(ctx, m[0], cy, R, R, "120,210,255", 0.5 * sky.night); });
        if (brk) { const c = w2s(brk.x0 + 1.5, brk.y0 + 0.5); blitGlow(ctx, c[0], c[1] - 12 * z, 16 * z, 16 * z, "255,180,90", 0.45 * sky.night); }
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }
    function pick(mx, my) { let best = -1, bd = 15 * cam.zoom; for (let i = 0; i < workers.length; i++) { const w = workers[i], s = w2s(w.x, w.y), cy = s[1] - (w.state === "work" || w.state === "sit" ? 16 : 18) * cam.zoom; const dd = Math.hypot(mx - s[0], my - cy); if (dd < bd) { bd = dd; best = i; } } return best; }
    let dragging = false, lx = 0, ly = 0, moved = false;
    function onDown(e) { dragging = true; moved = false; lx = e.clientX; ly = e.clientY; canvas.style.cursor = "grabbing"; }
    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      if (dragging) { cam.ox += e.clientX - lx; cam.oy += e.clientY - ly; lx = e.clientX; ly = e.clientY; moved = true; return; }
      const mx = e.clientX - rect.left, my = e.clientY - rect.top, h = pick(mx, my); hover = h;
      const tip = tipRef.current;
      if (h >= 0 && tip) { const e2 = workers[h].e; tip.style.display = "block"; tip.style.left = (mx + 14) + "px"; tip.style.top = (my + 12) + "px"; tip.innerHTML = `<b>${e2.first} ${e2.last}</b><br/>${(e2.title || "").replace(/[<>]/g, "")}<br/>${displayLevel(e2.level)}`; canvas.style.cursor = "pointer"; }
      else if (tip) { tip.style.display = "none"; canvas.style.cursor = "grab"; }
    }
    function onUp() { dragging = false; canvas.style.cursor = "grab"; }
    function onClick(e) { if (moved) return; const rect = canvas.getBoundingClientRect(); const h = pick(e.clientX - rect.left, e.clientY - rect.top); if (h >= 0) fpRef.current(workers[h].e); } // click a person → walk in first person
    function onWheel(e) { e.preventDefault(); const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top, k = e.deltaY < 0 ? 1.12 : 1 / 1.12, nz = Math.max(0.3, Math.min(3, cam.zoom * k)), f = nz / cam.zoom; cam.ox = mx - (mx - cam.ox) * f; cam.oy = my - (my - cam.oy) * f; cam.zoom = nz; }
    canvas.addEventListener("pointerdown", onDown); window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); canvas.addEventListener("click", onClick); canvas.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(() => { W = mount.clientWidth || 800; H = mount.clientHeight || 600; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px"; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fit(); });
    ro.observe(mount);
    W = mount.clientWidth || 800; H = mount.clientHeight || 600; canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px"; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fit();
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener("pointerdown", onDown); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); canvas.removeEventListener("click", onClick); canvas.removeEventListener("wheel", onWheel); if (canvas.parentNode === mount) mount.removeChild(canvas); };
  }, [building]);
  return (
    <div className="absolute inset-0 z-30" style={{ background: "#0e1018" }}>
      <div ref={mountRef} className="absolute inset-0" />
      <div ref={tipRef} className="absolute pointer-events-none px-2 py-1 rounded text-white text-xs" style={{ display: "none", background: "rgba(15,23,42,0.92)", border: "1px solid rgba(148,163,184,0.4)", zIndex: 20, lineHeight: 1.4 }} />
      <button onClick={onClose} className="absolute top-3 left-3 z-10 text-xs px-3 py-1.5 rounded-lg bg-white/90 text-gray-700 hover:bg-white font-medium shadow">← Back to city</button>
      <button onClick={() => setFp(true)} className="absolute top-3 left-32 z-10 text-xs px-3 py-1.5 rounded-lg bg-indigo-600/90 text-white hover:bg-indigo-600 font-medium shadow">🎮 First person</button>
      <div className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-md text-white" style={{ fontSize: 12, background: "rgba(2,8,23,0.6)", backdropFilter: "blur(4px)" }}>
        🏢 {building.name} <span style={{ opacity: 0.8, fontWeight: 400 }}>· {building.bu} · {(building.members || []).length} people</span>
      </div>
      <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-md" style={{ fontSize: 11, background: "rgba(2,8,23,0.5)", color: "#dbe7ff" }}>a working floor — engineering teams get a server room (🖥️) & lab (🔬) with whiteboards; other teams get offices & lounges · <b>click anyone to walk the floor in first-person 3D</b> · gold tie = a lead · hover for a name · drag/scroll to look</div>
      {fp && <BuildingFP3D building={building} focusEmp={fp === true ? null : fp} onClose={() => setFp(null)} onSelect={onSelect} />}
    </div>
  );
}

// First-person 3D walkthrough of a building's floor. three.js (lazy-loaded, UMD global THREE);
// the room is rebuilt from the same floor-plan heuristics as the 2D view, and every employee is
// an instanced 3D figure. Pointer-lock mouse-look + WASD; crosshair-click opens a person's card.
function BuildingFP3D({ building, focusEmp, onClose, onSelect }) {
  const mountRef = useRef(null), tipRef = useRef(null);
  const selRef = useRef(onSelect); selRef.current = onSelect;
  const [ready, setReady] = useState(typeof THREE !== "undefined");
  const [locked, setLocked] = useState(false);
  useEffect(() => { if (ready) return; let alive = true; loadThree().then(() => alive && setReady(true)).catch(() => {}); return () => { alive = false; }; }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const mount = mountRef.current; if (!mount) return;

    // ----- floor plan (mirrors the 2D interior heuristics) -----
    const all = building.members || [];
    let mgr = all[0] || null; all.forEach(e => { if (mgr && levelIndex(e.level) > levelIndex(mgr.level)) mgr = e; });
    const staff = all.filter(e => e !== mgr), nStaff = staff.length;
    const ZONE = 3.4, PODW = 3.4;
    const podN = Math.max(1, Math.ceil(nStaff / 4)), podCols = Math.max(1, Math.round(Math.sqrt(podN * 1.7))), podRows = Math.ceil(podN / podCols), workW = podCols * PODW;
    const ENG_KW = /eng|verif|emul|silicon|hardware|software|firmware|rtl|asic|fpga|\blab\b|research|r&d|\bml\b|\bai\b|platform|infra|\bqa\b|\btest\b|devops|cloud|systems|robot|mechanical|electrical|physics|chip|semiconductor/i;
    let engN = 0; all.forEach(m => { if (ENG_KW.test((m.fn || "") + " " + (m.title || "") + " " + (m.bucket || ""))) engN++; });
    const isEng = building.style === "lab" || building.style === "factory" || ENG_KW.test(building.name || "") || (all.length > 0 && engN >= all.length * 0.4);
    const rooms = []; let rxc = 0; const addRoom = (k, w) => { rooms.push({ kind: k, x0: rxc, x1: rxc + w }); rxc += w + 0.3; };
    addRoom("office", 3);
    if (isEng) { addRoom("server", 3); if (nStaff >= 6) addRoom("lab", 4.2); if (nStaff >= 8) addRoom("meet", 4); if (nStaff >= 11) addRoom("break", 4); }
    else { if (nStaff >= 6) addRoom("meet", 4); if (nStaff >= 8) addRoom("priv", 3.4); if (nStaff >= 11) addRoom("break", 4); if (nStaff >= 15) addRoom("lounge", 3.4); }
    const FW = Math.max(workW, rxc - 0.3, 6), FH = ZONE + podRows * PODW + 0.6;
    const office = rooms.find(r => r.kind === "office");
    const offDesk = { x: office ? (office.x0 + office.x1) / 2 : 1.5, z: office ? ZONE - 1.0 : 1.5 };
    const seats = staff.map((e, i) => { const p = Math.floor(i / 4), sub = i % 4, col = p % podCols, row = Math.floor(p / podCols); return { e, x: col * PODW + (sub % 2) * 1.05 + 0.5, z: ZONE + row * PODW + Math.floor(sub / 2) * 1.2 + 0.5 }; });
    if (mgr) seats.push({ e: mgr, x: offDesk.x, z: offDesk.z });

    const S = 2, WX = FW * S, WZ = FH * S, eye = 1.6;

    // ----- renderer / scene -----
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    let W = mount.clientWidth || 800, H = mount.clientHeight || 600;
    renderer.setSize(W, H); mount.appendChild(renderer.domElement);
    const el = renderer.domElement; el.style.display = "block"; el.style.cursor = "pointer";
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0e1018);
    scene.fog = new THREE.Fog(0x0e1018, Math.max(WX, WZ) * 0.85, Math.max(WX, WZ) * 2.4);
    const cam = new THREE.PerspectiveCamera(66, W / H, 0.05, 500);
    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const dl = new THREE.DirectionalLight(0xffffff, 0.5); dl.position.set(WX * 0.3, 30, WZ * 0.15); scene.add(dl);
    scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x202830, 0.35));

    const junk = []; const T = o => { junk.push(o); return o; };
    // floor, ceiling, zone carpets
    const floor = new THREE.Mesh(T(new THREE.PlaneGeometry(WX, WZ)), T(new THREE.MeshLambertMaterial({ color: 0x3a4150 }))); floor.rotation.x = -Math.PI / 2; floor.position.set(WX / 2, 0, WZ / 2); scene.add(floor);
    const ceil = new THREE.Mesh(T(new THREE.PlaneGeometry(WX, WZ)), T(new THREE.MeshLambertMaterial({ color: 0x14171f }))); ceil.rotation.x = Math.PI / 2; ceil.position.set(WX / 2, 3.2, WZ / 2); scene.add(ceil);
    const zoneColors = { office: 0x5b4a6e, meet: 0x3f5a7a, break: 0x6c7480, lounge: 0x7a5a4a, server: 0x243043, lab: 0xd6dee4, priv: 0x63564a };
    rooms.forEach(r => { const w = (r.x1 - r.x0) * S; const m = new THREE.Mesh(T(new THREE.PlaneGeometry(w, ZONE * S)), T(new THREE.MeshLambertMaterial({ color: zoneColors[r.kind] || 0x3a4150 }))); m.rotation.x = -Math.PI / 2; m.position.set((r.x0 + r.x1) / 2 * S, 0.02, ZONE / 2 * S); scene.add(m); });
    // walls
    const wallMat = T(new THREE.MeshLambertMaterial({ color: 0x2a2f3d })), wallH = 3.2;
    const mkWall = (x, z, w, d) => { const m = new THREE.Mesh(T(new THREE.BoxGeometry(w, wallH, d)), wallMat); m.position.set(x, wallH / 2, z); scene.add(m); };
    mkWall(WX / 2, 0.06, WX, 0.12); mkWall(WX / 2, WZ - 0.06, WX, 0.12); mkWall(0.06, WZ / 2, 0.12, WZ); mkWall(WX - 0.06, WZ / 2, 0.12, WZ);
    // ---- room props (match the 2D floor plan) ----
    const addBox = (w, h, d, c, x, y, z, em) => { const mat = new THREE.MeshLambertMaterial(em != null ? { color: c, emissive: em, emissiveIntensity: 0.7 } : { color: c }); const m = new THREE.Mesh(T(new THREE.BoxGeometry(w, h, d)), T(mat)); m.position.set(x, y, z); scene.add(m); return m; };
    const addCyl = (rt, rb, h, c, x, y, z) => { const m = new THREE.Mesh(T(new THREE.CylinderGeometry(rt, rb, h, 12)), T(new THREE.MeshLambertMaterial({ color: c }))); m.position.set(x, y, z); scene.add(m); return m; };
    const plant = (tx, tz) => { addCyl(0.12, 0.14, 0.5, 0x7a4a30, tx * S, 0.25, tz * S); const c = new THREE.Mesh(T(new THREE.SphereGeometry(0.42, 10, 8)), T(new THREE.MeshLambertMaterial({ color: 0x3f8f48 }))); c.position.set(tx * S, 0.85, tz * S); scene.add(c); };
    const whiteboard = (tcx, tw) => { const cvs = document.createElement("canvas"); cvs.width = 256; cvs.height = 150; const c = cvs.getContext("2d"); c.fillStyle = "#eef2f5"; c.fillRect(0, 0, 256, 150); c.lineWidth = 3; c.strokeStyle = "#2d6cdf"; c.strokeRect(28, 30, 46, 34); c.strokeRect(150, 30, 46, 34); c.strokeStyle = "#1b2330"; c.beginPath(); c.moveTo(74, 47); c.lineTo(150, 47); c.stroke(); c.strokeStyle = "#cc3b3b"; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 30; i++) c.lineTo(170 + i * 2.5, 110 + Math.sin(i * 0.6) * 9); c.stroke(); c.strokeStyle = "#1b2330"; for (let r = 0; r < 3; r++) { c.beginPath(); c.moveTo(28, 92 + r * 14); c.lineTo(96, 92 + r * 14); c.stroke(); } const tex = T(new THREE.CanvasTexture(cvs)); const m = new THREE.Mesh(T(new THREE.PlaneGeometry(tw * S * 0.8, 1.3)), T(new THREE.MeshBasicMaterial({ map: tex }))); m.position.set(tcx * S, 1.7, 0.15); scene.add(m); };
    // windows (sky strips) high on the north & west walls
    const winMat = T(new THREE.MeshBasicMaterial({ color: 0x33507f }));
    const nWin = new THREE.Mesh(T(new THREE.PlaneGeometry(WX * 0.9, 0.5)), winMat); nWin.position.set(WX / 2, 2.7, 0.12); scene.add(nWin);
    const wWin = new THREE.Mesh(T(new THREE.PlaneGeometry(WZ * 0.9, 0.5)), winMat); wWin.rotation.y = Math.PI / 2; wWin.position.set(0.12, 2.7, WZ / 2); scene.add(wWin);
    // exec office for the manager
    if (office) { const ox = offDesk.x * S, oz = offDesk.z * S; addBox(1.8, 1.0, 0.9, 0x6e4f33, ox, 0.5, oz - 0.6); addBox(0.5, 0.4, 0.06, 0x12161c, ox, 1.2, oz - 0.5, 0x1d4060); addBox(0.7, 1.05, 0.7, 0x384563, ox, 0.52, oz + 0.05); addBox(0.5, 2.2, 1.0, 0x6a4a30, (office.x0 + 0.55) * S, 1.1, 0.6 * S); plant(office.x1 - 0.5, 0.6); }
    // per-room props
    const rackMat = T(new THREE.MeshLambertMaterial({ color: 0x20262f, emissive: 0x123a22, emissiveIntensity: 0.8 }));
    const serverLeds = [], ledColor = new THREE.Color();
    rooms.forEach(r => {
      const cx = (r.x0 + r.x1) / 2;
      if (r.kind === "server") {
        const data = [];
        for (let k = 0; k < 3; k++) { const rx = (r.x0 + 0.6 + k * 0.7) * S; const m = new THREE.Mesh(T(new THREE.BoxGeometry(0.5, 2.0, 0.5)), rackMat); m.position.set(rx, 1.0, 0.7 * S); scene.add(m); for (let row = 0; row < 7; row++) for (let c2 = 0; c2 < 2; c2++) data.push({ x: rx - 0.12 + c2 * 0.24, y: 0.45 + row * 0.22, z: 0.7 * S + 0.27, phase: Math.random() * 6.28, rate: 2 + Math.random() * 4 }); }
        const ledMesh = new THREE.InstancedMesh(T(new THREE.BoxGeometry(0.09, 0.05, 0.03)), T(new THREE.MeshBasicMaterial({ color: 0xffffff })), data.length); ledMesh.frustumCulled = false;
        const dm = new THREE.Object3D(); data.forEach((L, i) => { dm.position.set(L.x, L.y, L.z); dm.updateMatrix(); ledMesh.setMatrixAt(i, dm.matrix); }); ledMesh.instanceMatrix.needsUpdate = true; scene.add(ledMesh);
        serverLeds.push({ mesh: ledMesh, data });
        const pl = new THREE.PointLight(0x4aa0ff, 0.6, 9); pl.position.set(cx * S, 2.0, 1.2 * S); scene.add(pl);
      }
      else if (r.kind === "lab") { for (let i = 0; i < 2; i++) { addBox(1.4, 0.9, 0.7, 0xaeb6bf, (r.x0 + 1 + i * 1.6) * S, 0.45, 0.7 * S); addBox(0.4, 0.3, 0.05, 0x12161c, (r.x0 + 1 + i * 1.6) * S, 1.05, 0.55 * S, 0x1f6f4a); } whiteboard(cx, r.x1 - r.x0); }
      else if (r.kind === "meet") { addBox(2.0, 0.8, 1.0, 0x6e573c, cx * S, 0.5, ZONE / 2 * S); whiteboard(cx, r.x1 - r.x0); }
      else if (r.kind === "break") { addBox((r.x1 - r.x0 - 0.4) * S, 0.9, 0.5, 0xc4ccd6, cx * S, 0.45, 0.45 * S); addBox(0.7, 1.9, 0.7, 0xcfd6de, (r.x0 + 0.6) * S, 0.95, 0.5 * S); addBox(0.4, 0.5, 0.4, 0x2b2f3a, (r.x0 + 1.5) * S, 1.15, 0.45 * S); addCyl(0.18, 0.2, 1.0, 0xdfe7ef, (r.x0 + 2.6) * S, 0.5, 0.5 * S); addCyl(0.5, 0.5, 0.06, 0xdfe4ea, (r.x0 + 1.2) * S, 0.78, (ZONE - 1.0) * S); }
      else if (r.kind === "lounge") { addBox(1.6, 0.7, 0.8, 0x48648f, cx * S, 0.35, (ZONE - 0.9) * S); addBox(0.9, 0.45, 0.6, 0x6a4a32, cx * S, 0.22, (ZONE - 1.7) * S); plant(r.x1 - 0.4, ZONE - 0.4); }
      else if (r.kind === "priv") { addBox(1.0, 0.9, 0.7, 0x7d5b3c, (r.x0 + 0.8) * S, 0.45, 0.9 * S); addBox(1.0, 0.9, 0.7, 0x7d5b3c, (r.x1 - 0.8) * S, 0.45, 0.9 * S); plant(r.x1 - 0.5, ZONE - 0.5); }
    });
    if (workW >= 2 && nStaff >= 6) addBox(0.5, 1.0, 0.5, 0x3a4150, (workW - 0.6) * S, 0.5, (ZONE + 1.6) * S); // printer
    plant(0.4, ZONE + 0.4); plant(FW - 0.5, ZONE + 0.4);

    // ----- staff desks/chairs/monitors (static) + everyone as bodies/heads (animated), instanced -----
    const D = staff.length, P = seats.length;
    const deskGeo = T(new THREE.BoxGeometry(1.3, 1.0, 0.7)), deskMat = T(new THREE.MeshLambertMaterial({ color: 0x8a6a44 }));
    const monGeo = T(new THREE.BoxGeometry(0.5, 0.4, 0.06)), monMat = T(new THREE.MeshLambertMaterial({ color: 0x12161c, emissive: 0x1d4060, emissiveIntensity: 0.7 }));
    const chairGeo = T(new THREE.BoxGeometry(0.55, 0.5, 0.55)), chairMat = T(new THREE.MeshLambertMaterial({ color: 0x2f3a52 }));
    const bodyGeo = T(new THREE.CylinderGeometry(0.24, 0.32, 0.95, 8)), bodyMat = T(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const headGeo = T(new THREE.SphereGeometry(0.2, 12, 10)), headMat = T(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    const deskInst = new THREE.InstancedMesh(deskGeo, deskMat, Math.max(1, D)), monInst = new THREE.InstancedMesh(monGeo, monMat, Math.max(1, D)), chairInst = new THREE.InstancedMesh(chairGeo, chairMat, Math.max(1, D));
    const bodyInst = new THREE.InstancedMesh(bodyGeo, bodyMat, Math.max(1, P)), headInst = new THREE.InstancedMesh(headGeo, headMat, Math.max(1, P));
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    for (let i = 0; i < D; i++) { const s = seats[i], x = s.x * S, z = s.z * S; dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.position.set(x, 0.25, z + 0.05); dummy.updateMatrix(); chairInst.setMatrixAt(i, dummy.matrix); dummy.position.set(x, 0.5, z - 0.75); dummy.updateMatrix(); deskInst.setMatrixAt(i, dummy.matrix); dummy.position.set(x, 1.15, z - 0.66); dummy.updateMatrix(); monInst.setMatrixAt(i, dummy.matrix); }
    [deskInst, monInst, chairInst].forEach(m => { m.instanceMatrix.needsUpdate = true; });
    seats.forEach((s, i) => { col.set(FN_COLORS[s.e && s.e.fn] || building.color || "#6b9"); bodyInst.setColorAt(i, col); col.set(SKIN[(i * 13) % SKIN.length]); headInst.setColorAt(i, col); });
    if (bodyInst.instanceColor) bodyInst.instanceColor.needsUpdate = true;
    if (headInst.instanceColor) headInst.instanceColor.needsUpdate = true;
    scene.add(deskInst, monInst, chairInst, bodyInst, headInst);
    bodyInst.frustumCulled = false; headInst.frustumCulled = false; // they move every frame; don't cull by a stale bounds

    // ----- people behaviour: most seated, some get up and walk to coffee / labs / a colleague's desk -----
    const people = seats.map(s => ({ e: s.e, hx: s.x, hz: s.z, x: s.x, z: s.z, tx: s.x, tz: s.z, state: "work", t: 2 + Math.random() * 6, dir: Math.PI, bob: Math.random() * 6.28, seated: true }));
    const dests = [];
    const _brk = rooms.find(r => r.kind === "break"); if (_brk) dests.push({ x: _brk.x0 + 1.5, z: ZONE - 1.0 });
    const _lab = rooms.find(r => r.kind === "lab"); if (_lab) dests.push({ x: _lab.x0 + 1.4, z: ZONE - 1.1 });
    const _srv = rooms.find(r => r.kind === "server"); if (_srv) dests.push({ x: (_srv.x0 + _srv.x1) / 2, z: ZONE - 0.9 });
    const _meet = rooms.find(r => r.kind === "meet"); if (_meet) dests.push({ x: (_meet.x0 + _meet.x1) / 2, z: ZONE / 2 });
    const _lng = rooms.find(r => r.kind === "lounge"); if (_lng) dests.push({ x: (_lng.x0 + _lng.x1) / 2, z: ZONE - 1.0 });
    function pickGoal(p) {
      const r = Math.random();
      if (dests.length && r < 0.42) { const d = dests[Math.floor(Math.random() * dests.length)]; p.tx = d.x + (Math.random() - 0.5) * 0.7; p.tz = d.z + (Math.random() - 0.5) * 0.7; p.state = "walk"; }
      else if (r < 0.6 && D > 1) { const o = seats[Math.floor(Math.random() * D)]; p.tx = o.x + 0.7; p.tz = o.z + 0.7; p.state = "walk"; }
      else p.t = 4 + Math.random() * 7;
    }
    function updPerson(p, dt) {
      if (p.state === "walk" || p.state === "return") {
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
        if (d < 0.06) { p.x = p.tx; p.z = p.tz; if (p.state === "walk") { p.state = "dwell"; p.t = 3 + Math.random() * 4; } else { p.state = "work"; p.t = 4 + Math.random() * 7; } }
        else { const s = Math.min(d, 1.25 * dt); p.x += dx / d * s; p.z += dz / d * s; p.dir = Math.atan2(dx, dz); p.bob += dt * 9; }
        p.seated = false; return;
      }
      if (p.state === "dwell") { p.seated = false; p.t -= dt; if (p.t <= 0) { p.tx = p.hx; p.tz = p.hz; p.state = "return"; } return; }
      p.seated = true; p.x = p.hx; p.z = p.hz; p.t -= dt; if (p.t <= 0) pickGoal(p);
    }

    // ----- first-person camera + controls -----
    const keys = new Set();
    const fpc = { yaw: Math.PI, pitch: 0, pos: new THREE.Vector3(WX / 2, eye, WZ - 2) };
    const fSeat = focusEmp ? seats.find(s => s.e === focusEmp) : null;
    if (fSeat) { fpc.pos.set(fSeat.x * S, eye, fSeat.z * S + 2.4); fpc.yaw = Math.atan2(fSeat.x * S - fpc.pos.x, fSeat.z * S - fpc.pos.z); }
    function applyCam() { cam.position.copy(fpc.pos); const cp = Math.cos(fpc.pitch); cam.lookAt(fpc.pos.x + Math.sin(fpc.yaw) * cp, fpc.pos.y + Math.sin(fpc.pitch), fpc.pos.z + Math.cos(fpc.yaw) * cp); }
    applyCam();
    function onKeyDown(e) { const k = e.key.toLowerCase(); keys.add(k); if (["w", "a", "s", "d", " "].includes(k)) e.preventDefault(); }
    function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
    function onMouseMove(e) { if (document.pointerLockElement !== el) return; fpc.yaw -= e.movementX * 0.0022; fpc.pitch = THREE.MathUtils.clamp(fpc.pitch - e.movementY * 0.0022, -1.4, 1.4); }
    document.addEventListener("mousemove", onMouseMove);
    const raycaster = new THREE.Raycaster();
    function pickCenter() { raycaster.setFromCamera({ x: 0, y: 0 }, cam); const hit = raycaster.intersectObject(bodyInst, false)[0]; return hit && hit.instanceId != null ? hit.instanceId : -1; }
    function onClick() { if (document.pointerLockElement === el) { const id = pickCenter(); if (id >= 0 && seats[id]) selRef.current(seats[id].e); } else el.requestPointerLock && el.requestPointerLock(); }
    el.addEventListener("click", onClick);
    function onPLC() { setLocked(document.pointerLockElement === el); }
    document.addEventListener("pointerlockchange", onPLC);
    const ro = new ResizeObserver(() => { W = mount.clientWidth || 800; H = mount.clientHeight || 600; renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); });
    ro.observe(mount);

    let raf = 0, last = performance.now(), lastPick = 0, lastLed = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (document.hidden) return;
      const sp = (keys.has("shift") ? 8 : 4) * dt, fx = Math.sin(fpc.yaw), fz = Math.cos(fpc.yaw);
      if (keys.has("w")) { fpc.pos.x += fx * sp; fpc.pos.z += fz * sp; }
      if (keys.has("s")) { fpc.pos.x -= fx * sp; fpc.pos.z -= fz * sp; }
      if (keys.has("d")) { fpc.pos.x += fz * sp; fpc.pos.z -= fx * sp; }
      if (keys.has("a")) { fpc.pos.x -= fz * sp; fpc.pos.z += fx * sp; }
      fpc.pos.x = THREE.MathUtils.clamp(fpc.pos.x, 0.4, WX - 0.4); fpc.pos.z = THREE.MathUtils.clamp(fpc.pos.z, 0.4, WZ - 0.4); fpc.pos.y = eye;
      applyCam();
      // animate people (seated ⇄ walking) + blinking server racks/LEDs
      rackMat.emissiveIntensity = 0.5 + 0.4 * Math.abs(Math.sin(now * 0.004));
      if (serverLeds.length && now - lastLed > 110) { lastLed = now; for (const sl of serverLeds) { for (let i = 0; i < sl.data.length; i++) { const L = sl.data[i], on = Math.sin(now * 0.001 * L.rate + L.phase) > 0; ledColor.setHex(on ? (i % 3 ? 0x3ce06a : 0xffc24d) : 0x0b1f12); sl.mesh.setColorAt(i, ledColor); } if (sl.mesh.instanceColor) sl.mesh.instanceColor.needsUpdate = true; } }
      for (let i = 0; i < people.length; i++) updPerson(people[i], dt);
      for (let i = 0; i < people.length; i++) {
        const p = people[i], x = p.x * S, z = p.z * S;
        if (p.seated) { dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 0.72, 1); dummy.position.set(x, 0.78, z); dummy.updateMatrix(); bodyInst.setMatrixAt(i, dummy.matrix); dummy.scale.set(1, 1, 1); dummy.position.set(x, 1.3, z); dummy.updateMatrix(); headInst.setMatrixAt(i, dummy.matrix); }
        else { const bob = Math.sin(p.bob) * 0.05; dummy.rotation.set(0, p.dir, 0); dummy.scale.set(1, 1, 1); dummy.position.set(x, 0.92 + bob, z); dummy.updateMatrix(); bodyInst.setMatrixAt(i, dummy.matrix); dummy.position.set(x, 1.62 + bob, z); dummy.updateMatrix(); headInst.setMatrixAt(i, dummy.matrix); }
      }
      bodyInst.instanceMatrix.needsUpdate = true; headInst.instanceMatrix.needsUpdate = true;
      if (document.pointerLockElement === el && now - lastPick > 80) {
        lastPick = now; const id = pickCenter(), tip = tipRef.current;
        if (tip) { if (id >= 0 && seats[id]) { const e2 = seats[id].e; tip.textContent = `${e2.first} ${e2.last}${e2.title ? " · " + e2.title : ""}`; tip.style.display = "block"; } else tip.style.display = "none"; }
      }
      renderer.render(scene, cam);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("pointerlockchange", onPLC); el.removeEventListener("click", onClick);
      if (document.pointerLockElement === el) document.exitPointerLock && document.exitPointerLock();
      [deskInst, monInst, chairInst, bodyInst, headInst].forEach(m => m.dispose());
      serverLeds.forEach(sl => sl.mesh.dispose());
      junk.forEach(o => o.dispose && o.dispose());
      renderer.dispose();
      if (el.parentNode === mount) mount.removeChild(el);
    };
  }, [ready, building, focusEmp]);

  return (
    <div className="absolute inset-0 z-40" style={{ background: "#0e1018" }}>
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute" style={{ left: "50%", top: "50%", width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: 3, background: "rgba(255,255,255,0.85)", boxShadow: "0 0 3px rgba(0,0,0,0.6)", pointerEvents: "none" }} />
      <div ref={tipRef} className="absolute" style={{ display: "none", left: "50%", top: "calc(50% + 16px)", transform: "translateX(-50%)", pointerEvents: "none", padding: "3px 9px", borderRadius: 6, background: "rgba(2,8,23,0.8)", color: "#dbe7ff", fontSize: 12, whiteSpace: "nowrap" }} />
      <button onClick={onClose} className="absolute top-3 left-3 z-10 text-xs px-3 py-1.5 rounded-lg bg-white/90 text-gray-700 hover:bg-white font-medium shadow">← Back to floor</button>
      <div className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-md text-white" style={{ fontSize: 12, background: "rgba(2,8,23,0.6)" }}>🎮 First person · {building.name}</div>
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">Loading 3D engine…</div>}
      {ready && !locked && <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: "none" }}><div className="px-4 py-2 rounded-lg text-white text-sm" style={{ background: "rgba(2,8,23,0.72)" }}>Click to look around · <b>WASD</b> walk · <b>Shift</b> run · <b>Esc</b> release · aim at a person &amp; click for their card</div></div>}
    </div>
  );
}

// Isometric "city" org view — SimCity/RCT style. Business Units are districts, each team a
// building whose height grows with headcount, with tiny employees milling the plazas. Pure
// canvas 2D (no libraries). Drag to pan, wheel to zoom, click a building to step inside.
function CityOrgView() {
  const { activeEmployees, tree, colorBy, setDetailPanel } = useContext(AppCtx);
  const mountRef = useRef(null);
  const tipRef = useRef(null);
  const setDetailRef = useRef(setDetailPanel); setDetailRef.current = setDetailPanel;
  const treeRef = useRef(tree); treeRef.current = tree;
  const [interior, setInterior] = useState(null);
  const setInteriorRef = useRef(setInterior); setInteriorRef.current = setInterior;
  const pausedRef = useRef(false); // true while a building interior overlay is open
  useEffect(() => { pausedRef.current = !!interior; }, [interior]);

  // Group the active org into BU districts -> dept buildings, then lay them out on a tile grid.
  const layout = useMemo(() => {
    const emps = (activeEmployees || []);
    const buMap = new Map();
    emps.forEach(e => {
      const bu = e.bg || "Unassigned", dept = e.dept || "General";
      if (!buMap.has(bu)) buMap.set(bu, new Map());
      const dm = buMap.get(bu);
      if (!dm.has(dept)) dm.set(dept, []);
      dm.get(dept).push(e);
    });
    const districts = [];
    for (const [bu, dm] of buMap) {
      const depts = [];
      for (const [dept, list] of dm) {
        let top = list[0];
        list.forEach(e => { if (levelIndex(e.level) > levelIndex(top.level)) top = e; });
        depts.push({ name: dept, count: list.length, top, members: list });
      }
      depts.sort((a, b) => b.count - a.count);
      districts.push({ bu, depts, total: depts.reduce((s, d) => s + d.count, 0) });
    }
    districts.sort((a, b) => b.total - a.total);

    const buildings = [], plates = [], trees = [], districtCenters = [], lamps = [];
    const N = districts.length || 1;
    const cols = Math.max(1, Math.ceil(Math.sqrt(N)));
    const DSIZE = 11, GAP = 3;
    districts.forEach((dist, di) => {
      const dx = (di % cols) * (DSIZE + GAP) + GAP, dy = Math.floor(di / cols) * (DSIZE + GAP) + GAP;
      plates.push({ gx: dx, gy: dy, size: DSIZE, bu: dist.bu });
      districtCenters.push({ gx: dx + DSIZE / 2, gy: dy, bu: dist.bu, total: dist.total });
      lamps.push({ gx: dx - 0.4, gy: dy + DSIZE + 0.4 }, { gx: dx + DSIZE + 0.4, gy: dy + DSIZE + 0.4 }, { gx: dx - 0.4, gy: dy - 0.4 });
      const m = Math.max(1, Math.ceil(Math.sqrt(dist.depts.length)));
      const cell = (DSIZE - 1.5) / m;
      const placed = [];
      dist.depts.forEach((dp, i) => {
        const bx = dx + 0.75 + (i % m) * cell + cell / 2;
        const by = dy + 0.75 + Math.floor(i / m) * cell + cell / 2;
        // Size tracks team headcount with a wide dynamic range so the skyline really varies:
        // small teams are stubby, big teams tower. A little deterministic jitter keeps equal-size teams distinct.
        const foot = Math.max(0.55, Math.min(cell * 0.82, 0.5 + Math.pow(dp.count, 0.6) * 0.16));
        const jit = 0.85 + ((i * 37 + di * 13) % 30) / 100; // ±~15%
        const h = (8 + Math.min(310, Math.pow(dp.count, 0.85) * 5.6)) * jit;
        const color = colorBy === "business_group" ? (BG_COLORS[dist.bu] || "#8aa0b8") : (DEPT_COLORS[dp.name] || "#8aa0b8");
        const ppl = [];
        const pc = Math.min(18, Math.max(1, Math.round(dp.count / 4)));
        for (let p = 0; p < pc; p++) ppl.push({ ang: Math.random() * 6.28, rad: foot * 0.55 + Math.random() * 0.8, spd: 0.4 + Math.random() });
        const seed = (i * 17 + di * 7) % 100, style = cityStyle(dp.name);
        buildings.push({ gx: bx, gy: by, foot, h, name: dp.name, count: dp.count, color, bu: dist.bu, top: dp.top, members: dp.members, style, shape: cityShape(dp.count, style, seed), people: ppl, seed });
        placed.push([bx, by]);
      });
      let attempts = 0, made = 0;
      while (made < 6 && attempts < 50) { // scatter a few trees, away from buildings
        attempts++;
        const tx = dx + 0.6 + Math.random() * (DSIZE - 1.2), ty = dy + 0.6 + Math.random() * (DSIZE - 1.2);
        if (placed.every(([px, py]) => Math.abs(px - tx) + Math.abs(py - ty) > 1.3)) { trees.push({ gx: tx, gy: ty }); made++; }
      }
    });
    const rows = Math.ceil(N / cols);
    return { buildings, plates, trees, districtCenters, lamps, cols, rows, DSIZE, GAP, extentX: cols * (DSIZE + GAP) + GAP, extentY: rows * (DSIZE + GAP) + GAP };
  }, [activeEmployees, colorBy]);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const canvas = document.createElement("canvas");
    canvas.style.display = "block"; canvas.style.cursor = "grab";
    mount.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const TW = 64, TH = 32;
    let W = 1, H = 1;
    const cam = { ox: 0, oy: 0, zoom: 0.75 };

    function w2s(gx, gy) { return [((gx - gy) * TW / 2) * cam.zoom + cam.ox, ((gx + gy) * TH / 2) * cam.zoom + cam.oy]; }
    function centerCam() {
      const cx = layout.extentX / 2, cy = layout.extentY / 2;
      cam.ox = W / 2 - ((cx - cy) * TW / 2) * cam.zoom;
      cam.oy = H / 2 - ((cx + cy) * TH / 2) * cam.zoom;
    }
    function shade(hex, f) {
      const s = (hex || "#889").replace("#", ""); const n = s.length === 3 ? s.split("").map(x => x + x).join("") : s;
      const r = Math.min(255, Math.round(parseInt(n.slice(0, 2), 16) * f));
      const g = Math.min(255, Math.round(parseInt(n.slice(2, 4), 16) * f));
      const b = Math.min(255, Math.round(parseInt(n.slice(4, 6), 16) * f));
      return `rgb(${r},${g},${b})`;
    }
    function poly(pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    function plate(gx, gy, size, fill) {
      poly([w2s(gx, gy), w2s(gx + size, gy), w2s(gx + size, gy + size), w2s(gx, gy + size)], fill);
      ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 1; ctx.stroke();
    }
    function bbox(b) {
      const f = b.foot / 2, ht = b.h * cam.zoom;
      const A = w2s(b.gx - f, b.gy - f), C = w2s(b.gx + f, b.gy + f), Bp = w2s(b.gx + f, b.gy - f), Dp = w2s(b.gx - f, b.gy - f);
      const xs = [A[0], C[0], Bp[0], Dp[0]], ys = [A[1] - ht, C[1], A[1], C[1] - ht];
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    function windows(P0, P1, ht, b, faceSeed) {
      const nc = Math.max(1, Math.round(b.foot * 1.6));
      const nr = Math.max(1, Math.min(6, Math.round(b.h / 22)));
      const pt = (u, v) => [P0[0] + u * (P1[0] - P0[0]), P0[1] + u * (P1[1] - P0[1]) - v * ht];
      for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) {
        const u0 = (i + 0.28) / nc, u1 = (i + 0.72) / nc, v0 = (j + 0.32) / nr, v1 = (j + 0.74) / nr;
        const lit = ((i * 7 + j * 13 + b.seed + faceSeed) % 5) !== 0;
        poly([pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)], lit ? "rgba(255,231,150,0.92)" : "rgba(40,52,70,0.7)");
      }
    }
    function drawBuilding(b, hi, clock) {
      const f = b.foot / 2, ht = b.h * cam.zoom, z = cam.zoom, sp = b.shape || "box";
      const cc = w2s(b.gx, b.gy);
      const A = w2s(b.gx - f, b.gy - f), B = w2s(b.gx + f, b.gy - f), C = w2s(b.gx + f, b.gy + f), D = w2s(b.gx - f, b.gy + f);
      const up = p => [p[0], p[1] - ht];
      ctx.save(); ctx.globalAlpha = 0.16; poly([w2s(b.gx - f, b.gy + f * 1.5), w2s(b.gx + f * 1.5, b.gy + f), w2s(b.gx + f, b.gy - f * 0.2), w2s(b.gx - f * 0.2, b.gy + f)], "#000"); ctx.restore();
      const rxE = f * TW * z, ryE = f * TH * z;
      if (sp === "cylinder" || sp === "dome") {
        const bodyH = sp === "dome" ? ht * 0.55 : ht, top = cc[1] - bodyH;
        poly([[cc[0] - rxE, cc[1]], [cc[0] + rxE, cc[1]], [cc[0] + rxE, top], [cc[0] - rxE, top]], shade(b.color, 0.7));
        ctx.fillStyle = shade(b.color, 0.7); ctx.beginPath(); ctx.ellipse(cc[0], cc[1], rxE, ryE, 0, 0, Math.PI); ctx.fill();
        if (z > 0.4 && bodyH > 16) { ctx.fillStyle = "rgba(255,231,150,0.5)"; const rr = Math.min(6, Math.round(bodyH / 16)); for (let r = 0; r < rr; r++) { const yy = cc[1] - (r + 0.5) / rr * bodyH; ctx.fillRect(cc[0] - rxE * 0.8, yy - 1.5 * z, rxE * 1.6, 1.6 * z); } }
        ctx.fillStyle = shade(b.color, hi ? 1.18 : 1.04); ctx.beginPath(); ctx.ellipse(cc[0], top, rxE, ryE, 0, 0, 6.28); ctx.fill();
        if (sp === "dome") { ctx.fillStyle = shade(b.color, 1.12); ctx.beginPath(); ctx.ellipse(cc[0], top, rxE, ht * 0.5, 0, Math.PI, 0); ctx.fill(); ctx.strokeStyle = "#dfe6ef"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cc[0], top - ht * 0.5); ctx.lineTo(cc[0], top - ht * 0.5 - 7 * z); ctx.stroke(); }
        if (hi) { ctx.strokeStyle = "#fde047"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cc[0], top, rxE, ryE, 0, 0, 6.28); ctx.stroke(); }
      } else if (sp === "pyramid") {
        const apex = [cc[0], cc[1] - ht];
        poly([B, C, apex], shade(b.color, 0.72)); poly([D, C, apex], shade(b.color, 0.55));
        ctx.strokeStyle = hi ? "#fde047" : "rgba(0,0,0,0.2)"; ctx.lineWidth = hi ? 2 : 1; ctx.beginPath(); ctx.moveTo(C[0], C[1]); ctx.lineTo(apex[0], apex[1]); ctx.stroke();
      } else if (sp === "house") {
        poly([B, C, up(C), up(B)], shade(b.color, 0.74)); poly([D, C, up(C), up(D)], shade(b.color, 0.58)); poly([up(A), up(B), up(C), up(D)], shade(b.color, 1.0));
        const apex = [cc[0], cc[1] - ht - 11 * z];
        poly([up(B), up(C), apex], "#9a4b3b"); poly([up(D), up(C), apex], "#7e3b2e");
        if (hi) { ctx.strokeStyle = "#fde047"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(up(B)[0], up(B)[1]); ctx.lineTo(apex[0], apex[1]); ctx.lineTo(up(D)[0], up(D)[1]); ctx.stroke(); }
      } else if (sp === "stepped") {
        const seg = (ff, h0, h1, fr) => { const A2 = w2s(b.gx - ff, b.gy - ff), B2 = w2s(b.gx + ff, b.gy - ff), C2 = w2s(b.gx + ff, b.gy + ff), D2 = w2s(b.gx - ff, b.gy + ff); const lo = p => [p[0], p[1] - h0], hf = p => [p[0], p[1] - h1]; poly([lo(B2), lo(C2), hf(C2), hf(B2)], shade(b.color, 0.72 * fr)); poly([lo(D2), lo(C2), hf(C2), hf(D2)], shade(b.color, 0.55 * fr)); poly([hf(A2), hf(B2), hf(C2), hf(D2)], shade(b.color, fr)); };
        seg(f, 0, ht * 0.5, 1.0); seg(f * 0.72, ht * 0.5, ht * 0.8, 1.06); seg(f * 0.46, ht * 0.8, ht, 1.12);
        if (b.h > 16 && z > 0.4) windows(B, C, ht * 0.5, b, 1);
      } else { // box
        poly([B, C, up(C), up(B)], shade(b.color, 0.72));
        if (b.h > 16 && z > 0.4) windows(B, C, ht, b, 1);
        poly([D, C, up(C), up(D)], shade(b.color, 0.55));
        if (b.h > 16 && z > 0.4) windows(D, C, ht, b, 4);
        poly([up(A), up(B), up(C), up(D)], shade(b.color, hi ? 1.18 : 1.0));
        ctx.strokeStyle = hi ? "#fde047" : "rgba(0,0,0,0.18)"; ctx.lineWidth = hi ? 2.5 : 1; ctx.stroke();
      }
      // rooftop flair by building type (boxy silhouettes only)
      if (sp !== "box" && sp !== "stepped") return;
      const rx = cc[0], ry = cc[1] - ht;
      if (b.style === "tower") { ctx.strokeStyle = "#9aa3b2"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry - 20 * z); ctx.stroke(); ctx.fillStyle = Math.sin(clock * 4) > 0 ? "#ff5a5a" : "#7a2222"; ctx.beginPath(); ctx.arc(rx, ry - 20 * z, 2.3 * z, 0, 6.28); ctx.fill(); }
      else if (b.style === "office") { ctx.fillStyle = "#8b95a6"; for (let k = 0; k < 3; k++) ctx.fillRect(rx - 9 * z + k * 7 * z, ry - 5 * z, 4.5 * z, 5 * z); }
      else if (b.style === "factory") { ctx.fillStyle = "#5b6270"; ctx.fillRect(rx + 3 * z, ry - 15 * z, 5 * z, 15 * z); for (let k = 0; k < 3; k++) { const tt = (clock * 0.5 + k * 0.5) % 1.5; ctx.fillStyle = `rgba(205,205,205,${0.32 * (1 - tt / 1.5)})`; ctx.beginPath(); ctx.arc(rx + 5.5 * z, ry - 17 * z - tt * 22 * z, (2 + tt * 3) * z, 0, 6.28); ctx.fill(); } }
      else if (b.style === "lab") { ctx.fillStyle = shade(b.color, 1.12); ctx.beginPath(); ctx.ellipse(rx, ry, f * TW * 0.34 * z, f * TH * 0.62 * z, 0, Math.PI, 0); ctx.fill(); }
      else if (b.style === "retail") { ctx.fillStyle = "#1f2937"; ctx.fillRect(rx - 13 * z, ry - 24 * z, 26 * z, 13 * z); ctx.fillStyle = "#fbbf24"; ctx.textAlign = "center"; ctx.font = `${7 * z}px 'DM Sans', sans-serif`; ctx.fillText(b.name.split(/[ &/]/).filter(Boolean).map(w => w[0]).join("").slice(0, 3).toUpperCase(), rx, ry - 14.5 * z); }
    }
    function drawTree(g, clock) {
      const s = w2s(g.gx, g.gy), z = cam.zoom, sway = Math.sin(clock * 1.4 + g.gx * 2) * 1.6 * z; // gentle breeze
      const top = (curSeason && curSeason.top) || "#4e9d54", mid = (curSeason && curSeason.mid) || "#5fb567", snow = curSeason ? curSeason.snow : 0;
      ctx.fillStyle = "#7a5235"; ctx.fillRect(s[0] - 1.5 * z, s[1] - 9 * z, 3 * z, 9 * z);
      ctx.fillStyle = top; ctx.beginPath(); ctx.arc(s[0] + sway, s[1] - 12 * z, 6 * z, 0, 6.28); ctx.fill();
      ctx.fillStyle = mid; ctx.beginPath(); ctx.arc(s[0] - 2.5 * z + sway, s[1] - 14 * z, 4 * z, 0, 6.28); ctx.fill();
      if (snow > 0.3) { ctx.fillStyle = `rgba(255,255,255,${snow})`; ctx.beginPath(); ctx.arc(s[0] - 1 * z + sway, s[1] - 15 * z, 3 * z, 0, 6.28); ctx.fill(); }
    }
    function drawCar(c) {
      const f = 0.32, ht = 6 * cam.zoom;
      const A = w2s(c.gx - f, c.gy - f), B = w2s(c.gx + f, c.gy - f), C = w2s(c.gx + f, c.gy + f), D = w2s(c.gx - f, c.gy + f);
      const up = p => [p[0], p[1] - ht];
      poly([B, C, up(C), up(B)], shade(c.color, 0.7));
      poly([D, C, up(C), up(D)], shade(c.color, 0.55));
      poly([up(A), up(B), up(C), up(D)], shade(c.color, 1.1));
    }
    function drawLamp(L) {
      const s = w2s(L.gx, L.gy), z = cam.zoom, hh = 18 * z;
      ctx.strokeStyle = "#3f4651"; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[0], s[1] - hh); ctx.lineTo(s[0] + 4 * z, s[1] - hh); ctx.stroke();
      ctx.fillStyle = "#ffe9a8"; ctx.beginPath(); ctx.arc(s[0] + 4.5 * z, s[1] - hh, 2.4 * z, 0, 6.28); ctx.fill();
    }
    function cloud(cx, cy, r, a) {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); ctx.arc(cx + r, cy + 4, r * 0.8, 0, 6.28); ctx.arc(cx - r, cy + 5, r * 0.7, 0, 6.28); ctx.arc(cx + r * 0.4, cy - r * 0.55, r * 0.7, 0, 6.28); ctx.fill();
    }
    function drawClock(tod, sky, season) {
      const x = W - 124, y = 12, w = 112, h = 40;
      ctx.fillStyle = "rgba(2,8,23,0.55)"; ctx.fillRect(x, y, w, h);
      const tm = Math.floor(tod * 24 * 60), hh = Math.floor(tm / 60), mm = tm % 60, ampm = hh < 12 ? "AM" : "PM", h12 = ((hh + 11) % 12) + 1;
      ctx.fillStyle = sky.day > 0.55 ? "#ffd86b" : sky.night > 0.6 ? "#e7ecff" : "#ffb27a"; ctx.beginPath(); ctx.arc(x + 15, y + 20, 7, 0, 6.28); ctx.fill();
      ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.font = "bold 14px 'DM Sans', sans-serif"; ctx.fillText(`${h12}:${String(mm).padStart(2, "0")} ${ampm}`, x + 28, y + 18);
      ctx.font = "10px 'DM Sans', sans-serif"; ctx.fillStyle = "#cbd5e1"; ctx.fillText(`${sky.day > 0.55 ? "Daytime" : sky.night > 0.6 ? "Night" : "Golden hour"} · ${season ? season.emoji + " " + season.name : ""}`, x + 28, y + 32);
    }

    let hover = -1, raf = 0, last = performance.now(), clock = 0;
    const sorted = [...layout.buildings].map((b, i) => ({ b, i })).sort((p, q) => (p.b.gx + p.b.gy) - (q.b.gx + q.b.gy));

    // cars cruising the streets between districts
    const CAR_COLORS = ["#e2574c", "#3b82f6", "#f5b301", "#10b981", "#ffffff", "#9333ea"];
    const span = Math.max(layout.extentX, layout.extentY);
    const cars = [];
    for (let c = 0; c <= layout.cols; c++) cars.push({ axis: "v", fixed: c * (layout.DSIZE + layout.GAP) + layout.GAP / 2, pos: Math.random() * span, dir: Math.random() < 0.5 ? 1 : -1, spd: 1.2 + Math.random(), color: CAR_COLORS[c % CAR_COLORS.length], gx: 0, gy: 0 });
    for (let r = 0; r <= layout.rows; r++) cars.push({ axis: "h", fixed: r * (layout.DSIZE + layout.GAP) + layout.GAP / 2, pos: Math.random() * span, dir: Math.random() < 0.5 ? 1 : -1, spd: 1.2 + Math.random(), color: CAR_COLORS[(r + 3) % CAR_COLORS.length], gx: 0, gy: 0 });

    // pedestrians on the sidewalks (two lanes either side of each street)
    const PED_COLORS = ["#d9544c", "#3b82f6", "#e8b53b", "#10b981", "#ec5fa0", "#8b5cf6", "#e7e7ea", "#f97316"];
    const peds = [];
    for (let c = 0; c <= layout.cols; c++) for (const side of [-0.6, 0.6]) peds.push({ axis: "v", fixed: c * (layout.DSIZE + layout.GAP) + layout.GAP / 2 + side, pos: Math.random() * span, dir: Math.random() < 0.5 ? 1 : -1, spd: 0.4 + Math.random() * 0.4, color: PED_COLORS[(c + (side > 0 ? 1 : 0)) % PED_COLORS.length], gx: 0, gy: 0 });
    for (let r = 0; r <= layout.rows; r++) for (const side of [-0.6, 0.6]) peds.push({ axis: "h", fixed: r * (layout.DSIZE + layout.GAP) + layout.GAP / 2 + side, pos: Math.random() * span, dir: Math.random() < 0.5 ? 1 : -1, spd: 0.4 + Math.random() * 0.4, color: PED_COLORS[(r + (side > 0 ? 2 : 3)) % PED_COLORS.length], gx: 0, gy: 0 });
    // a river runs down one street column, with bridges where roads cross it
    const hasRiver = layout.cols >= 2, riverCol = Math.floor(layout.cols / 2);
    const riverX = riverCol * (layout.DSIZE + layout.GAP) + layout.GAP / 2, riverW = layout.GAP / 2 * 0.92;
    const bridges = []; for (let r = 0; r <= layout.rows; r++) bridges.push(r * (layout.DSIZE + layout.GAP) + layout.GAP / 2);
    const boats = []; if (hasRiver) for (let i = 0; i < 3; i++) boats.push({ pos: Math.random() * layout.extentY, dir: Math.random() < 0.5 ? 1 : -1, spd: 0.5 + Math.random() * 0.4, color: ["#e2574c", "#f5b301", "#e7e7ea"][i % 3] });
    if (hasRiver) { const onRiver = o => o.axis === "v" && Math.abs(o.fixed - riverX) < 1.1; for (let i = cars.length - 1; i >= 0; i--) if (onRiver(cars[i])) cars.splice(i, 1); for (let i = peds.length - 1; i >= 0; i--) if (onRiver(peds[i])) peds.splice(i, 1); }
    cars.forEach(c => c.act = Math.random() * 0.9); peds.forEach(p => p.act = Math.random() * 0.9); // rush-hour spawn thresholds

    // landmarks at street intersections: one stadium, one park, the rest fountains
    const inter = [];
    for (let c = 1; c < layout.cols; c++) for (let r = 1; r < layout.rows; r++) inter.push({ gx: c * (layout.DSIZE + layout.GAP) + layout.GAP / 2, gy: r * (layout.DSIZE + layout.GAP) + layout.GAP / 2 });
    const stadium = inter[0] || null, park = inter[1] || null, fountains = inter.slice(2, 5);
    // sky life + weather
    const balloon = { x: -140, y: 80, ph: 0 };
    const birds = []; for (let i = 0; i < 7; i++) birds.push({ x: Math.random(), y: 38 + Math.random() * 90, ph: Math.random() * 6.28, spd: 0.02 + Math.random() * 0.02 });
    const plane = { x: -0.2, y: 50 };
    const drops = []; for (let i = 0; i < 260; i++) drops.push({ x: Math.random(), y: Math.random(), spd: 0.8 + Math.random() * 0.7 });
    const flakes = []; for (let i = 0; i < 180; i++) flakes.push({ x: Math.random(), y: Math.random(), spd: 0.15 + Math.random() * 0.25, drift: Math.random() * 6.28, rot: Math.random() * 6.28 });
    let flash = 0, boltTimer = 3, mmGeom = null, curSeason = null;
    const fireworks = []; let fwTimer = 3;

    function centerOn(gx, gy) { cam.ox = W / 2 - ((gx - gy) * TW / 2) * cam.zoom; cam.oy = H / 2 - ((gx + gy) * TH / 2) * cam.zoom; }
    function drawPed(p) { const s = w2s(p.gx, p.gy), z = cam.zoom, st = Math.sin(clock * 8 + p.pos) * 0.7 * z; ctx.fillStyle = "rgba(15,18,24,0.45)"; ctx.beginPath(); ctx.ellipse(s[0], s[1], 2 * z, 1 * z, 0, 0, 6.28); ctx.fill(); ctx.fillStyle = p.color; ctx.fillRect(s[0] - 1.1 * z, s[1] - 5.2 * z + st, 2.2 * z, 3.2 * z); ctx.fillStyle = "#1c2230"; ctx.fillRect(s[0] - 1.1 * z, s[1] - 2.2 * z + st, 2.2 * z, 2.2 * z); ctx.fillStyle = "#e2b48c"; ctx.beginPath(); ctx.arc(s[0], s[1] - 6.3 * z + st, 1.4 * z, 0, 6.28); ctx.fill(); }
    function drawFountain(f) {
      const s = w2s(f.gx, f.gy), z = cam.zoom;
      poly([w2s(f.gx - 0.5, f.gy - 0.5), w2s(f.gx + 0.5, f.gy - 0.5), w2s(f.gx + 0.5, f.gy + 0.5), w2s(f.gx - 0.5, f.gy + 0.5)], "#8a93a3");
      poly([w2s(f.gx - 0.36, f.gy - 0.36), w2s(f.gx + 0.36, f.gy - 0.36), w2s(f.gx + 0.36, f.gy + 0.36), w2s(f.gx - 0.36, f.gy + 0.36)], "#3f86bf");
      ctx.fillStyle = "rgba(195,230,255,0.85)";
      for (let k = 0; k < 9; k++) { const t = (clock * 1.5 + k / 9) % 1, a = (k / 9) * 6.28; ctx.beginPath(); ctx.arc(s[0] + Math.cos(a) * (1 + t * 7) * z, s[1] - (16 - t * t * 18) * z, 1.3 * z, 0, 6.28); ctx.fill(); }
      ctx.fillStyle = "#dff0ff"; ctx.fillRect(s[0] - 1 * z, s[1] - 16 * z, 2 * z, 16 * z);
    }
    function drawStadium(st) {
      const c = w2s(st.gx, st.gy), z = cam.zoom, RX = 1.7 * TW / 2 * z, RY = 1.7 * TH / 2 * z, wallH = 15 * z;
      poly([[c[0] - RX, c[1]], [c[0] + RX, c[1]], [c[0] + RX, c[1] - wallH], [c[0] - RX, c[1] - wallH]], "#6f7785");
      ctx.fillStyle = "#6f7785"; ctx.beginPath(); ctx.ellipse(c[0], c[1], RX, RY, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = "#aab2bf"; ctx.beginPath(); ctx.ellipse(c[0], c[1] - wallH, RX, RY, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = "#8b94a3"; ctx.beginPath(); ctx.ellipse(c[0], c[1] - wallH, RX * 0.86, RY * 0.86, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = "#3f9d4a"; ctx.beginPath(); ctx.ellipse(c[0], c[1] - wallH, RX * 0.6, RY * 0.6, 0, 0, 6.28); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.65)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(c[0], c[1] - wallH, RX * 0.2, RY * 0.2, 0, 0, 6.28); ctx.stroke(); ctx.beginPath(); ctx.moveTo(c[0] - RX * 0.6, c[1] - wallH); ctx.lineTo(c[0] + RX * 0.6, c[1] - wallH); ctx.stroke();
      [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]].forEach(([dx, dy]) => { const p = w2s(st.gx + dx, st.gy + dy); ctx.strokeStyle = "#444b55"; ctx.lineWidth = 1.5 * z; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 26 * z); ctx.stroke(); ctx.fillStyle = "#fffbe0"; ctx.fillRect(p[0] - 3 * z, p[1] - 30 * z, 6 * z, 4 * z); });
    }
    function drawPark(pk) {
      poly([w2s(pk.gx - 0.9, pk.gy - 0.9), w2s(pk.gx + 0.9, pk.gy - 0.9), w2s(pk.gx + 0.9, pk.gy + 0.9), w2s(pk.gx - 0.9, pk.gy + 0.9)], "#86bd6b");
      poly([w2s(pk.gx - 0.5, pk.gy - 0.5), w2s(pk.gx + 0.55, pk.gy - 0.2), w2s(pk.gx + 0.3, pk.gy + 0.5), w2s(pk.gx - 0.45, pk.gy + 0.25)], "#4a90c2");
      [[-0.6, -0.6], [0.65, -0.5], [0.6, 0.6], [-0.55, 0.6], [0, -0.72]].forEach(([dx, dy]) => drawTree({ gx: pk.gx + dx, gy: pk.gy + dy }, clock));
    }
    function drawRiver() {
      poly([w2s(riverX - riverW, 0), w2s(riverX + riverW, 0), w2s(riverX + riverW, layout.extentY), w2s(riverX - riverW, layout.extentY)], "#3f86bf");
      ctx.strokeStyle = "rgba(255,255,255,0.16)"; ctx.lineWidth = 1; const off = (clock * 0.6) % 1.4;
      for (let y = -1.4; y < layout.extentY; y += 1.4) { const a = w2s(riverX - riverW * 0.7, y + off), b = w2s(riverX + riverW * 0.7, y + off); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    }
    function drawBridge(by) {
      poly([w2s(riverX - riverW - 0.4, by - 0.85), w2s(riverX + riverW + 0.4, by - 0.85), w2s(riverX + riverW + 0.4, by + 0.85), w2s(riverX - riverW - 0.4, by + 0.85)], "#9a8b73");
      const a = w2s(riverX - riverW - 0.4, by - 0.85), b = w2s(riverX + riverW + 0.4, by - 0.85), c = w2s(riverX + riverW + 0.4, by + 0.85), d = w2s(riverX - riverW - 0.4, by + 0.85);
      ctx.strokeStyle = "#6b5d49"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(d[0], d[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
    }
    function drawBoat(bt) {
      const s = w2s(riverX, bt.pos), z = cam.zoom;
      ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.beginPath(); ctx.ellipse(s[0], s[1] + 2 * z, 7 * z, 2.2 * z, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = "#6b4f33"; ctx.beginPath(); ctx.ellipse(s[0], s[1], 5 * z, 2.6 * z, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = bt.color; ctx.fillRect(s[0] - 1.4 * z, s[1] - 7 * z, 2.8 * z, 6 * z);
    }
    function drawBalloon() {
      const bx = balloon.x, by = balloon.y + Math.sin(balloon.ph) * 5;
      ctx.fillStyle = "#e2574c"; ctx.beginPath(); ctx.ellipse(bx, by, 15, 18, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = "#f5b301"; ctx.beginPath(); ctx.ellipse(bx, by, 5, 18, 0, 0, 6.28); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx - 6, by + 13); ctx.lineTo(bx - 3, by + 25); ctx.moveTo(bx + 6, by + 13); ctx.lineTo(bx + 3, by + 25); ctx.stroke();
      ctx.fillStyle = "#7a5235"; ctx.fillRect(bx - 4, by + 24, 8, 5);
    }
    function drawMinimap() {
      const mw = 138, mh = 100, mx = W - mw - 12, my = H - mh - 14, pad = 8;
      ctx.fillStyle = "rgba(2,8,23,0.62)"; ctx.fillRect(mx, my, mw, mh);
      const sc = Math.min((mw - pad * 2) / layout.extentX, (mh - pad * 2) / layout.extentY);
      const m2 = (gx, gy) => [mx + pad + gx * sc, my + pad + gy * sc];
      layout.plates.forEach(p => { const a = m2(p.gx, p.gy); ctx.fillStyle = BG_COLORS[p.bu] || "#9aa2b0"; ctx.fillRect(a[0], a[1], p.size * sc, p.size * sc); });
      const inv = (px, py) => { const ix = (px - cam.ox) / cam.zoom, iy = (py - cam.oy) / cam.zoom; return [(ix / (TW / 2) + iy / (TH / 2)) / 2, (iy / (TH / 2) - ix / (TW / 2)) / 2]; };
      const cs = [inv(0, 0), inv(W, 0), inv(W, H), inv(0, H)], gxs = cs.map(c => c[0]), gys = cs.map(c => c[1]);
      const v0 = m2(Math.max(0, Math.min(...gxs)), Math.max(0, Math.min(...gys))), v1 = m2(Math.min(layout.extentX, Math.max(...gxs)), Math.min(layout.extentY, Math.max(...gys)));
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5; ctx.strokeRect(v0[0], v0[1], v1[0] - v0[0], v1[1] - v0[1]);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "9px 'DM Sans', sans-serif"; ctx.textAlign = "left"; ctx.fillText("map · click to jump", mx + 6, my - 4);
      mmGeom = { mx, my, mw, mh, pad, sc };
    }
    function spawnFirework() {
      const tx = stadium ? w2s(stadium.gx, stadium.gy)[0] : W * (0.3 + Math.random() * 0.4);
      fireworks.push({ x: tx + (Math.random() * 60 - 30), y: H, ty: H * (0.16 + Math.random() * 0.22), state: "rise", color: `hsl(${Math.floor(Math.random() * 360)},90%,62%)`, parts: [] });
    }
    function updateFireworks(dt) {
      for (let i = fireworks.length - 1; i >= 0; i--) {
        const fw = fireworks[i];
        if (fw.state === "rise") {
          fw.y -= 300 * dt;
          ctx.fillStyle = "rgba(255,240,200,0.85)"; ctx.beginPath(); ctx.arc(fw.x, fw.y, 1.8, 0, 6.28); ctx.fill();
          if (fw.y <= fw.ty) { fw.state = "burst"; for (let k = 0; k < 42; k++) { const a = Math.random() * 6.28, sp = 40 + Math.random() * 95; fw.parts.push({ x: fw.x, y: fw.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 }); } }
        } else {
          let alive = false; ctx.save(); ctx.globalCompositeOperation = "lighter";
          fw.parts.forEach(p => { if (p.life <= 0) return; alive = true; p.life -= dt * 0.7; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 52 * dt; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = fw.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 6.28); ctx.fill(); });
          ctx.restore(); if (!alive) fireworks.splice(i, 1);
        }
      }
    }

    function frame(now) {
      if (pausedRef.current || document.hidden) { last = now; raf = requestAnimationFrame(frame); return; } // skip all work while an interior is open or tab is hidden
      const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
      cam.fps = (cam.fps || 60) * 0.92 + (1 / Math.max(dt, 0.001)) * 0.08; // smoothed; shown when URL has #fps
      const tod = timeOfDay(), sky = skyState(tod), ang = sky.ang;
      const rain = Math.max(0, Math.min(1, (Math.sin(Date.now() / 1000 * 0.045) - 0.42) / 0.5)); // slow weather cycle
      const season = seasonState(Date.now() / 1000); curSeason = season;
      const hour = tod * 24, activity = Math.min(1, 0.18 + 0.5 * sky.day + 0.45 * Math.exp(-Math.pow(hour - 8.5, 2) / 3) + 0.45 * Math.exp(-Math.pow(hour - 17.5, 2) / 3));
      const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, sky.top); grad.addColorStop(1, sky.bot); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      if (rain > 0.02) { ctx.fillStyle = `rgba(70,80,96,${rain * 0.55})`; ctx.fillRect(0, 0, W, H); } // storm overcast
      const sunx = (0.5 - 0.46 * Math.cos(ang)) * W, suny = (0.62 - 0.5 * Math.sin(ang)) * H;
      if (suny < H * 0.66 && rain < 0.45) { ctx.save(); ctx.shadowColor = "#ffd66b"; ctx.shadowBlur = 34; ctx.fillStyle = "#fff2a8"; ctx.beginPath(); ctx.arc(sunx, suny, 16, 0, 6.28); ctx.fill(); ctx.restore(); }
      balloon.x += dt * 9; if (balloon.x > W + 150) { balloon.x = -150; balloon.y = 55 + Math.random() * 70; } balloon.ph += dt; if (rain < 0.5) drawBalloon();
      if (sky.day > 0.4 && rain < 0.4) { ctx.strokeStyle = "rgba(40,46,56,0.8)"; ctx.lineWidth = 1.4; birds.forEach(bd => { bd.x += bd.spd * dt; if (bd.x > 1.1) bd.x = -0.1; bd.ph += dt * 9; const bxp = bd.x * W, wy = Math.sin(bd.ph) * 2.5; ctx.beginPath(); ctx.moveTo(bxp - 5, bd.y + wy); ctx.lineTo(bxp, bd.y); ctx.lineTo(bxp + 5, bd.y + wy); ctx.stroke(); }); }
      if (sky.night > 0.4) { plane.x += dt * 0.05; if (plane.x > 1.2) plane.x = -0.2; const pxp = plane.x * W; ctx.fillStyle = "#aeb6c4"; ctx.beginPath(); ctx.moveTo(pxp, plane.y); ctx.lineTo(pxp - 14, plane.y + 3); ctx.lineTo(pxp - 14, plane.y - 3); ctx.closePath(); ctx.fill(); ctx.fillStyle = Math.sin(clock * 6) > 0 ? "#ff5a5a" : "#601c1c"; ctx.beginPath(); ctx.arc(pxp - 14, plane.y, 1.6, 0, 6.28); ctx.fill(); }
      for (let i = 0; i < 5; i++) { const cx = ((clock * (7 + i * 2) + i * 260) % (W + 240)) - 120, cy = 36 + i * 30; cloud(cx, cy, 16 + i * 4, 0.5 * sky.day + 0.06 + rain * 0.5); }
      plate(0, 0, span, season.snow > 0.5 ? "#d2dadf" : "#8f9385"); // road base (snowy in winter)
      layout.plates.forEach(p => plate(p.gx, p.gy, p.size, season.grass)); // seasonal grass
      if (hasRiver) { drawRiver(); bridges.forEach(drawBridge); }
      const move = o => { o.pos += o.dir * o.spd * dt; if (o.pos > span) o.pos = 0; else if (o.pos < 0) o.pos = span; o.gx = o.axis === "v" ? o.fixed : o.pos; o.gy = o.axis === "v" ? o.pos : o.fixed; };
      cars.forEach(move); peds.forEach(move);
      boats.forEach(bt => { bt.pos += bt.dir * bt.spd * dt; if (bt.pos > layout.extentY) bt.pos = 0; else if (bt.pos < 0) bt.pos = layout.extentY; });
      const items = [];
      // viewport culling: only assemble/sort/draw items near the visible canvas.
      const zc = cam.zoom, PADX = 90 * zc;
      const inView = (gx, gy, pt, pb) => { const sx = ((gx - gy) * TW / 2) * zc + cam.ox, sy = ((gx + gy) * TH / 2) * zc + cam.oy; return sx > -PADX && sx < W + PADX && sy > -pt && sy < H + pb; };
      sorted.forEach(({ b, i }) => { if (inView(b.gx, b.gy, 340 * zc, 90 * zc)) items.push({ d: b.gx + b.gy, kind: "b", b, i }); }); // tall top margin for skyscrapers
      layout.trees.forEach(gt => { if (inView(gt.gx, gt.gy, 50 * zc, 40)) items.push({ d: gt.gx + gt.gy, kind: "t", g: gt }); });
      cars.forEach(c => { if (activity > c.act && inView(c.gx, c.gy, 40, 40)) items.push({ d: c.gx + c.gy, kind: "c", c }); }); // rush-hour density
      peds.forEach(p => { if (activity > p.act && inView(p.gx, p.gy, 40, 40)) items.push({ d: p.gx + p.gy, kind: "p", p }); });
      boats.forEach(bt => items.push({ d: riverX + bt.pos, kind: "boat", bt }));
      fountains.forEach(f => { if (inView(f.gx, f.gy, 60, 60)) items.push({ d: f.gx + f.gy, kind: "f", f }); });
      if (stadium) items.push({ d: stadium.gx + stadium.gy - 0.5, kind: "S", s: stadium });
      if (park) items.push({ d: park.gx + park.gy - 0.5, kind: "K", p: park });
      layout.lamps.forEach(L => { if (inView(L.gx, L.gy, 60 * zc, 30)) items.push({ d: L.gx + L.gy, kind: "l", L }); });
      items.sort((p, q) => p.d - q.d);
      items.forEach(it => {
        if (it.kind === "b") {
          drawBuilding(it.b, it.i === hover, clock);
          ctx.fillStyle = "rgba(20,24,30,0.82)";
          it.b.people.forEach(pn => { pn.ang += pn.spd * dt; const px = it.b.gx + Math.cos(pn.ang) * pn.rad * 0.18, py = it.b.gy + Math.sin(pn.ang) * pn.rad * 0.18; const s = w2s(px, py); ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(1, 1.6 * cam.zoom), 0, 6.28); ctx.fill(); });
        } else if (it.kind === "t") drawTree(it.g, clock);
        else if (it.kind === "l") drawLamp(it.L);
        else if (it.kind === "p") drawPed(it.p);
        else if (it.kind === "f") drawFountain(it.f);
        else if (it.kind === "S") drawStadium(it.s);
        else if (it.kind === "K") drawPark(it.p);
        else if (it.kind === "boat") drawBoat(it.bt);
        else drawCar(it.c);
      });
      // night: darken everything (multiply), then paint warm lights on top
      if (sky.night > 0.02) {
        ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = rgbStr(mix([255, 255, 255], [38, 46, 86], sky.night * 0.82)); ctx.fillRect(0, 0, W, H); ctx.restore();
        if (sky.night > 0.35) { ctx.fillStyle = `rgba(235,240,255,${(sky.night - 0.35) * 1.1})`; for (let i = 0; i < 70; i++) ctx.fillRect((i * 97.13) % W, (i * 53.7) % (H * 0.5), 1.6, 1.6); }
        { const mx2 = (0.5 + 0.46 * Math.cos(ang)) * W, my2 = (0.62 + 0.5 * Math.sin(ang)) * H; if (my2 < H * 0.66) { ctx.save(); ctx.shadowColor = "#cdd6ff"; ctx.shadowBlur = 18; ctx.fillStyle = "#eef2ff"; ctx.beginPath(); ctx.arc(mx2, my2, 12, 0, 6.28); ctx.fill(); ctx.restore(); } }
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        sorted.forEach(({ b }) => { const cc = w2s(b.gx, b.gy), ht = b.h * cam.zoom, gy2 = cc[1] - ht * 0.5, R = b.foot * TW * 0.55 * cam.zoom + ht * 0.35; blitGlow(ctx, cc[0], gy2, R, R, "255,206,120", 0.45 * sky.night); });
        layout.lamps.forEach(L => { const s = w2s(L.gx, L.gy), cy2 = s[1] - 18 * cam.zoom, R = 40 * cam.zoom; blitGlow(ctx, s[0], cy2, R, R, "255,224,150", 0.75 * sky.night); });
        cars.forEach(c => { const s = w2s(c.gx, c.gy); ctx.fillStyle = `rgba(255,247,200,${0.7 * sky.night})`; ctx.beginPath(); ctx.arc(s[0], s[1] - 2 * cam.zoom, 2.6 * cam.zoom, 0, 6.28); ctx.fill(); });
        if (hasRiver) for (let y = 1; y < layout.extentY; y += 2.4) { const p = w2s(riverX + Math.sin(clock + y) * 0.2, y); ctx.fillStyle = `rgba(255,214,140,${0.22 * sky.night})`; ctx.fillRect(p[0] - 1.2, p[1] - 7, 2.4, 14); } // shimmering reflections
        ctx.restore();
      }
      // ── signage: every (on-screen) building shows its department on its facade; the BU name sits on the street right at the front base of its block ──
      ctx.textAlign = "center";
      ctx.font = `${Math.max(8, Math.round(9.5 * Math.min(1.5, cam.zoom)))}px 'DM Sans', sans-serif`;
      sorted.forEach(({ b, i }) => {
        if (i === hover || !inView(b.gx, b.gy, 340 * zc, 90 * zc)) return;
        const cc = w2s(b.gx, b.gy), ly = cc[1] - Math.max(7, b.h * cam.zoom * 0.5), w = ctx.measureText(b.name).width + 7;
        ctx.fillStyle = "rgba(15,23,42,0.5)"; ctx.fillRect(cc[0] - w / 2, ly - 6, w, 12);
        ctx.fillStyle = "#eef4ff"; ctx.fillText(b.name, cc[0], ly + 3);
      });
      ctx.font = `bold ${Math.max(10, Math.round(12.5 * Math.min(1.3, cam.zoom)))}px 'DM Sans', sans-serif`;
      layout.districtCenters.forEach(d => {
        const s = w2s(d.gx, d.gy + layout.DSIZE + 0.6), w = ctx.measureText(d.bu).width + 18; // right at the front base of the block
        ctx.fillStyle = "rgba(37,99,235,0.94)"; ctx.fillRect(s[0] - w / 2, s[1] - 9, w, 18);
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(s[0] - w / 2, s[1] + 9, w, 2);
        ctx.fillStyle = "#fff"; ctx.fillText(d.bu, s[0], s[1] + 4);
      });
      ctx.font = `${Math.max(9, Math.round(10 * Math.min(1.3, cam.zoom)))}px 'DM Sans', sans-serif`;
      const landTag = (p, txt, col) => { if (!p) return; const s = w2s(p.gx, p.gy), w = ctx.measureText(txt).width + 12; ctx.fillStyle = col; ctx.fillRect(s[0] - w / 2, s[1] - 44, w, 15); ctx.fillStyle = "#fff"; ctx.fillText(txt, s[0], s[1] - 33); };
      landTag(stadium, "🏟 Arena", "rgba(124,58,237,0.92)"); landTag(park, "🌳 Central Park", "rgba(22,128,80,0.92)");
      if (hover >= 0) { const b = layout.buildings[hover], cc = w2s(b.gx, b.gy), ty = cc[1] - b.h * cam.zoom - 8; ctx.textAlign = "center"; ctx.font = "bold 12px 'DM Sans', sans-serif"; const lbl = `${b.name} · ${b.count}`, w = ctx.measureText(lbl).width + 12; ctx.fillStyle = "rgba(2,8,23,0.88)"; ctx.fillRect(cc[0] - w / 2, ty - 14, w, 18); ctx.fillStyle = "#fff"; ctx.fillText(lbl, cc[0], ty - 1); }
      // rain + lightning
      if (rain > 0.02) {
        const n = Math.floor(drops.length * rain);
        ctx.strokeStyle = `rgba(190,210,235,${0.35 + rain * 0.25})`; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i < n; i++) { const d = drops[i], yy = ((d.y + clock * d.spd) % 1) * H, xx = ((d.x + clock * 0.04) % 1) * W; ctx.moveTo(xx, yy); ctx.lineTo(xx - 5, yy + 13); }
        ctx.stroke();
        boltTimer -= dt; if (rain > 0.55 && boltTimer <= 0) { flash = 0.9; boltTimer = 2.5 + Math.random() * 5; }
      }
      if (flash > 0) { ctx.fillStyle = `rgba(222,232,255,${flash * 0.55})`; ctx.fillRect(0, 0, W, H); flash -= dt * 3; }
      // seasonal: snow whiten + falling leaves/snow
      if (season.snow > 0.05) { ctx.fillStyle = `rgba(236,243,248,${season.snow * 0.2})`; ctx.fillRect(0, 0, W, H); }
      if (season.leaves > 0.05 || season.snow > 0.05) {
        const isSnow = season.snow >= season.leaves, amt = Math.max(season.leaves, season.snow), n = Math.floor(flakes.length * amt);
        for (let i = 0; i < n; i++) { const fk = flakes[i], yy = ((fk.y + clock * fk.spd) % 1) * H, xx = ((fk.x + Math.sin(clock * 0.5 + fk.drift) * 0.03 + 1) % 1) * W;
          if (isSnow) { ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.beginPath(); ctx.arc(xx, yy, 1.7, 0, 6.28); ctx.fill(); }
          else { ctx.save(); ctx.translate(xx, yy); ctx.rotate(fk.rot + clock * 2.5 + i); ctx.fillStyle = i % 2 ? "#d98a3a" : "#bf5a2c"; ctx.fillRect(-2, -1.4, 4, 2.8); ctx.restore(); }
        }
      }
      if (sky.night > 0.5) { fwTimer -= dt; if (fwTimer <= 0) { spawnFirework(); fwTimer = 2.2 + Math.random() * 4; } }
      if (fireworks.length) updateFireworks(dt);
      drawMinimap();
      drawClock(tod, sky, season);
      if (activity > 0.88) { ctx.fillStyle = "rgba(234,88,12,0.92)"; ctx.fillRect(W - 124, 56, 112, 16); ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = "bold 10px 'DM Sans', sans-serif"; ctx.fillText("🚗 RUSH HOUR", W - 68, 67); }
      if (location.hash.indexOf("fps") >= 0) { ctx.fillStyle = "rgba(2,8,23,0.62)"; ctx.fillRect(8, 8, 78, 22); ctx.fillStyle = cam.fps > 50 ? "#9ef7b0" : cam.fps > 30 ? "#ffd66b" : "#ff8a8a"; ctx.font = "bold 13px monospace"; ctx.textAlign = "left"; ctx.fillText(Math.round(cam.fps) + " FPS", 14, 23); }
      raf = requestAnimationFrame(frame);
    }

    function hitTest(mx, my) {
      for (let k = sorted.length - 1; k >= 0; k--) {
        const b = sorted[k].b, bb = bbox(b);
        if (mx >= bb[0] && mx <= bb[2] && my >= bb[1] && my <= bb[3]) return sorted[k].i;
      }
      return -1;
    }

    // interaction
    let dragging = false, lx = 0, ly = 0, moved = false;
    function onDown(e) {
      const rect = canvas.getBoundingClientRect(), mxx = e.clientX - rect.left, myy = e.clientY - rect.top;
      if (mmGeom && mxx >= mmGeom.mx && mxx <= mmGeom.mx + mmGeom.mw && myy >= mmGeom.my && myy <= mmGeom.my + mmGeom.mh) {
        centerOn((mxx - mmGeom.mx - mmGeom.pad) / mmGeom.sc, (myy - mmGeom.my - mmGeom.pad) / mmGeom.sc); return; // jump via minimap
      }
      dragging = true; moved = false; lx = e.clientX; ly = e.clientY; canvas.style.cursor = "grabbing";
    }
    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      if (dragging) { cam.ox += e.clientX - lx; cam.oy += e.clientY - ly; lx = e.clientX; ly = e.clientY; if (Math.abs(e.clientX) + Math.abs(e.clientY)) moved = true; return; }
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const h = hitTest(mx, my); hover = h;
      const tip = tipRef.current;
      if (h >= 0 && tip) { const b = layout.buildings[h]; tip.style.display = "block"; tip.style.left = (mx + 14) + "px"; tip.style.top = (my + 12) + "px"; tip.innerHTML = `<b>${b.name}</b><br/>${b.bu}<br/>${b.count} ${b.count === 1 ? "person" : "people"}`; canvas.style.cursor = "pointer"; }
      else if (tip) { tip.style.display = "none"; canvas.style.cursor = "grab"; }
    }
    function onUp() { dragging = false; canvas.style.cursor = "grab"; }
    function onClick(e) {
      if (moved) return;
      const rect = canvas.getBoundingClientRect();
      const h = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (h >= 0) setInteriorRef.current(layout.buildings[h]);
    }
    function onWheel(e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const k = e.deltaY < 0 ? 1.12 : 1 / 1.12, nz = Math.max(0.25, Math.min(2.5, cam.zoom * k)), f = nz / cam.zoom;
      cam.ox = mx - (mx - cam.ox) * f; cam.oy = my - (my - cam.oy) * f; cam.zoom = nz;
    }
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const ro = new ResizeObserver(() => {
      W = mount.clientWidth || 800; H = mount.clientHeight || 600;
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); centerCam();
    });
    ro.observe(mount);
    W = mount.clientWidth || 800; H = mount.clientHeight || 600;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); centerCam();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
      if (canvas.parentNode === mount) mount.removeChild(canvas);
    };
  }, [layout]);

  if (!activeEmployees || activeEmployees.length === 0) {
    return <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">No data</div>;
  }
  return (
    <div className="flex-1 min-h-0 w-full relative overflow-hidden" style={{ background: "#bfe3ff" }}>
      <div ref={mountRef} className="absolute inset-0" />
      <div ref={tipRef} className="absolute pointer-events-none px-2 py-1 rounded text-white text-xs"
        style={{ display: "none", background: "rgba(15,23,42,0.92)", border: "1px solid rgba(148,163,184,0.4)", zIndex: 20, lineHeight: 1.4 }} />
      <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-md text-white" style={{ fontSize: 12, fontWeight: 700, background: "rgba(2,8,23,0.55)", backdropFilter: "blur(4px)" }}>
        🏙 Org City <span style={{ fontWeight: 400, fontSize: 11, opacity: 0.85 }}>· {layout.districtCenters.length} districts · {layout.buildings.length} teams · {(activeEmployees ? activeEmployees.length : 0).toLocaleString()} people · taller building = bigger team</span>
      </div>
      <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-md" style={{ fontSize: 11, background: "rgba(2,8,23,0.5)", color: "#dbe7ff", backdropFilter: "blur(4px)" }}>
        drag to pan · scroll to zoom · hover a building for the team · <b>click a building to step inside</b>
      </div>
      {interior && <BuildingInterior building={interior} onClose={() => setInterior(null)} onSelect={emp => setDetailRef.current((treeRef.current && treeRef.current.map[emp.id]) || emp)} />}
    </div>
  );
}

function WhiteboardOrgView() {
  const {
    chartDisplayRoot, setDetailPanel,
    getNodeColor, isFiltered,
    showHotspots, hotspotNodeIds,
    showFlightRisk, flightRisks,
  } = useContext(AppCtx);
  const containerRef = useRef(null);
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [autoFitKey, setAutoFitKey] = useState(0);

  const NODE_W = 220, NODE_H = 74, H_GAP = 32, V_GAP = 90, MARGIN = 60;
  const [maxDepth, setMaxDepth] = useState(2);

  const layout = useMemo(() => {
    if (!chartDisplayRoot) return null;
    const positions = new Map();
    let truncated = 0;
    function place(node, x, y, depth) {
      const kids = (depth >= maxDepth ? [] : (node.children || []));
      const hidden = (node.children || []).length - kids.length;
      if (hidden > 0) truncated += hidden;
      if (kids.length === 0) {
        positions.set(node.id, { x, y, node, hiddenChildren: hidden });
        return NODE_W;
      }
      let cursor = x;
      kids.forEach(c => {
        const w = place(c, cursor, y + NODE_H + V_GAP, depth + 1);
        cursor += w + H_GAP;
      });
      const subtreeW = cursor - x - H_GAP;
      const cx = x + Math.max(0, (subtreeW - NODE_W) / 2);
      positions.set(node.id, { x: cx, y, node, hiddenChildren: 0 });
      return Math.max(subtreeW, NODE_W);
    }
    place(chartDisplayRoot, 0, 0, 0);
    let minX = Infinity, maxX = -Infinity, maxY = 0;
    positions.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + NODE_W);
      maxY = Math.max(maxY, p.y + NODE_H);
    });
    return {
      positions,
      width: (maxX - minX) + MARGIN * 2,
      height: maxY + MARGIN * 2,
      offsetX: -minX + MARGIN,
      offsetY: MARGIN,
      truncated,
    };
  }, [chartDisplayRoot, maxDepth]);

  useEffect(() => {
    if (!layout || !svgRef.current || !window.rough) return;
    const svgEl = svgRef.current;
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    const rc = window.rough.svg(svgEl);

    // Edges
    const edgeGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layout.positions.forEach(({ node, x, y }) => {
      const kids = node.children || [];
      kids.forEach(c => {
        const cp = layout.positions.get(c.id);
        if (!cp) return;
        const x1 = x + layout.offsetX + NODE_W / 2;
        const y1 = y + layout.offsetY + NODE_H;
        const x2 = cp.x + layout.offsetX + NODE_W / 2;
        const y2 = cp.y + layout.offsetY;
        const midY = (y1 + y2) / 2;
        const path = `M ${x1},${y1} L ${x1},${midY} L ${x2},${midY} L ${x2},${y2}`;
        edgeGroup.appendChild(rc.path(path, {
          stroke: "rgba(40, 30, 20, 0.55)", strokeWidth: 1.4, roughness: 1.7, bowing: 1.4,
        }));
      });
    });
    svgEl.appendChild(edgeGroup);

    // Department zones (sketchy hachure backgrounds)
    const byDept = {};
    layout.positions.forEach(({ node, x, y }) => {
      const d = node.dept;
      if (!d) return;
      (byDept[d] = byDept[d] || []).push({ x, y });
    });
    const zoneGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    Object.entries(byDept).forEach(([dept, points]) => {
      if (points.length < 2) return;
      const xs = points.map(p => p.x), ys = points.map(p => p.y);
      const x0 = Math.min(...xs) + layout.offsetX - 14;
      const x1 = Math.max(...xs) + layout.offsetX + NODE_W + 14;
      const y0 = Math.min(...ys) + layout.offsetY - 14;
      const y1 = Math.max(...ys) + layout.offsetY + NODE_H + 18;
      const color = DEPT_COLORS[dept] || "#64748b";
      const zone = rc.rectangle(x0, y0, x1 - x0, y1 - y0, {
        stroke: color, strokeWidth: 1.1, fill: color,
        fillStyle: "hachure", hachureGap: 16, hachureAngle: -30,
        fillWeight: 0.5, roughness: 2.2, bowing: 2.0,
      });
      Array.from(zone.querySelectorAll("path")).forEach(p => p.setAttribute("opacity", "0.28"));
      zoneGroup.appendChild(zone);
    });
    svgEl.insertBefore(zoneGroup, edgeGroup);

    // Nodes
    layout.positions.forEach(({ node, x, y, hiddenChildren }) => {
      const color = getNodeColor(node);
      const dimmed = !isFiltered(node);
      const isHotspot = showHotspots && hotspotNodeIds.has(node.id);
      const fr = showFlightRisk ? (flightRisks?.byEmployee?.[node.id] || flightRisks?.[node.id]) : null;
      const isDeparted = node.status && node.status !== "Active";

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("transform", `translate(${x + layout.offsetX}, ${y + layout.offsetY})`);
      g.style.cursor = "pointer";
      if (dimmed) g.setAttribute("opacity", "0.28");
      if (isDeparted) g.setAttribute("opacity", "0.45");
      g.addEventListener("click", (ev) => { ev.stopPropagation(); setDetailPanel(node); });

      const card = rc.rectangle(0, 0, NODE_W, NODE_H, {
        stroke: color, strokeWidth: 1.8, fill: color,
        fillStyle: "solid", fillWeight: 1, roughness: 1.5,
      });
      Array.from(card.querySelectorAll("path")).forEach(p => {
        if (p.getAttribute("fill") && p.getAttribute("fill") !== "none") {
          p.setAttribute("fill-opacity", "0.16");
        }
      });
      g.appendChild(card);

      g.appendChild(rc.line(0, 0, 0, NODE_H, { stroke: color, strokeWidth: 4, roughness: 0.9 }));

      const av = rc.circle(28, NODE_H / 2, 32, {
        stroke: color, strokeWidth: 1.5, fill: color, fillStyle: "solid", roughness: 1.6,
      });
      Array.from(av.querySelectorAll("path")).forEach(p => {
        if (p.getAttribute("fill") && p.getAttribute("fill") !== "none") {
          p.setAttribute("fill-opacity", "0.25");
        }
      });
      g.appendChild(av);

      const init = document.createElementNS("http://www.w3.org/2000/svg", "text");
      init.setAttribute("x", 28); init.setAttribute("y", NODE_H / 2 + 5);
      init.setAttribute("text-anchor", "middle");
      init.setAttribute("font-family", "'Caveat', cursive");
      init.setAttribute("font-size", "19"); init.setAttribute("font-weight", "700");
      init.setAttribute("fill", color);
      init.style.pointerEvents = "none";
      init.textContent = (node.first?.[0] || "") + (node.last?.[0] || "");
      g.appendChild(init);

      const name = document.createElementNS("http://www.w3.org/2000/svg", "text");
      name.setAttribute("x", 54); name.setAttribute("y", 26);
      name.setAttribute("font-family", "'Caveat', cursive");
      name.setAttribute("font-size", "19"); name.setAttribute("font-weight", "700");
      name.setAttribute("fill", "#111827");
      name.style.pointerEvents = "none";
      name.textContent = `${node.first || ""} ${node.last || ""}`.trim();
      g.appendChild(name);

      const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
      title.setAttribute("x", 54); title.setAttribute("y", 44);
      title.setAttribute("font-family", "'Patrick Hand', cursive");
      title.setAttribute("font-size", "13");
      title.setAttribute("fill", "#4b5563");
      title.style.pointerEvents = "none";
      const t = node.title || "";
      title.textContent = t.length > 28 ? t.slice(0, 26) + "…" : t;
      g.appendChild(title);

      const tag = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tag.setAttribute("x", 54); tag.setAttribute("y", 62);
      tag.setAttribute("font-family", "'Patrick Hand', cursive");
      tag.setAttribute("font-size", "11");
      tag.setAttribute("fill", color);
      tag.style.pointerEvents = "none";
      tag.textContent = `#${(node.dept || "").toLowerCase()}${node.location ? "  ·  " + node.location.toLowerCase() : ""}`;
      g.appendChild(tag);

      if (isHotspot) {
        const flag = rc.circle(NODE_W - 14, 14, 16, {
          stroke: "#dc2626", strokeWidth: 1.6, fill: "#fecaca",
          fillStyle: "solid", roughness: 1.6,
        });
        g.appendChild(flag);
        const ex = document.createElementNS("http://www.w3.org/2000/svg", "text");
        ex.setAttribute("x", NODE_W - 14); ex.setAttribute("y", 18);
        ex.setAttribute("text-anchor", "middle");
        ex.setAttribute("font-family", "'Caveat', cursive");
        ex.setAttribute("font-size", "14"); ex.setAttribute("font-weight", "700");
        ex.setAttribute("fill", "#991b1b");
        ex.style.pointerEvents = "none";
        ex.textContent = "!";
        g.appendChild(ex);
      }
      if (fr && fr.score >= 60) {
        const ring = rc.rectangle(-3, -3, NODE_W + 6, NODE_H + 6, {
          stroke: "#f97316", strokeWidth: 1.4, roughness: 2.0,
        });
        g.appendChild(ring);
      }

      if (hiddenChildren > 0) {
        const more = rc.rectangle(NODE_W / 2 - 36, NODE_H + 8, 72, 22, {
          stroke: "#1f2937", strokeWidth: 1.2, fill: "#fde68a",
          fillStyle: "solid", roughness: 1.6,
        });
        Array.from(more.querySelectorAll("path")).forEach(p => {
          if (p.getAttribute("fill") && p.getAttribute("fill") !== "none") {
            p.setAttribute("fill-opacity", "0.85");
          }
        });
        g.appendChild(more);
        const mt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        mt.setAttribute("x", NODE_W / 2); mt.setAttribute("y", NODE_H + 23);
        mt.setAttribute("text-anchor", "middle");
        mt.setAttribute("font-family", "'Caveat', cursive");
        mt.setAttribute("font-size", "15"); mt.setAttribute("font-weight", "700");
        mt.setAttribute("fill", "#92400e");
        mt.style.pointerEvents = "none";
        mt.textContent = `+${hiddenChildren} more`;
        g.appendChild(mt);
      }

      svgEl.appendChild(g);
    });
  }, [layout, getNodeColor, isFiltered, showHotspots, hotspotNodeIds, showFlightRisk, flightRisks, setDetailPanel]);

  // Fit to screen whenever layout changes or container resizes
  useEffect(() => {
    if (!layout || !containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    if (!cw || !ch) return;
    const s = Math.max(0.08, Math.min(cw / layout.width, ch / layout.height, 1) * 0.92);
    setScale(s);
    setPan({ x: (cw - layout.width * s) / 2, y: (ch - layout.height * s) / 2 });
  }, [layout, autoFitKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAutoFitKey(k => k + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onWheel = (e) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setScale(prev => {
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = Math.max(0.1, Math.min(4, prev * factor));
      setPan(p => ({
        x: mx - (mx - p.x) * (next / prev),
        y: my - (my - p.y) * (next / prev),
      }));
      return next;
    });
  };

  const dragRef = useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0 });
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("g[transform]") && e.target.tagName !== "svg") return; // let node clicks through
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    containerRef.current.style.cursor = "grabbing";
  };
  const onMouseMove = (e) => {
    if (!dragRef.current.active) return;
    setPan({
      x: dragRef.current.px + (e.clientX - dragRef.current.sx),
      y: dragRef.current.py + (e.clientY - dragRef.current.sy),
    });
  };
  const onMouseUp = () => {
    dragRef.current.active = false;
    if (containerRef.current) containerRef.current.style.cursor = "grab";
  };

  if (!chartDisplayRoot) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">No data</div>;
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-hidden"
      style={{
        cursor: "grab",
        background: "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.6), transparent 50%), radial-gradient(circle at 82% 78%, rgba(255,255,255,0.4), transparent 50%), #fdfbf3",
        backgroundImage: "linear-gradient(rgba(120,90,50,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(120,90,50,0.05) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div ref={wrapRef} style={{ position: "absolute", transformOrigin: "0 0", transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
        <svg ref={svgRef} width={layout?.width || 800} height={layout?.height || 400} style={{ display: "block" }}/>
      </div>

      <div className="absolute top-3 left-3 px-3 py-1.5 rounded bg-white/85 border-2 border-stone-700/30 text-stone-700"
        style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700, transform: "rotate(-1deg)" }}>
        The Org <span style={{ color: "#b91c1c", fontSize: 18 }}>— v.draft</span>
      </div>

      <div className="absolute top-3 right-3 bg-white/90 border-2 border-stone-700/30 rounded-md px-3 py-1.5 flex items-center gap-2 text-stone-700"
        style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 13 }}>
        <span>depth:</span>
        <button onClick={() => setMaxDepth(d => Math.max(1, d - 1))} className="w-6 h-6 rounded hover:bg-amber-100">−</button>
        <span className="tabular-nums w-4 text-center">{maxDepth}</span>
        <button onClick={() => setMaxDepth(d => Math.min(15, d + 1))} className="w-6 h-6 rounded hover:bg-amber-100">+</button>
        {layout?.truncated > 0 && (
          <span className="text-stone-500 ml-2" style={{ fontSize: 11 }}>
            ({layout.truncated} hidden — focus a subtree to see them)
          </span>
        )}
      </div>

      <div className="absolute bottom-3 right-3 bg-white/90 border-2 border-stone-700/30 rounded-md px-3 py-2 text-stone-700 max-w-[220px]"
        style={{ fontFamily: "'Patrick Hand', cursive", fontSize: 12, transform: "rotate(-1deg)" }}>
        click cards for details · drag to pan · scroll to zoom
      </div>

      <div className="absolute bottom-3 left-3 bg-white/90 border-2 border-stone-700/30 rounded-full p-1 flex items-center gap-1"
        style={{ fontFamily: "'Patrick Hand', cursive" }}>
        <button
          onClick={() => setScale(s => Math.max(0.1, s / 1.2))}
          className="w-7 h-7 rounded-full hover:bg-amber-100 text-base"
          title="Zoom out">−</button>
        <span className="text-xs px-2 tabular-nums w-12 text-center">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale(s => Math.min(4, s * 1.2))}
          className="w-7 h-7 rounded-full hover:bg-amber-100 text-base"
          title="Zoom in">+</button>
        <button
          onClick={() => setAutoFitKey(k => k + 1)}
          className="px-2 h-7 rounded-full hover:bg-amber-100 text-xs"
          title="Fit to screen">⤢ fit</button>
      </div>
    </div>
  );
}

// ─── TREEMAP ORG VIEW (pure CSS — no Recharts dependency) ───
function TreemapOrgView() {
  const { activeEmployees, setOrgViewMode, setFocusRoot, tree, setExpandedNodes } = useContext(AppCtx);
  const [hovered, setHovered] = useState(null);

  const data = useMemo(() => {
    const total = activeEmployees.length || 1;
    return [...new Set(activeEmployees.map(e => e.dept))]
      .map(d => {
        const size = activeEmployees.filter(e => e.dept === d).length;
        return { name: d, size, pct: size / total * 100, fill: DEPT_COLORS[d] || "#64748b" };
      })
      .sort((a, b) => b.size - a.size);
  }, [activeEmployees]);

  return (
    <div className="h-full p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">Treemap — headcount by department · click to drill into tree</span>
        {hovered && (
          <span className="ml-auto text-xs bg-gray-800 text-white px-2 py-1 rounded">
            {hovered.name}: <strong>{hovered.size}</strong> ({hovered.pct.toFixed(1)}%)
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-wrap gap-1" style={{ alignContent: "flex-start", minHeight: 0 }}>
        {data.map(d => {
          const isHov = hovered?.name === d.name;
          const big = d.pct > 8;
          const med = d.pct > 3;
          return (
            <div
              key={d.name}
              style={{
                flexGrow: d.size,
                flexBasis: `${Math.min(Math.max(d.pct * 1.9, 8), 100)}%`,
                minHeight: big ? 80 : med ? 56 : 40,
                background: d.fill,
                opacity: isHov ? 1 : 0.82,
                borderRadius: 6,
                cursor: "pointer",
                transition: "opacity 0.15s, transform 0.1s",
                transform: isHov ? "scale(1.02)" : "scale(1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 6,
                boxSizing: "border-box",
                overflow: "hidden",
              }}
              onClick={() => {
                const nodes = Object.values(tree.map).filter(n => n.dept === d.name);
                nodes.sort((a, b) => levelIndex(b.level) - levelIndex(a.level));
                if (nodes[0]) {
                  setFocusRoot(nodes[0].id);
                  setExpandedNodes(prev => {
                    const next = new Set(prev);
                    next.add(nodes[0].id);
                    nodes[0].children.forEach(c => next.add(c.id));
                    return next;
                  });
                }
                setOrgViewMode("tree");
              }}
              onMouseEnter={() => setHovered(d)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ color: "white", textAlign: "center", pointerEvents: "none" }}>
                <div style={{ fontSize: big ? 12 : 10, fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.5)", lineHeight: 1.2 }}>
                  {d.pct < 2 ? d.name.split(/\s+/)[0] : d.name}
                </div>
                {med && <div style={{ fontSize: 10, opacity: 0.85 }}>{d.size}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SUNBURST ORG VIEW ───
function SunburstOrgView() {
  const { tree, setFocusRoot, displayRoot, setExpandedNodes } = useContext(AppCtx);
  const [hovered, setHovered] = useState(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState(560);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize(Math.min(e.contentRect.width, e.contentRect.height) - 32));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const root = displayRoot || tree.root;
  if (!root) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">No data</div>;

  const cx = size / 2, cy = size / 2;
  const MAX_DEPTH = 5;
  // Divide by MAX_DEPTH+1 so the outermost ring (depth=MAX_DEPTH) stays inside the SVG
  const RING_W = Math.floor((size / 2 - 8) / (MAX_DEPTH + 1));

  // BFS to collect arcs
  function buildArcs(node, startAngle, endAngle, depth) {
    const arcs = [];
    if (depth > MAX_DEPTH) return arcs;
    const sweep = endAngle - startAngle;
    arcs.push({ node, startAngle, endAngle, depth });
    if (node.children.length && depth < MAX_DEPTH) {
      const total = node._totalReports || node.children.length;
      let a = startAngle;
      node.children.forEach(child => {
        const share = (child._totalReports + 1) / (total || 1);
        const ea = a + sweep * share;
        arcs.push(...buildArcs(child, a, ea, depth + 1));
        a = ea;
      });
    }
    return arcs;
  }

  const arcs = useMemo(() => buildArcs(root, -Math.PI / 2, 3 * Math.PI / 2, 0), [root, size]);

  function polarToXY(angle, r) { return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }; }

  function describeArc(startAngle, endAngle, innerR, outerR) {
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const s1 = polarToXY(startAngle, innerR);
    const s2 = polarToXY(startAngle, outerR);
    const e1 = polarToXY(endAngle, innerR);
    const e2 = polarToXY(endAngle, outerR);
    return `M${s2.x},${s2.y} A${outerR},${outerR},0,${large},1,${e2.x},${e2.y} L${e1.x},${e1.y} A${innerR},${innerR},0,${large},0,${s1.x},${s1.y} Z`;
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col items-center justify-center p-4">
      <div className="text-sm font-semibold text-gray-600 mb-2">
        Sunburst — concentric rings by org level. Hover for details, click to focus.
      </div>
      <svg width={size} height={size} style={{ display: "block" }}>
        {/* Center circle = root */}
        <circle cx={cx} cy={cy} r={RING_W - 4} fill={DEPT_COLORS[root.dept] || "#2563eb"} fillOpacity={0.9}
          style={{ cursor: "pointer" }} onClick={() => setFocusRoot(null)}/>
        <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize={10} fontWeight={700}>{root.first}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={8}>{root.last}</text>

        {arcs.filter(a => a.depth > 0 && a.endAngle - a.startAngle > 0.015).map((a, i) => {
          const innerR = a.depth * RING_W;
          const outerR = (a.depth + 1) * RING_W - 3;
          const fill   = DEPT_COLORS[a.node.dept] || "#64748b";
          const isFoc  = hovered?.node.id === a.node.id;
          const midA   = (a.startAngle + a.endAngle) / 2;
          const labelR = (innerR + outerR) / 2;
          const showLabel = (a.endAngle - a.startAngle) > 0.25 && (outerR - innerR) > 16;
          return (
            <g key={i}>
              <path d={describeArc(a.startAngle, a.endAngle, innerR, outerR)}
                fill={fill} fillOpacity={isFoc ? 1 : 0.75}
                stroke="white" strokeWidth={1.5}
                style={{ cursor: "pointer", transition: "fill-opacity 0.15s" }}
                onMouseEnter={() => setHovered(a)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  setFocusRoot(a.node.id);
                  setExpandedNodes(prev => {
                    const next = new Set(prev);
                    next.add(a.node.id);
                    a.node.children.forEach(c => next.add(c.id));
                    return next;
                  });
                }}
              />
              {showLabel && (
                <text x={cx + labelR * Math.cos(midA)} y={cy + labelR * Math.sin(midA)}
                  textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={8}
                  style={{ pointerEvents: "none", fontWeight: 600 }}>
                  {a.node.last}
                </text>
              )}
            </g>
          );
        })}

        {/* Hovered tooltip in center if not root */}
        {hovered && (
          <>
            <text x={cx} y={cy - 8} textAnchor="middle" fill="#1e293b" fontSize={10} fontWeight={700}>{hovered.node.first} {hovered.node.last}</text>
            <text x={cx} y={cy + 6} textAnchor="middle" fill="#475569" fontSize={8}>{hovered.node.dept}</text>
            <text x={cx} y={cy + 18} textAnchor="middle" fill="#94a3b8" fontSize={8}>{hovered.node._totalReports} reports</text>
          </>
        )}
      </svg>
    </div>
  );
}

// ─── PRODUCT PIPELINE ───
// G&A (Finance/HR/Legal/IT/Facilities) supports every stage of every product line.
// Target eng:G&A ratio depends on stage category — business stages need more legal/finance
// per engineer, operations stages have more compliance overhead, engineering stages need
// the least relative G&A. Cells are flagged "ga_thin" when actual ratio > target × 1.25.
const GA_DEPTS = ["Finance","HR","Legal","IT","Facilities"];
const STAGE_CAT_GA_TARGET = {  // engineers per 1 G&A
  engineering: 10,
  operations:  8,
  business:    5,
};
const _gaPerPL = (minPerPL, category) => Math.max(1, Math.round(minPerPL / (STAGE_CAT_GA_TARGET[category] || 10)));

const DEFAULT_PIPELINE_STAGES = [
  { id: "concept",      label: "Concept",        sublabel: "Feasibility",   emoji: "💡", depts: ["Corporate Strategy","Applications","Marketing","Sales","Systems Engineering"], minPerPL: 80,  category: "business",     desc: "Market research, product definition, business case, competitive analysis" },
  { id: "architecture", label: "Architecture",   sublabel: "Spec & IP",     emoji: "📐", depts: ["IC Design","Systems Engineering","Applications"],                             minPerPL: 120, category: "engineering",  desc: "System architecture, micro-architecture, IP selection, design partitioning" },
  { id: "rtl",          label: "RTL Design",     sublabel: "Coding",        emoji: "⚙️", depts: ["IC Design","Software"],                                                        minPerPL: 300, category: "engineering",  desc: "RTL design, IP integration, clock/reset strategy, lint & CDC closure" },
  { id: "firmware",     label: "Firmware",       sublabel: "FW & SDK",      emoji: "💾", depts: ["Software","Systems Engineering"],                                             minPerPL: 160, category: "engineering",  desc: "Firmware architecture, driver stack, SDK, security software, BSP development" },
  { id: "verification", label: "Verification",   sublabel: "DV & Formal",   emoji: "🧪", depts: ["Verification","IC Design"],                                                   minPerPL: 240, category: "engineering",  desc: "Functional verification, UVM testbenches, formal verification, emulation" },
  { id: "physical",     label: "Physical Design",sublabel: "PnR",           emoji: "🗺️", depts: ["Physical Design"],                                                             minPerPL: 160, category: "engineering",  desc: "Floorplanning, placement, routing, power grid, timing closure" },
  { id: "dft",          label: "DFT",            sublabel: "Sign-off",      emoji: "🔍", depts: ["Test Engineering","IC Design","Physical Design"],                              minPerPL: 100, category: "engineering",  desc: "ATPG, scan insertion, BIST, LVS/DRC sign-off, parasitic extraction" },
  { id: "tapeout",      label: "Tape-out",       sublabel: "GDS",           emoji: "🎬", depts: ["Physical Design","Process Engineering","IC Design"],                          minPerPL: 120, category: "engineering",  desc: "GDS streaming, mask data prep, PDK sign-off, foundry submission" },
  { id: "fabrication",  label: "Fabrication",    sublabel: "Wafer Fab",     emoji: "🏭", depts: ["Manufacturing","Process Engineering"],                                        minPerPL: 100, category: "operations",   desc: "Wafer fabrication, inline monitoring, yield learning, process excursions" },
  { id: "bringup",      label: "Bring-up",       sublabel: "Silicon Val.",  emoji: "🔬", depts: ["Product Engineering","IC Design","Software"],                                 minPerPL: 120, category: "engineering",  desc: "First silicon validation, functional bring-up, debug, errata discovery" },
  { id: "testdev",      label: "Test Dev",       sublabel: "ATE",           emoji: "⚡", depts: ["Test Engineering","Product Engineering"],                                     minPerPL: 100, category: "engineering",  desc: "ATE test program, test coverage, production test time optimization" },
  { id: "qualification",label: "Qualification",  sublabel: "Reliability",   emoji: "✅", depts: ["Quality & Reliability","Product Engineering"],                               minPerPL: 80,  category: "operations",   desc: "JEDEC qualification, burn-in, AEC-Q100/Q101 compliance, MSL testing" },
  { id: "production",   label: "Production",     sublabel: "Ramp",          emoji: "📈", depts: ["Manufacturing","Supply Chain","Quality & Reliability"],                      minPerPL: 100, category: "operations",   desc: "Volume ramp, supply chain optimization, cost reduction, packaging" },
  { id: "customer",     label: "Customer",       sublabel: "Enablement",    emoji: "🤝", depts: ["Applications","Field Applications","Software"],                              minPerPL: 100, category: "business",     desc: "Reference designs, eval kits, customer design-in support, FAE engagement" },
  { id: "revenue",      label: "Revenue",        sublabel: "Growth",        emoji: "💰", depts: ["Sales","Marketing","Finance"],                                               minPerPL: 80,  category: "business",     desc: "Customer wins, design-ins, revenue recognition, market share growth" },
].map(s => ({ ...s, gaPerPL: _gaPerPL(s.minPerPL, s.category), gaRatioTarget: STAGE_CAT_GA_TARGET[s.category] || 10 }));

const PRODUCT_LINES = [
  { id: "pl1", name: "Automotive ASIC",  code: "AUTO-4K",  node: "7nm", buAffinity: ["Automotive BU"],   color: "#2563eb", bg: "#eff6ff", textColor: "#1d4ed8", emoji: "🚗" },
  { id: "pl2", name: "Data Center SoC",  code: "DC-HPC8",  node: "5nm", buAffinity: ["Data Center BU"],  color: "#7c3aed", bg: "#f5f3ff", textColor: "#6d28d9", emoji: "🖥️" },
];

const STAGE_CAT_COLORS = {
  engineering: { header: "#2563eb" },
  operations:  { header: "#059669" },
  business:    { header: "#7c3aed" },
};

function computeProductLineAssignments(employees) {
  const active = employees.filter(e => e.status === "Active");
  const pl1 = [], pl2 = [], ga = [];
  const GA_SET = new Set(GA_DEPTS);
  active.forEach(e => {
    if (GA_SET.has(e.taxo)) { ga.push(e); return; }
    if (["Automotive BU","Industrial BU"].includes(e.productBU))              pl1.push(e);
    else if (["Data Center BU","Consumer BU","IoT BU"].includes(e.productBU)) pl2.push(e);
    else if (e.productBU === "Corporate")
      (parseInt(e.id.slice(-4)) % 2 === 0 ? pl1 : pl2).push(e);
  });
  return { pl1, pl2, ga };
}

// ─── PRODUCT PIPELINE VIEW ───
function ProductPipelineView() {
  const { employees, flightRisks, exportPipelineConfig, importPipelineConfig } = useContext(AppCtx);
  const [selectedCell, setSelectedCell] = useState(null); // { stageId, plId }
  const [flowPlaying, setFlowPlaying]   = useState(false);
  const [flowPos, setFlowPos]           = useState({ pl1: -1, pl2: -1 });

  // Reorderable pipeline stages — persisted in localStorage so the chosen order survives reload.
  const [stages, setStages] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("orgSimStageOrder") || "null");
      if (Array.isArray(saved) && saved.length === DEFAULT_PIPELINE_STAGES.length) {
        const map = new Map(DEFAULT_PIPELINE_STAGES.map(s => [s.id, s]));
        const reordered = saved.map(id => map.get(id)).filter(Boolean);
        if (reordered.length === DEFAULT_PIPELINE_STAGES.length) return reordered;
      }
    } catch {}
    return DEFAULT_PIPELINE_STAGES;
  });
  useEffect(() => {
    try { localStorage.setItem("orgSimStageOrder", JSON.stringify(stages.map(s => s.id))); } catch {}
  }, [stages]);
  const moveStage = (idx, dir) => {
    setStages(s => {
      const j = idx + dir;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy;
    });
  };
  const resetStageOrder = () => setStages(DEFAULT_PIPELINE_STAGES);
  const isCustomOrder = useMemo(
    () => stages.some((s, i) => s.id !== DEFAULT_PIPELINE_STAGES[i].id),
    [stages]
  );

  const assignments = useMemo(() => computeProductLineAssignments(employees), [employees]);

  // G&A allocation: split G&A pool 50/50 across the two PLs, then weight per stage by minPerPL
  // share so heavier stages (RTL, Verification) get more support than lighter ones (Concept).
  const gaAllocByStage = useMemo(() => {
    const totalMin = stages.reduce((s, st) => s + st.minPerPL, 0) || 1;
    const gaPerPL  = (assignments.ga?.length || 0) / 2;
    const out = {};
    stages.forEach(st => {
      out[st.id] = Math.max(0, Math.round(gaPerPL * st.minPerPL / totalMin));
    });
    return out;
  }, [stages, assignments.ga]);

  const stageEmps = useCallback((stageId, plId) => {
    const stage = stages.find(s => s.id === stageId);
    return stage ? (assignments[plId] || []).filter(e => stage.depts.includes(e.taxo)) : [];
  }, [assignments, stages]);

  // Full grid: stageId → plId → { emps, ga, ratio, warnings, status }
  const grid = useMemo(() => {
    const g = {};
    stages.forEach(stage => {
      g[stage.id] = {};
      PRODUCT_LINES.forEach(pl => {
        const emps = stageEmps(stage.id, pl.id);
        const ga   = gaAllocByStage[stage.id] || 0;
        const ratio = ga > 0 ? emps.length / ga : (emps.length > 0 ? Infinity : 0);
        const warnings = [];
        if (emps.length === 0)                  warnings.push({ type: "critical",     msg: "No coverage — critical gap" });
        else if (emps.length < stage.minPerPL)  warnings.push({ type: "understaffed", msg: `${emps.length} of ${stage.minPerPL} minimum` });
        if (emps.length === 1)                  warnings.push({ type: "spof",         msg: `SPOF: ${emps[0].first} ${emps[0].last}` });
        const hiRisk = emps.filter(e => (flightRisks?.[e.id]?.score || 0) >= 65);
        if (hiRisk.length)                      warnings.push({ type: "flight",       msg: `${hiRisk.length} high flight-risk employee${hiRisk.length > 1 ? "s" : ""}` });
        // G&A ratio check — only meaningful if there's productive headcount to support
        if (emps.length > 0) {
          if (ga === 0)                                       warnings.push({ type: "ga_thin",  msg: `No G&A coverage (target ${stage.gaPerPL} G&A)` });
          else if (ratio > stage.gaRatioTarget * 1.25)        warnings.push({ type: "ga_thin",  msg: `${ratio.toFixed(1)}:1 eng:G&A · target ${stage.gaRatioTarget}:1` });
        }
        const status = emps.length === 0 ? "critical"
          : emps.length === 1 ? "spof"
          : warnings.some(w => w.type === "understaffed") ? "warning"
          : hiRisk.length ? "flight"
          : warnings.some(w => w.type === "ga_thin") ? "ga_thin"
          : "healthy";
        g[stage.id][pl.id] = { emps, ga, ratio, warnings, status };
      });
    });
    return g;
  }, [stages, stageEmps, flightRisks, gaAllocByStage]);

  const bottlenecks = useMemo(() => {
    const issues = [];
    stages.forEach(stage => PRODUCT_LINES.forEach(pl => {
      (grid[stage.id]?.[pl.id]?.warnings || []).forEach(w =>
        issues.push({ stage, pl, warning: w, emps: grid[stage.id][pl.id].emps, ga: grid[stage.id][pl.id].ga, ratio: grid[stage.id][pl.id].ratio })
      );
    }));
    const order = { critical: 0, spof: 1, flight: 2, understaffed: 3, ga_thin: 4 };
    return issues.sort((a, b) => (order[a.warning.type] ?? 9) - (order[b.warning.type] ?? 9));
  }, [grid, stages]);

  // Flow simulation: PL1 leads by 2 stages
  useEffect(() => {
    if (!flowPlaying) return;
    const t = setInterval(() => {
      setFlowPos(prev => {
        const n1 = prev.pl1 + 1, n2 = prev.pl2 + 1;
        if (n1 > stages.length + 1) { setFlowPlaying(false); return { pl1: -1, pl2: -1 }; }
        return { pl1: n1, pl2: n2 };
      });
    }, 420);
    return () => clearInterval(t);
  }, [flowPlaying, stages.length]);

  const STATUS_STYLE = {
    healthy:    { dot: "#16a34a", border: "#bbf7d0" },
    warning:    { dot: "#d97706", border: "#fde68a" },
    spof:       { dot: "#ea580c", border: "#fed7aa" },
    flight:     { dot: "#7c3aed", border: "#ddd6fe" },
    critical:   { dot: "#dc2626", border: "#fecaca" },
    ga_thin:    { dot: "#0891b2", border: "#a5f3fc" },
  };
  const WARN_ICON = { critical: "🔴", spof: "🎯", flight: "✈️", understaffed: "⚠️", ga_thin: "🧾" };

  const selStage = selectedCell ? stages.find(s => s.id === selectedCell.stageId) : null;
  const selPL    = selectedCell ? PRODUCT_LINES.find(p => p.id === selectedCell.plId) : null;
  const selCell  = selectedCell ? grid[selectedCell.stageId]?.[selectedCell.plId] : null;

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <div className="shrink-0 px-6 pt-4 pb-3 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Product Development Pipeline<Help text="Maps your workforce onto the semiconductor new-product-development stages × product lines, flagging stages that are under-staffed relative to the engineering load they carry." side="bottom" width={300} /></h2>
            <p className="text-sm text-gray-500">Cross-functional team coverage across {stages.length} semiconductor NPD stages · 2 active product lines · {assignments.ga?.length ?? 0} G&A supporting</p>
          </div>
          <div className="flex items-center gap-2">
            {isCustomOrder && (
              <button onClick={resetStageOrder} className="text-xs bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5" title="Restore the default stage order">
                ↺ Reset order
              </button>
            )}
            <button onClick={exportPipelineConfig} className="text-xs bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5" title="Export pipeline stage order + config as JSON">
              <Download size={12}/>Export
            </button>
            <label className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5 cursor-pointer" title="Import a previously exported pipeline config JSON">
              <Plus size={12}/>Import
              <input type="file" accept=".json,application/json" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) importPipelineConfig(f); e.target.value = ""; }}/>
            </label>
            {flowPlaying
              ? <button onClick={() => { setFlowPlaying(false); setFlowPos({ pl1: -1, pl2: -1 }); }} className="text-xs bg-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-1.5"><Pause size={12}/>Stop</button>
              : <button onClick={() => { setFlowPos({ pl1: 0, pl2: -2 }); setFlowPlaying(true); }} className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5" style={{ boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}><Activity size={12}/>Simulate Flow</button>
            }
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {PRODUCT_LINES.map(pl => (
            <div key={pl.id} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full" style={{ background: pl.bg, border: `1.5px solid ${pl.color}44` }}>
              <span>{pl.emoji}</span>
              <span className="font-bold" style={{ color: pl.textColor }}>{pl.name}</span>
              <span className="text-gray-400">{pl.code} · {pl.node}</span>
              <span className="font-semibold" style={{ color: pl.color }}>{assignments[pl.id]?.length ?? 0} eng.</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-200">
            <span>🧾</span>
            <span className="font-bold text-cyan-700">G&A support</span>
            <span className="text-gray-400">{assignments.ga?.length ?? 0} across all stages</span>
            <span className="text-cyan-600 font-semibold">eng:G&A target {STAGE_CAT_GA_TARGET.engineering}/{STAGE_CAT_GA_TARGET.operations}/{STAGE_CAT_GA_TARGET.business}:1 (eng/ops/biz)</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-400 flex-wrap">
            {[["🔴","Critical gap"],["🎯","SPOF"],["⚠️","Understaffed"],["✈️","Flight risk"],["🧾","G&A thin"]].map(([icon,label]) => (
              <span key={label} className="flex items-center gap-1">{icon} {label}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Pipeline canvas ── */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex gap-2 min-w-max pb-2">
            {stages.map((stage, sIdx) => {
              const hdr = STAGE_CAT_COLORS[stage.category]?.header || "#64748b";
              const stageGA = gaAllocByStage[stage.id] || 0;
              return (
                <div key={stage.id} style={{ minWidth: 144 }} className="flex flex-col">
                  {/* Stage header */}
                  <div className="rounded-t-xl px-2 py-2 text-center text-white relative" style={{ background: hdr }}>
                    {/* Reorder chevrons */}
                    <button
                      onClick={(ev) => { ev.stopPropagation(); moveStage(sIdx, -1); }}
                      disabled={sIdx === 0}
                      title="Move stage left"
                      className="absolute left-1 top-1 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold leading-none px-1 rounded hover:bg-white/15">
                      ◀
                    </button>
                    <button
                      onClick={(ev) => { ev.stopPropagation(); moveStage(sIdx, +1); }}
                      disabled={sIdx === stages.length - 1}
                      title="Move stage right"
                      className="absolute right-1 top-1 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold leading-none px-1 rounded hover:bg-white/15">
                      ▶
                    </button>
                    <div style={{ fontSize: 18, lineHeight: 1.1 }}>{stage.emoji}</div>
                    <div className="text-xs font-bold mt-0.5 leading-tight">{stage.label}</div>
                    <div style={{ fontSize: 9, opacity: 0.82 }}>{stage.sublabel}</div>
                    <div className="mt-1 inline-block px-1.5 py-0.5 rounded bg-white/15" style={{ fontSize: 9 }} title={`G&A target ${stage.gaPerPL} per PL (1 G&A per ${stage.gaRatioTarget} eng)`}>
                      🧾 {stageGA}/PL · 1:{stage.gaRatioTarget}
                    </div>
                  </div>

                  {/* PL swimlane cells */}
                  {PRODUCT_LINES.map((pl, plIdx) => {
                    const cell  = grid[stage.id]?.[pl.id];
                    if (!cell) return null;
                    const ss     = STATUS_STYLE[cell.status] || STATUS_STYLE.healthy;
                    const isFlow = pl.id === "pl1" ? flowPos.pl1 === sIdx : flowPos.pl2 === sIdx;
                    const isSel  = selectedCell?.stageId === stage.id && selectedCell?.plId === pl.id;
                    return (
                      <div key={pl.id}
                        onClick={() => setSelectedCell(isSel ? null : { stageId: stage.id, plId: pl.id })}
                        className="p-2 border-x cursor-pointer"
                        style={{
                          background:  isFlow ? pl.bg : isSel ? "#f8faff" : "white",
                          borderColor: isSel ? pl.color : ss.border,
                          borderWidth: isSel ? 2 : 1,
                          borderTopWidth: plIdx === 0 ? 0 : 1,
                          boxShadow: isFlow ? `0 0 0 2.5px ${pl.color}` : isSel ? `0 2px 10px ${pl.color}33` : "none",
                          minHeight: 68,
                          transition: "all 0.18s ease",
                        }}>
                        {/* Row label + status dot */}
                        <div className="flex items-center gap-1 mb-1.5">
                          <span style={{ fontSize: 9 }}>{pl.emoji}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: pl.textColor }}>{pl.code}</span>
                          <div className="ml-auto w-2 h-2 rounded-full shrink-0" style={{ background: ss.dot }}/>
                        </div>
                        {/* Avatar stack */}
                        <div className="flex flex-wrap gap-0.5 mb-1.5">
                          {cell.emps.slice(0, 7).map(e => (
                            <div key={e.id} className="w-5 h-5 rounded-full text-white flex items-center justify-center border-2 border-white"
                              style={{ background: DEPT_COLORS[e.dept] || "#64748b", fontSize: 7, fontWeight: 700,
                                outline: (flightRisks?.[e.id]?.score || 0) >= 65 ? "1.5px solid #dc2626" : "none", outlineOffset: 1 }}>
                              {e.first[0]}{e.last[0]}
                            </div>
                          ))}
                          {cell.emps.length > 7 && (
                            <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center border-2 border-white" style={{ fontSize: 7, fontWeight: 700 }}>+{cell.emps.length - 7}</div>
                          )}
                        </div>
                        {/* Count + ratio + warning icons */}
                        <div className="flex items-center justify-between">
                          <span className="font-bold" style={{ fontSize: 10, color: cell.emps.length === 0 ? "#dc2626" : "#374151" }}>
                            {cell.emps.length === 0 ? "—" : `${cell.emps.length} ppl`}
                          </span>
                          <span style={{ fontSize: 11, letterSpacing: "-0.5px" }}>{cell.warnings.map(w => WARN_ICON[w.type]).join("")}</span>
                        </div>
                        {cell.emps.length > 0 && (
                          <div className="mt-0.5 flex items-center justify-between text-[9px]" title={`${cell.ga} G&A allocated · ${isFinite(cell.ratio) ? cell.ratio.toFixed(1) : "∞"}:1 eng:G&A · target 1:${stage.gaRatioTarget}`}>
                            <span className="text-cyan-600 font-semibold">🧾 {cell.ga}</span>
                            <span className={cell.ga > 0 && cell.ratio > stage.gaRatioTarget * 1.25 ? "text-cyan-700 font-bold" : "text-gray-400"}>
                              {isFinite(cell.ratio) ? `${cell.ratio.toFixed(1)}:1` : "∞:1"}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Connector */}
                  <div className="h-5 flex items-center justify-center relative">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-gray-200"/>
                    <div className="relative z-10 bg-gray-100 text-gray-400 rounded-full px-1.5" style={{ fontSize: 8 }}>{sIdx + 1}</div>
                    {sIdx < stages.length - 1 && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-gray-300 rotate-45 z-10 bg-transparent"/>
                    )}
                  </div>

                  {/* Min staffing footer */}
                  <div className="border border-t-0 border-gray-100 rounded-b-xl px-2 py-1 text-center text-gray-400 bg-gray-50" style={{ fontSize: 9 }}>
                    min {stage.minPerPL}/line · 🧾 {stage.gaPerPL}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right drawer ── */}
        <div className="w-80 shrink-0 border-l border-gray-100 flex flex-col bg-gray-50">
          {selCell && selStage && selPL ? (
            <>
              <div className="p-4 border-b border-gray-200 shrink-0" style={{ background: selPL.bg }}>
                <div className="flex items-start gap-2">
                  <span style={{ fontSize: 24 }}>{selStage.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900">{selStage.label}</div>
                    <div className="text-xs font-semibold" style={{ color: selPL.textColor }}>{selPL.emoji} {selPL.name} · {selPL.code}</div>
                  </div>
                  <button onClick={() => setSelectedCell(null)} className="p-1 hover:bg-white rounded transition-colors shrink-0"><X size={14}/></button>
                </div>
                <div className="text-xs text-gray-500 mt-2 leading-relaxed">{selStage.desc}</div>
                <div className="flex gap-2 mt-3 text-xs flex-wrap">
                  <span className="bg-white rounded-lg px-2 py-1 font-bold" style={{ color: selCell.emps.length < selStage.minPerPL ? "#dc2626" : "#16a34a" }}>{selCell.emps.length} assigned</span>
                  <span className="bg-white rounded-lg px-2 py-1 text-gray-500">min {selStage.minPerPL}</span>
                  <span className="bg-white rounded-lg px-2 py-1 font-bold" style={{ color: selCell.ga === 0 || (isFinite(selCell.ratio) && selCell.ratio > selStage.gaRatioTarget * 1.25) ? "#0e7490" : "#0891b2" }}>🧾 {selCell.ga} G&A · {isFinite(selCell.ratio) ? selCell.ratio.toFixed(1) : "∞"}:1</span>
                  <span className="bg-white rounded-lg px-2 py-1 text-gray-500">target 1:{selStage.gaRatioTarget}</span>
                  <span className="bg-white rounded-lg px-2 py-1 text-gray-500">stage {stages.findIndex(s => s.id === selStage.id) + 1} of {stages.length}</span>
                </div>
              </div>
              {selCell.warnings.length > 0 && (
                <div className="px-3 py-2 border-b border-gray-100 space-y-1 shrink-0">
                  {selCell.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5"
                      style={{ background: w.type === "critical" ? "#fef2f2" : w.type === "spof" ? "#fff7ed" : w.type === "flight" ? "#f5f3ff" : w.type === "ga_thin" ? "#ecfeff" : "#fffbeb",
                               color:      w.type === "critical" ? "#dc2626"  : w.type === "spof" ? "#ea580c"  : w.type === "flight" ? "#7c3aed"  : w.type === "ga_thin" ? "#0e7490"  : "#d97706" }}>
                      <span>{WARN_ICON[w.type]}</span>
                      <span className="font-semibold">{w.msg}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="text-xs font-bold text-gray-400 mb-2 tracking-wide">TEAM MEMBERS</div>
                {selCell.emps.length === 0
                  ? <div className="text-center py-10"><AlertOctagon size={28} className="mx-auto mb-2 text-red-300"/><div className="text-sm text-red-500 font-semibold">No coverage</div><div className="text-xs text-gray-400 mt-1">This stage has no assigned engineers for {selPL.name}</div></div>
                  : selCell.emps.map(e => {
                      const risk = flightRisks?.[e.id]?.score || 0;
                      const rl   = flightRiskLabel(risk);
                      return (
                        <div key={e.id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
                          <div className="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold shrink-0"
                            style={{ background: DEPT_COLORS[e.dept] || "#64748b", fontSize: 9,
                              outline: rl !== "low" ? `2px solid ${RISK_COLORS[rl]}` : "none", outlineOffset: 1 }}>
                            {e.first[0]}{e.last[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-800 truncate">{e.first} {e.last}</div>
                            <div className="text-gray-400 truncate" style={{ fontSize: 10 }}>{e.title} · {e.dept}</div>
                          </div>
                          {rl !== "low" && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-bold shrink-0" style={{ background: RISK_BG[rl], color: RISK_COLORS[rl], fontSize: 9 }}>
                              {rl.toUpperCase()}
                            </span>
                          )}
                        </div>
                      );
                    })
                }
              </div>
            </>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-gray-200 bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <AlertOctagon size={15} className="text-red-500"/>
                  <span className="font-bold text-gray-800 text-sm">Bottleneck Report</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{bottlenecks.length} issues across both product lines</div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {bottlenecks.length === 0
                  ? <div className="p-8 text-center"><div className="text-3xl mb-2">✅</div><div className="text-sm text-green-600 font-semibold">All stages adequately staffed</div></div>
                  : bottlenecks.map((b, i) => (
                      <div key={i} onClick={() => setSelectedCell({ stageId: b.stage.id, plId: b.pl.id })}
                        className="flex items-start gap-3 p-3 border-b border-gray-100 hover:bg-white cursor-pointer transition-colors">
                        <span style={{ fontSize: 14, marginTop: 2 }}>{WARN_ICON[b.warning.type]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-800">{b.stage.label} · {b.pl.emoji} {b.pl.code}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{b.warning.msg}</div>
                          <div className="text-gray-400 mt-0.5" style={{ fontSize: 10 }}>Stage {stages.findIndex(s => s.id === b.stage.id) + 1} · {b.stage.sublabel}{b.warning.type === "ga_thin" ? "" : ` · 🧾 ${b.ga} G&A · ${isFinite(b.ratio) ? b.ratio.toFixed(1) : "∞"}:1`}</div>
                        </div>
                        <ArrowRight size={10} className="text-gray-300 shrink-0 mt-1"/>
                      </div>
                    ))
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-6 py-2 flex items-center gap-6 text-xs">
        {[
          { label: "Critical Gaps",  count: bottlenecks.filter(b => b.warning.type === "critical").length,     color: "#dc2626" },
          { label: "SPOFs",          count: bottlenecks.filter(b => b.warning.type === "spof").length,          color: "#ea580c" },
          { label: "Understaffed",   count: bottlenecks.filter(b => b.warning.type === "understaffed").length,  color: "#d97706" },
          { label: "Flight Risk",    count: bottlenecks.filter(b => b.warning.type === "flight").length,        color: "#7c3aed" },
          { label: "G&A Thin",       count: bottlenecks.filter(b => b.warning.type === "ga_thin").length,       color: "#0891b2" },
        ].map(k => (
          <div key={k.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: k.color }}/>
            <span className="font-bold" style={{ color: k.color }}>{k.count}</span>
            <span className="text-gray-400">{k.label}</span>
          </div>
        ))}
        <div className="ml-auto text-gray-400">Click any cell to inspect · ◀▶ to reorder stages · "Simulate Flow" animates the product journey</div>
      </div>
    </div>
  );
}

// ─── EXIT SIMULATION MODAL ───
function ExitSimModal() {
  const { exitSimNode: node, setExitSimNode, employees, tree } = useContext(AppCtx);
  if (!node) return null;

  const mgr = node.managerId ? tree.map[node.managerId] : null;
  const directReports = (tree.map[node.id]?.children || []).filter(c => c.status === "Active");
  const newMgrSpan = mgr ? (tree.map[mgr.id]?._directReports || 0) - 1 + directReports.length : 0;

  // SPOF: would mgr have only one direct report after the exit?
  const mgrDRsAfter = mgr ? (tree.map[mgr.id]?.children || []).filter(c => c.id !== node.id) : [];
  const spofRisk = mgrDRsAfter.length === 1 && (tree.map[mgrDRsAfter[0].id]?._totalReports || 0) >= 5;

  // Team disruption: active peers who would lose a teammate
  const peers = mgr ? (tree.map[mgr.id]?.children || []).filter(c => c.id !== node.id && c.status === "Active") : [];

  // Pipeline stages that lose coverage
  const lostStages = DEFAULT_PIPELINE_STAGES.filter(s => s.depts.includes(node.taxo));

  // Additional flight risk triggered for peers (disruptionRisk factor)
  const peersAtRisk = peers.filter(p => {
    const peerPeers = (tree.map[mgr?.id]?.children || []).filter(c => c.id !== p.id);
    const totalPeers = peerPeers.length;
    const departedCount = peerPeers.filter(c => c.id === node.id).length + // the exiting person
      employees.filter(e => e.managerId === mgr?.id && e.status === "Terminated" &&
        e.endDate && (new Date(FIXED_NOW) - new Date(e.endDate)) / (1000*60*60*24*30) <= 12).length;
    return totalPeers > 2 && departedCount / totalPeers > 0.4;
  });

  const timeToBP = node.level === "IC1" ? "3-6 mo" : node.level.startsWith("IC") ? "6-12 mo" : "9-18 mo";

  return (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-6" onClick={() => setExitSimNode(null)}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()} style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header */}
        <div className="bg-red-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2"><AlertOctagon size={18}/><span className="font-bold text-lg">Exit Impact Simulation</span></div>
            <button onClick={() => setExitSimNode(null)} className="p-1 hover:bg-red-700 rounded transition-colors"><X size={16}/></button>
          </div>
          <div className="text-red-100 text-sm">If <span className="font-bold text-white">{node.first} {node.last}</span> ({displayLevel(node.level)} · {node.dept}) left today</div>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Time to productivity */}
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl p-3 bg-orange-50 border border-orange-100">
              <div className="text-xs text-orange-500 font-semibold">Time to full productivity</div>
              <div className="text-2xl font-black text-orange-700">{timeToBP}</div>
              <div className="text-xs text-orange-400">typical for {displayLevel(node.level)}</div>
            </div>
          </div>

          {/* Reports inheritance */}
          <div className="rounded-xl border border-gray-100 p-4">
            <div className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5"><Users size={12}/> Reporting Chain Impact</div>
            {directReports.length > 0 ? (
              <>
                <div className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">{directReports.length} direct report{directReports.length > 1 ? "s" : ""}</span> roll up to {mgr ? <span className="font-semibold">{mgr.first} {mgr.last}</span> : "no manager"}
                </div>
                {mgr && (
                  <div className={`text-xs px-2.5 py-1.5 rounded-lg font-medium ${newMgrSpan > 12 ? "bg-red-50 text-red-700 border border-red-200" : newMgrSpan > 7 ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                    {mgr.first} {mgr.last}'s span: {(tree.map[mgr.id]?._directReports||0) - 1} → <strong>{newMgrSpan}</strong> direct reports {newMgrSpan > 12 ? "⚠ exceeds recommended max" : newMgrSpan > 7 ? "· approaching limit" : "· within range"}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-500">No direct reports — {mgr ? `reports to ${mgr.first} ${mgr.last}` : "top of org"}</div>
            )}
          </div>

          {/* SPOF risk */}
          {spofRisk && (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-orange-600 shrink-0 mt-0.5"/>
              <div>
                <div className="text-xs font-bold text-orange-700">SPOF Risk Created</div>
                <div className="text-xs text-orange-600">{mgr?.first} {mgr?.last} would have a single direct report ({mgrDRsAfter[0]?.first} {mgrDRsAfter[0]?.last}) managing {tree.map[mgrDRsAfter[0]?.id]?._totalReports || 0} people</div>
              </div>
            </div>
          )}

          {/* Team disruption */}
          {peers.length > 0 && (
            <div className="rounded-xl border border-gray-100 p-4">
              <div className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5"><TrendingUp size={12}/> Team Disruption</div>
              <div className="text-sm text-gray-700 mb-1">{peers.length} peer{peers.length > 1 ? "s" : ""} affected on {mgr?.first} {mgr?.last}'s team</div>
              {peersAtRisk.length > 0 && (
                <div className="text-xs text-red-600 font-medium">⚠ May trigger elevated flight risk for {peersAtRisk.length} teammate{peersAtRisk.length > 1 ? "s" : ""}</div>
              )}
            </div>
          )}

          {/* Pipeline coverage loss */}
          {lostStages.length > 0 && (
            <div className="rounded-xl border border-gray-100 p-4">
              <div className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5"><Activity size={12}/> Pipeline Coverage Impact</div>
              <div className="text-xs text-gray-500 mb-2">{node.taxo} covers {lostStages.length} NPD stage{lostStages.length > 1 ? "s" : ""}:</div>
              <div className="flex flex-wrap gap-1">
                {lostStages.map(s => (
                  <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{s.emoji} {s.label}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5">
          <button onClick={() => setExitSimNode(null)} className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors">Close Simulation</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ───
function OrgChartApp() {
  const [employees, setEmployees] = useState(() => generateSemiCompany());
  const [view, setView] = useState("org-chart");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [annotations, setAnnotations] = useState(() => {
    const initTree = buildTree(employees);
    const initRisks = computeAllFlightRisks(employees);
    return generateInitialAnnotations(employees, initTree, initRisks);
  });
  const [showAnnotationForm, setShowAnnotationForm] = useState(null);
  const [annotationText, setAnnotationText] = useState("");
  const [annotationType, setAnnotationType] = useState("note");
  const [colorBy, setColorBy] = useState("department");
  const [filterDept, setFilterDept] = useState("All");
  const [filterLoc, setFilterLoc] = useState("All");
  const [filterCountry, setFilterCountry] = useState("All");
  const [filterEmpType, setFilterEmpType] = useState("All");
  const [filterBG, setFilterBG] = useState("All");
  const [showHotspots, setShowHotspots] = useState(false);
  const [dragNode, setDragNode] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [dragMode, setDragMode] = useState("individual");
  const [undoStack, setUndoStack] = useState([]);
  const [detailPanel, setDetailPanel] = useState(null);
  const [importState, setImportState] = useState(null); // open employee-import wizard payload
  const [focusRoot, setFocusRoot] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timelineMonth, setTimelineMonth] = useState(null);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [dashTab, setDashTab] = useState("executive");
  const [zoom, setZoom] = useState(1);
  const [timelineSpeed, setTimelineSpeed] = useState(1);       // 1 = 1 sec/year default
  const [growthDimension, setGrowthDimension] = useState("total");
  const [insightHighlightIds, setInsightHighlightIds] = useState(new Set());
  const [chainFilterId, setChainFilterId] = useState(null);
  const [showDeparted, setShowDeparted] = useState(false);
  const [exitSimNode, setExitSimNode] = useState(null);
  const [filterLevel, setFilterLevel] = useState("All");
  const [orgViewMode, setOrgViewMode] = useState("tree"); // "tree" | "treemap" | "sunburst"
  const [showFlightRisk, setShowFlightRisk] = useState(false);
  // Privacy notice: dismissed flag persisted to localStorage so users only see it once per device.
  const [dataNoticeDismissed, setDataNoticeDismissed] = useState(() => {
    try { return localStorage.getItem("orgSimDataNoticeAck") === "1"; } catch { return false; }
  });
  // Tutorial mode: when on, ? help dots appear next to non-obvious controls. Persisted per device.
  const [tutorialMode, setTutorialMode] = useState(() => {
    try { return localStorage.getItem("orgSimTutorialMode") === "1"; } catch { return false; }
  });
  const toggleTutorialMode = useCallback(() => {
    setTutorialMode(v => {
      const next = !v;
      try { localStorage.setItem("orgSimTutorialMode", next ? "1" : "0"); } catch {}
      return next;
    });
  }, []);
  // Cmd/Ctrl+K command palette + natural-language query modal
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [nlOpen, setNlOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setCmdkOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const dismissDataNotice = useCallback(() => {
    setDataNoticeDismissed(true);
    try { localStorage.setItem("orgSimDataNoticeAck", "1"); } catch {}
  }, []);
  const clearAllLocalData = useCallback(() => {
    if (!confirm("Clear all locally stored preferences and reload? This wipes saved UI state from this browser. Imported employee data lives only in memory and is not persisted.")) return;
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("orgSim")) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch {}
    location.reload();
  }, []);
  // ── Headcount plan (lifted to app scope so org chart and planner share state) ──
  // Sample seed: a few small department deltas so the Mix / Timeline / EC tabs and the open
  // reqs view all have something interesting to show on first load. Users overwrite by
  // editing the plan or importing a JSON.
  const [plan, setPlan] = useState({
    "IC Design":     { L1: 6, L2: 4, L3: 2 },
    "Verification":  { L1: 5, L2: 3 },
    "Software":      { L2: 4, L3: 2 },
    "Manufacturing": { L3: -3 },
  });
  const [planGroupBy, setPlanGroupBy] = useState("dept"); // "dept" | "bg" | "fn"
  const [planStartYear, setPlanStartYear] = useState(2026);
  const [planHorizonQ, setPlanHorizonQ] = useState(8);    // quarters
  const [showPlannedInOrgChart, setShowPlannedInOrgChart] = useState(false);
  // Location filter — empty Set means all locations. When populated, every plan derivation
  // (current rollups, level histogram, growth model baseline) only considers employees in
  // the chosen sites, so users can plan a Bangalore-only or HQ-only build-out.
  const [planLocFilter, setPlanLocFilter] = useState(() => new Set());
  // ── Early-Career calculator inputs (lifted so org chart + planner share) ──
  const [earlyTargetPct, setEarlyTargetPct] = useState(20);
  const [earlyMode, setEarlyMode] = useState("orgMix"); // "orgMix" | "hireMix"
  const [hireMixPct, setHireMixPct] = useState(25);
  const [internRatio, setInternRatio] = useState(1.5);
  const [annualExpHiresOverride, setAnnualExpHiresOverride] = useState(null);
  const [reqIncludeECCalc, setReqIncludeECCalc] = useState(true);
  // ── 3-year attrition + growth model inputs ──
  // Sample seed showcases the new growth-model surface area: an aggressive 3yr growth target,
  // a Y2 talent acquisition (Edge-AI startup, 30 ppl, 35% EC) and a smaller Y3 design-house
  // acquisition (18 ppl, 15% EC), and a slightly elevated promotion rate so the L2 to L3
  // drain on the EC pool is visible in the per-year breakdown.
  const [attritionPct, setAttritionPct] = useState(10);
  const [growthTarget3Yr, setGrowthTarget3Yr] = useState(150);
  const [growthShiftPerYear, setGrowthShiftPerYear] = useState([30, 35, 35]);
  const [promoPctPerYear, setPromoPctPerYear] = useState(18);
  const [acquisitionsPerYear, setAcquisitionsPerYear] = useState([
    { count: 0,  ecPct: 20 },
    { count: 30, ecPct: 35 },
    { count: 18, ecPct: 15 },
  ]);
  const [projects, setProjects] = useState(() => []);
  const [reqOverrides, setReqOverrides] = useState({}); // { reqId: { level?, location?, projectId? } }
  const overrideReq = useCallback((id, patch) => setReqOverrides(o => ({ ...o, [id]: { ...(o[id] || {}), ...patch } })), []);
  const resetOverrides = useCallback(() => setReqOverrides({}), []);
  // Inline position editor on the org chart (Advanced+)
  const [positionMode, setPositionMode] = useState(false);
  const [customReqs, setCustomReqs] = useState([]);
  const customReqIdSeq = useRef(1);
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem("orgSimMode") || "simple"; } catch { return "simple"; }
  });
  const treeContainerRef = useRef(null);
  const teamDragRef = useRef(false);  // set at dragStart; read in handleDrop
  const shiftHeldRef = useRef(false); // updated by keydown/keyup — more reliable than e.shiftKey in drag events

  const activeEmployees = useMemo(() => employees.filter(e => e.status === "Active"), [employees]);
  const tree = useMemo(() => buildTree(employees), [employees]);
  // Full tree (active + terminated) — built only when "Show Departed" is on
  const fullTree = useMemo(() => showDeparted ? buildTree(employees, false) : null, [showDeparted, employees]);
  // Display root for the org chart canvas — uses fullTree when showDeparted so departed nodes appear
  const chartDisplayRoot = useMemo(() => {
    const t = fullTree || tree;
    if (focusRoot && t.map[focusRoot]) return t.map[focusRoot];
    return t.root;
  }, [focusRoot, fullTree, tree]);
  const hotspots = useMemo(() => detectHotspots(tree), [tree]);
  const hotspotNodeIds = useMemo(() => new Set(hotspots.map(h => h.nodeId)), [hotspots]);
  const hotspotReasons = useMemo(() => {
    const map = {};
    hotspots.forEach(h => {
      if (!map[h.nodeId]) map[h.nodeId] = [];
      map[h.nodeId].push(h.msg);
    });
    return map;
  }, [hotspots]);
  const flightRisks = useMemo(() => computeAllFlightRisks(employees), [employees]);

  // ─── HEADCOUNT DERIVATIONS (shared by HeadcountPlanningView + Org Chart ghost nodes) ───
  const planGroupKey = { dept: "dept", bg: "bg", fn: "fn" }[planGroupBy];
  const planGroupLabel = { dept: "Department", bg: "Business Unit", fn: "Discipline" }[planGroupBy];

  // Location-filtered employee pool — every downstream rollup uses this. When the filter
  // is empty, this equals the full active workforce.
  const planEmployees = useMemo(() => {
    if (planLocFilter.size === 0) return activeEmployees;
    return activeEmployees.filter(e => planLocFilter.has(e.location));
  }, [activeEmployees, planLocFilter]);

  const planGroups = useMemo(() => {
    const s = new Set(planEmployees.map(e => e[planGroupKey]).filter(Boolean));
    return [...s].sort();
  }, [planEmployees, planGroupKey]);

  const planCurrent = useMemo(() => {
    const m = {};
    planGroups.forEach(g => { m[g] = {}; ALL_DISPLAY_LEVELS.forEach(lv => m[g][lv] = 0); });
    planEmployees.forEach(e => {
      const g = e[planGroupKey]; if (!g || !m[g]) return;
      const dl = displayLevel(e.level);
      if (m[g][dl] !== undefined) m[g][dl] += 1;
    });
    return m;
  }, [planEmployees, planGroups, planGroupKey]);

  const planProjected = useMemo(() => {
    const m = {};
    planGroups.forEach(g => {
      m[g] = {};
      ALL_DISPLAY_LEVELS.forEach(lv => {
        const delta = plan[g]?.[lv] || 0;
        m[g][lv] = Math.max(0, (planCurrent[g]?.[lv] || 0) + delta);
      });
    });
    return m;
  }, [planGroups, planCurrent, plan]);

  const planRollups = useMemo(() => {
    const rollup = (counts) => {
      const r = {};
      planGroups.forEach(g => {
        let early = 0, exp = 0;
        ALL_DISPLAY_LEVELS.forEach(lv => {
          const n = counts[g]?.[lv] || 0;
          if (EARLY_DISPLAY_LEVELS.has(lv)) early += n; else exp += n;
        });
        r[g] = { early, exp, total: early + exp };
      });
      return r;
    };
    const cur = rollup(planCurrent);
    const prj = rollup(planProjected);
    const orgTotalCur  = Object.values(cur).reduce((s, r) => s + r.total, 0);
    const orgTotalProj = Object.values(prj).reduce((s, r) => s + r.total, 0);
    const orgEarlyCur  = Object.values(cur).reduce((s, r) => s + r.early, 0);
    const orgEarlyProj = Object.values(prj).reduce((s, r) => s + r.early, 0);
    return { cur, prj, orgTotalCur, orgTotalProj, orgEarlyCur, orgEarlyProj };
  }, [planCurrent, planProjected, planGroups]);

  const planSumPlan = useMemo(() => {
    let hires = 0, departures = 0;
    Object.values(plan).forEach(byLv => Object.values(byLv).forEach(d => {
      if (d > 0) hires += d; else if (d < 0) departures += -d;
    }));
    return { hires, departures, net: hires - departures };
  }, [plan]);

  const planHorizon = useMemo(() => {
    const QUARTERS = ["Q1","Q2","Q3","Q4"];
    const arr = [];
    for (let i = 0; i < planHorizonQ; i++) {
      const yr = planStartYear + Math.floor(i / 4);
      arr.push({ key: `${yr}-${QUARTERS[i % 4]}`, year: yr, q: QUARTERS[i % 4], idx: i });
    }
    return arr;
  }, [planStartYear, planHorizonQ]);

  const planYears = Math.max(1, planHorizonQ / 4);

  const plannedHires = useMemo(() => {
    let ec = 0, exp = 0;
    Object.values(plan).forEach(byLv => {
      Object.entries(byLv).forEach(([lv, d]) => {
        if (d > 0) { if (EARLY_DISPLAY_LEVELS.has(lv)) ec += d; else exp += d; }
      });
    });
    return { ec, exp, total: ec + exp };
  }, [plan]);

  const earlyByGroup = useMemo(() => {
    return planGroups.map(g => {
      const c = planRollups.cur[g], p = planRollups.prj[g];
      const target = Math.round(p.total * earlyTargetPct / 100);
      const gap = target - p.early;
      return {
        group: g,
        curEarly: c.early, curTotal: c.total, curPct: c.total ? Math.round(100*c.early/c.total) : 0,
        projEarly: p.early, projTotal: p.total, projPct: p.total ? Math.round(100*p.early/p.total) : 0,
        target, gap,
      };
    }).sort((a, b) => b.curTotal - a.curTotal);
  }, [planGroups, planRollups, earlyTargetPct]);

  // Org-wide level histogram from filtered workforce — used to drive backfill mix.
  const levelHistogram = useMemo(() => {
    const h = {};
    planEmployees.forEach(e => { h[e.level] = (h[e.level] || 0) + 1; });
    return h;
  }, [planEmployees]);

  // 3-year attrition + growth model — drives backfill, growth, and EC reqs in coupled fashion.
  // Must precede earlyCalc / earlyAllocByGroup, which read its outputs.
  const growthModel = useMemo(() => computeAttritionGrowthModel({
    baseTotal: planRollups.orgTotalProj || planEmployees.length,
    baseEarly: planRollups.orgEarlyProj || 0,
    levelHistogram,
    attritionPct,
    growthTarget3Yr,
    growthShiftPerYear,
    promoPctPerYear,
    acquisitionsPerYear,
    mode: earlyMode,
    targetPct: earlyTargetPct,
    mixPct: hireMixPct,
    internRatio,
    planStartYear,
  }), [planRollups, planEmployees.length, levelHistogram, attritionPct, growthTarget3Yr,
       growthShiftPerYear, promoPctPerYear, acquisitionsPerYear,
       earlyMode, earlyTargetPct, hireMixPct, internRatio, planStartYear]);

  // Default experienced-hire pace: prefer the 3yr growth model (attrition + growth + promotions
  // − EC slice), falling back to plan-deltas if the model has nothing yet. The model is what
  // actually drives the EC tab — the legacy plan-derived value would read 0 for users who
  // haven't entered Mix-tab deltas, which made the EC tab look broken.
  const defaultAnnualExpHires = useMemo(() => {
    const modelExp = growthModel?.threeYear?.totalExp || 0;
    if (modelExp > 0) return Math.max(0, Math.round(modelExp / 3));
    return Math.max(0, Math.round(plannedHires.exp / planYears));
  }, [growthModel, plannedHires.exp, planYears]);
  const annualExpHires = annualExpHiresOverride == null ? defaultAnnualExpHires : annualExpHiresOverride;

  const earlyCalc = useMemo(() => computeEarlyCalc({
    baseTotal: planRollups.orgTotalProj,
    baseEarly: planRollups.orgEarlyProj,
    expPerYear: annualExpHires,
    planYears,
    mode: earlyMode,
    targetPct: earlyTargetPct,
    mixPct: hireMixPct,
    internRatio,
  }), [planRollups, annualExpHires, planYears, earlyMode, earlyTargetPct, hireMixPct, internRatio]);

  // EC allocation by group — uses the 3-year total EC from the growth model.
  // We pass a synthetic earlyCalc with ecPerYear = totalEC across the 3yr window so the
  // largest-remainder split spreads the full horizon's EC demand across groups.
  const earlyAllocByGroup = useMemo(() => {
    if (!growthModel) {
      return computeEarlyAllocByGroup({ earlyByGroup, earlyCalc, mode: earlyMode });
    }
    const ec3yr = { ecPerYear: growthModel.threeYear.totalEC, interns: growthModel.threeYear.totalInterns };
    return computeEarlyAllocByGroup({ earlyByGroup, earlyCalc: ec3yr, mode: earlyMode });
  }, [earlyByGroup, earlyCalc, earlyMode, growthModel]);

  const planManagersByGroup = useMemo(() => {
    const m = {};
    planEmployees.forEach(e => {
      if (!e.isManager) return;
      const g = e[planGroupKey]; if (!g) return;
      (m[g] = m[g] || []).push(e);
    });
    return m;
  }, [planEmployees, planGroupKey]);

  // Managers indexed by the level they would supervise (heuristic: a level reports up to a
  // manager 1+ tier above). For backfill assignment we just bucket by displayLevel.
  const planManagersByLevel = useMemo(() => {
    const m = { __any: [] };
    planEmployees.forEach(e => {
      if (!e.isManager) return;
      m.__any.push(e);
      const lv = e.level;
      (m[lv] = m[lv] || []).push(e);
    });
    return m;
  }, [planEmployees]);

  // Lazy-init projects from sample once activeEmployees is populated
  useEffect(() => {
    if (projects.length === 0 && activeEmployees.length > 0) {
      setProjects(generateSampleProjectsFromEmps(activeEmployees));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmployees]);

  // Plan reqs + backfill (attrition) + growth + EC-calc reqs + custom reqs
  // → apply overrides + project assignment → final chartReqs
  const chartReqs = useMemo(() => {
    const planReqs = buildPlanReqs({
      plan, managersByGroup: planManagersByGroup,
      horizon: planHorizon, planStartYear, planHorizonQ,
    });
    let allReqs = planReqs;
    let nextId = planReqs.length + 1;

    // Attrition backfill reqs (same level as departed)
    if (growthModel.threeYear.totalAttrition > 0) {
      const backfillReqs = buildAttritionBackfillReqs({
        model: growthModel, levelHistogram, managersByLevel: planManagersByLevel,
        planStartYear, idStart: nextId,
      });
      allReqs = allReqs.concat(backfillReqs);
      nextId += backfillReqs.length;
    }

    // Net-growth reqs (new positions across 3 years)
    if (growthModel.threeYear.totalGrowth > 0 && earlyAllocByGroup.length) {
      const growthReqs = buildGrowthReqs({
        model: growthModel, allocByGroup: earlyAllocByGroup,
        managersByGroup: planManagersByGroup,
        planStartYear, idStart: nextId,
      });
      allReqs = allReqs.concat(growthReqs);
      nextId += growthReqs.length;
    }

    // EC reqs spread across 3 years using model.yearly.ec weights
    if (reqIncludeECCalc && growthModel.threeYear.totalEC > 0) {
      const ecReqs = buildECCalcReqs({
        allocByGroup: earlyAllocByGroup,
        managersByGroup: planManagersByGroup,
        planStartYear,
        model: growthModel,
        idStart: nextId,
      });
      allReqs = allReqs.concat(ecReqs);
      nextId += ecReqs.length;
    }

    if (customReqs.length) allReqs = allReqs.concat(customReqs);
    return applyReqOverridesAndProjects(allReqs, reqOverrides, projects);
  }, [plan, planManagersByGroup, planManagersByLevel, planHorizon, planStartYear, planHorizonQ,
      reqIncludeECCalc, growthModel, levelHistogram, earlyAllocByGroup,
      reqOverrides, projects, customReqs]);

  const reqsByManager = useMemo(() => {
    const m = {};
    chartReqs.forEach(r => {
      if (r.hiringManagerId) (m[r.hiringManagerId] = m[r.hiringManagerId] || []).push(r);
    });
    return m;
  }, [chartReqs]);

  // Add an open req under a specific employee (used by Position Mode +/− buttons on the chart)
  const addPositionUnder = useCallback((employeeId) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;
    const group = emp[planGroupKey] || emp.dept;
    const level = "L3"; // sensible default mid-level IC; user can edit in Headcount ▸ Reqs
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() + 3, 1);
    const qNum = Math.floor(targetDate.getMonth() / 3) + 1;
    const newId = `CUSTOM-${String(customReqIdSeq.current++).padStart(4, "0")}`;
    const rng = seededRand(`${newId}|${group}|${level}`);
    const newReq = {
      id: newId,
      group, level,
      isEC: EARLY_DISPLAY_LEVELS.has(level),
      title: pickTitleForReq(group, level, rng),
      location: emp.location,
      country: emp.country,
      openDate: today.toISOString().slice(0, 10),
      targetStart: targetDate.toISOString().slice(0, 10),
      quarter: `${targetDate.getFullYear()} Q${qNum}`,
      hiringManager: `${emp.first} ${emp.last}`,
      hiringManagerId: emp.id,
      employmentType: "FTE",
      source: "manual",
      status: "Open",
    };
    setCustomReqs(rs => [...rs, newReq]);
    setShowPlannedInOrgChart(true); // make sure ghosts are visible
    setExpandedNodes(s => { const n = new Set(s); n.add(employeeId); return n; });
  }, [employees, planGroupKey]);

  // Remove the most-recently-added custom req under a manager (no-op if none)
  const removePositionUnder = useCallback((employeeId) => {
    setCustomReqs(rs => {
      for (let i = rs.length - 1; i >= 0; i--) {
        if (rs[i].hiringManagerId === employeeId) {
          // Also clear any per-req overrides for the deleted id
          setReqOverrides(o => {
            if (!o[rs[i].id]) return o;
            const { [rs[i].id]: _, ...rest } = o;
            return rest;
          });
          return [...rs.slice(0, i), ...rs.slice(i + 1)];
        }
      }
      return rs;
    });
  }, []);

  // Auto-expand first 2 levels
  useEffect(() => {
    if (tree.root) {
      const init = new Set([tree.root.id]);
      tree.root.children.forEach(c => { init.add(c.id); c.children.forEach(gc => init.add(gc.id)); });
      setExpandedNodes(init);
    }
  }, [tree.root?.id]);

  // Timeline playback — 1 second per year by default (1000ms / 12 months / speed)
  const getTimelineMonths = useCallback(() => {
    const dates = employees.map(e => new Date(e.startDate));
    const min = new Date(Math.min(...dates));
    const max = new Date(2025, 5, 1); // fixed: matches data generator "now" and TimelineView
    const result = [];
    let d = new Date(min.getFullYear(), min.getMonth(), 1);
    while (d <= max) { result.push(new Date(d)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    return result;
  }, [employees]);

  useEffect(() => {
    if (!timelinePlaying) return;
    const ms = (1000 / 12) / timelineSpeed;
    const interval = setInterval(() => {
      setTimelineMonth(prev => {
        const months = getTimelineMonths();
        const max = months.length - 1;
        if ((prev ?? 0) >= max) { setTimelinePlaying(false); return max; }
        return (prev ?? 0) + 1;
      });
    }, ms);
    return () => clearInterval(interval);
  }, [timelinePlaying, timelineSpeed, getTimelineMonths]);

  // Ctrl+scroll zoom on org chart
  useEffect(() => {
    const el = treeContainerRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setZoom(z => Math.max(0.05, Math.min(3, z * (e.deltaY > 0 ? 0.92 : 1.09))));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [view]); // re-attach when switching to org-chart view

  // Track Shift key state globally — e.shiftKey in dragstart/drop is unreliable across browsers
  useEffect(() => {
    const dn = (e) => { if (e.key === "Shift") shiftHeldRef.current = true; };
    const up = (e) => { if (e.key === "Shift") shiftHeldRef.current = false; };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup",   up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  // Ctrl+Z undo
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const toggleExpand = useCallback((id) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set();
    Object.keys(tree.map).forEach(id => all.add(id));
    setExpandedNodes(all);
  }, [tree.map]);

  const collapseAll = useCallback(() => {
    if (tree.root) setExpandedNodes(new Set([tree.root.id]));
  }, [tree.root]);

  const navigateTo = useCallback((id) => {
    if (!tree.map[id]) return;
    const path = getAncestorPath(tree.map, id);
    setExpandedNodes(prev => {
      const next = new Set(prev);
      path.forEach(n => next.add(n.id));
      return next;
    });
    setSelectedNode(id);
    setSearchQuery("");
    setFocusRoot(null);
    setTimeout(() => {
      const el = document.getElementById(`node-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }, 100);
  }, [tree.map]);

  // Navigate from Analytics/Insights to a focused subtree in the org chart.
  // Expands the focus node + its direct children so the subtree is immediately
  // visible, clears any active dept/loc/bg filters, and scrolls to the node.
  const goToInsight = useCallback((insight) => {
    if (!insight.focusNodeId || !tree.map[insight.focusNodeId]) return;
    const focusNode = tree.map[insight.focusNodeId];
    setFocusRoot(insight.focusNodeId);
    setInsightHighlightIds(new Set(insight.affectedIds.filter(id => tree.map[id])));
    setChainFilterId(null);
    setFilterDept("All"); setFilterLoc("All"); setFilterBG("All");
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.add(insight.focusNodeId);
      focusNode.children.forEach(c => { next.add(c.id); });
      return next;
    });
    setView("org-chart");
    setTimeout(() => {
      document.getElementById(`node-${insight.focusNodeId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start", inline: "center" });
    }, 150);
  }, [tree, setFocusRoot, setInsightHighlightIds, setChainFilterId, setFilterDept, setFilterLoc, setFilterBG, setExpandedNodes, setView]);

  // Navigate from Dashboard/Overview to the org chart filtered to a department.
  // Clears any stale focusRoot / insight highlights, expands the ancestor path
  // for every node in the department so they are immediately visible, then
  // scrolls to the highest-level node in that department.
  const navigateToDept = useCallback((dept) => {
    const matchingNodes = Object.values(tree.map).filter(n => n.dept === dept);
    setFocusRoot(null);
    setInsightHighlightIds(new Set());
    setFilterDept(dept);
    setFilterLoc("All"); setFilterBG("All");
    setExpandedNodes(prev => {
      const next = new Set(prev);
      matchingNodes.forEach(n => {
        // Expand all ancestors (not the node itself) so the node is visible
        const path = getAncestorPath(tree.map, n.id);
        path.slice(0, -1).forEach(a => next.add(a.id));
      });
      return next;
    });
    setView("org-chart");
    // Scroll to the shallowest node in this dept so the user lands near the top
    setTimeout(() => {
      const topNode = matchingNodes.reduce((best, n) => {
        const depth = getAncestorPath(tree.map, n.id).length;
        return (!best || depth < best.depth) ? { id: n.id, depth } : best;
      }, null);
      if (topNode) {
        document.getElementById(`node-${topNode.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }, 150);
  }, [tree, setFocusRoot, setInsightHighlightIds, setFilterDept, setFilterLoc, setFilterBG, setExpandedNodes, setView]);

  // Show entire vertical management chain for a person: all ancestors up to CEO + all reports below.
  // Reuses insightHighlightIds to dim non-chain nodes; chainFilterId tracks who triggered the view.
  const focusChain = useCallback((nodeId) => {
    if (!tree.map[nodeId]) return;
    const targetNode = tree.map[nodeId];
    const ancestorPath = getAncestorPath(tree.map, nodeId);
    const descendantIds = [];
    function walkDown(n) { descendantIds.push(n.id); n.children.forEach(walkDown); }
    walkDown(targetNode);
    const chainIds = new Set([...ancestorPath.map(n => n.id), ...descendantIds]);
    setChainFilterId(nodeId);
    setInsightHighlightIds(chainIds);
    setFocusRoot(null); // start from root so ancestors are visible
    setExpandedNodes(prev => {
      const next = new Set(prev);
      ancestorPath.forEach(n => next.add(n.id));
      descendantIds.forEach(id => next.add(id));
      return next;
    });
    setDetailPanel(null);
    setView("org-chart");
    setTimeout(() => {
      document.getElementById(`node-${nodeId}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }, 150);
  }, [tree, setChainFilterId, setInsightHighlightIds, setFocusRoot, setExpandedNodes, setDetailPanel, setView]);

  // Focus Subtree: show full tree but collapse everything except the path from CEO → node → node's children.
  // Ancestors appear as real OrgNode cards (no grey overlay), siblings are collapsed but visible.
  const focusSubtree = useCallback((nodeId) => {
    if (!tree.map[nodeId]) return;
    const ancestorPath = getAncestorPath(tree.map, nodeId);
    // Expand every ancestor AND the node itself (so its direct reports are visible)
    const toExpand = new Set(ancestorPath.map(n => n.id));
    setFocusRoot(null);
    setInsightHighlightIds(new Set());
    setChainFilterId(null);
    setExpandedNodes(toExpand);
    setDetailPanel(null);
    setView("org-chart");
    setTimeout(() => {
      document.getElementById(`node-${nodeId}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }, 200);
  }, [tree, setFocusRoot, setInsightHighlightIds, setChainFilterId, setExpandedNodes, setDetailPanel, setView]);

  // teamDragRef.current is set synchronously in onDragStart — avoids e.shiftKey drop-event unreliability
  // Pending drop: stash the proposed move and let ReorgRipplePreview show consequences
  // before we mutate state. Confirm via confirmDrop, dismiss via cancelDrop.
  const [pendingDrop, setPendingDrop] = useState(null);
  const handleDrop = useCallback((targetId) => {
    if (!dragNode || dragNode === targetId) { setDragNode(null); setDragOver(null); teamDragRef.current = false; return; }
    if (!tree.map[targetId] || !tree.map[dragNode]) { setDragNode(null); setDragOver(null); teamDragRef.current = false; return; }
    const moveAsTeam = teamDragRef.current || shiftHeldRef.current;
    teamDragRef.current = false;
    setPendingDrop({ dragNodeId: dragNode, targetId, moveAsTeam });
    setDragNode(null);
    setDragOver(null);
  }, [dragNode, tree.map]);

  const confirmDrop = useCallback(() => {
    if (!pendingDrop) return;
    const { dragNodeId, targetId, moveAsTeam } = pendingDrop;
    if (!tree.map[targetId] || !tree.map[dragNodeId]) { setPendingDrop(null); return; }
    const path = getAncestorPath(tree.map, targetId);
    const droppedOnDescendant = path.some(n => n.id === dragNodeId);
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(employees))]);
    if (droppedOnDescendant) {
      if (!moveAsTeam) { setPendingDrop(null); return; }
      // Superior↔subordinate swap: A (dragged superior) and B (target subordinate) trade slots,
      // but neither inherits the other's old team — instead everyone formerly under A or B rolls
      // up to A's old manager. Avoids a junior accidentally inheriting a senior's whole org.
      setEmployees(prev => {
        const A = prev.find(e => e.id === dragNodeId);
        const B = prev.find(e => e.id === targetId);
        if (!A || !B) return prev;
        const A_oldMgr = A.managerId ?? null;
        const B_oldMgr = B.managerId ?? null;
        const directChild = (B_oldMgr === A.id);
        return prev.map(e => {
          if (e.id === A.id) return { ...e, managerId: directChild ? B.id : B_oldMgr };
          if (e.id === B.id) return { ...e, managerId: A_oldMgr };
          if (e.managerId === A.id || e.managerId === B.id) return { ...e, managerId: A_oldMgr };
          return e;
        });
      });
      setPendingDrop(null);
      return;
    }
    setEmployees(prev => {
      const dragged  = prev.find(e => e.id === dragNodeId);
      const oldMgrId = dragged?.managerId ?? null;
      return prev.map(e => {
        if (e.id === dragNodeId) return { ...e, managerId: targetId };
        if (e.managerId === dragNodeId) {
          if (moveAsTeam) return e;
          return { ...e, managerId: oldMgrId };
        }
        return e;
      });
    });
    setPendingDrop(null);
  }, [pendingDrop, tree.map, employees]);

  const cancelDrop = useCallback(() => setPendingDrop(null), []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setEmployees(prev);
  }, [undoStack]);

  const saveAnnotation = useCallback((nodeId) => {
    if (!annotationText.trim()) return;
    setAnnotations(prev => ({
      ...prev,
      [nodeId]: [...(prev[nodeId] || []), { text: annotationText, type: annotationType, time: new Date().toLocaleString() }]
    }));
    setAnnotationText("");
    setShowAnnotationForm(null);
  }, [annotationText, annotationType]);

  const removeAnnotation = useCallback((nodeId, idx) => {
    setAnnotations(prev => {
      const next = { ...prev };
      next[nodeId] = next[nodeId].filter((_, i) => i !== idx);
      if (next[nodeId].length === 0) delete next[nodeId];
      return next;
    });
  }, []);

  const getNodeColor = useCallback((node) => {
    if (colorBy === "department") return DEPT_COLORS[node.dept] || "#64748b";
    if (colorBy === "business_group") return BG_COLORS[node.bg] || "#64748b";
    if (colorBy === "discipline") return FN_COLORS[node.fn] || "#64748b";
    if (colorBy === "location") return LOC_COLORS[node.location] || "#64748b";
    return "#64748b";
  }, [colorBy]);

  const getTenureColor = useCallback((startDate) => {
    const months = (FIXED_NOW - new Date(startDate)) / (1000*60*60*24*30);
    if (months < 3) return "#ef4444";
    if (months < 12) return "#f59e0b";
    if (months < 36) return "#eab308";
    return "#22c55e";
  }, []);

  const isFiltered = useCallback((node) => {
    if (filterDept !== "All" && node.dept !== filterDept) return false;
    if (filterLoc !== "All" && node.location !== filterLoc) return false;
    if (filterCountry !== "All" && (node.country || countryFor(node.location)) !== filterCountry) return false;
    if (filterEmpType !== "All" && (node.employmentType || "FTE") !== filterEmpType) return false;
    if (filterBG !== "All" && node.bg !== filterBG) return false;
    if (filterLevel !== "All" && !(LEVEL_FILTER_GROUPS[filterLevel] || (() => true))(node.level)) return false;
    return true;
  }, [filterDept, filterLoc, filterCountry, filterEmpType, filterBG, filterLevel]);

  const departments = useMemo(() => [...new Set(activeEmployees.map(e => e.dept))].sort(), [activeEmployees]);
  const locations = useMemo(() => {
    let pool = activeEmployees;
    if (filterCountry !== "All") pool = pool.filter(e => (e.country || countryFor(e.location)) === filterCountry);
    return [...new Set(pool.map(e => e.location))].sort();
  }, [activeEmployees, filterCountry]);
  const countries = useMemo(() => [...new Set(activeEmployees.map(e => e.country || countryFor(e.location)))].sort(), [activeEmployees]);
  const businessGroups = useMemo(() => [...new Set(activeEmployees.map(e => e.bg))].sort(), [activeEmployees]);

  // Exec deck PDF generator — six slides built from the live data. Uses jsPDF (loaded
  // via CDN). All layout in points (jsPDF default for letter: 612 × 792).
  const generateExecDeck = useCallback(() => {
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) { alert("PDF library not loaded — reload the page and try again."); return; }
    const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
    const W = 792, H = 612, M = 48;

    const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

    // Department breakdown
    const deptCounts = {};
    activeEmployees.forEach(e => deptCounts[e.dept] = (deptCounts[e.dept] || 0) + 1);
    const deptRows = Object.entries(deptCounts).sort((a, b) => b[1] - a[1]);

    // Level pyramid — order top-of-org → IC, drop levels with no headcount
    const lvCounts = {};
    activeEmployees.forEach(e => { if (e.level) lvCounts[e.level] = (lvCounts[e.level] || 0) + 1; });
    const ALL_LV = ["C-Suite","SVP","VP","Director","Manager","IC6","IC5","IC4","IC3","IC2","IC1"];
    const pyramidRows = [
      ...ALL_LV.filter(l => lvCounts[l]).map(l => [l, lvCounts[l]]),
      // Append any levels not in the canonical list (sorted desc by count) so unknown levels still show
      ...Object.entries(lvCounts).filter(([l]) => !ALL_LV.includes(l)).sort((a, b) => b[1] - a[1]),
    ];

    // Hotspots
    const insights = atLeast(mode, "advanced") ? computeInsights(employees, tree) : { items: [] };
    const topHotspots = (hotspots || []).slice(0, 8);

    // Plan rollups
    const planSum = Object.entries(plan || {}).map(([group, lvs]) => {
      const total = Object.values(lvs).reduce((s, n) => s + (parseInt(n, 10) || 0), 0);
      return [group, total];
    }).filter(r => r[1] !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 10);

    // Flight risks — flightRisks is { [empId]: { score, reasons } }, join with employee data
    const empById = {};
    activeEmployees.forEach(e => { empById[e.id] = e; });
    const topRisks = Object.entries(flightRisks || {})
      .map(([id, r]) => {
        const emp = empById[id];
        if (!emp) return null;
        const score = r?.score || 0;
        return { ...emp, score, risk: score >= 70 ? "High" : score >= 40 ? "Medium" : "Low" };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // ─── Helpers ────────────────────────────────────────────────────────────
    function drawHeader(title, subtitle) {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, W, 8, "F");
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text(title, M, M + 4);
      if (subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(subtitle, M, M + 22);
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(M, M + 36, W - M, M + 36);
    }
    function drawFooter(pageNum, total) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`SemiCorp · ${today}`, M, H - 24);
      doc.text(`${pageNum} / ${total}`, W - M, H - 24, { align: "right" });
    }
    function table(rows, x, y, colWidths, headers) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      let cx = x;
      headers.forEach((h, i) => {
        doc.text(String(h), cx, y);
        cx += colWidths[i];
      });
      doc.setDrawColor(226, 232, 240);
      doc.line(x, y + 4, x + colWidths.reduce((s, w) => s + w, 0), y + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      let cy = y + 20;
      rows.forEach(row => {
        cx = x;
        row.forEach((cell, i) => {
          const txt = String(cell ?? "");
          const trim = txt.length > 60 ? txt.slice(0, 58) + "…" : txt;
          doc.text(trim, cx, cy);
          cx += colWidths[i];
        });
        cy += 16;
      });
      return cy;
    }
    function bigNum(label, value, x, y, color = [59, 130, 246]) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(36);
      doc.setTextColor(...color);
      doc.text(String(value), x, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(label, x, y + 14);
    }

    const TOTAL = 6;

    // ─── Slide 1: Cover ─────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor(59, 130, 246);
    doc.rect(0, H - 80, W, 80, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(48);
    doc.setTextColor(255, 255, 255);
    doc.text("SemiCorp Org", M, 220);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(20);
    doc.setTextColor(148, 163, 184);
    doc.text(`Headcount & Plan Overview`, M, 250);
    doc.setFontSize(12);
    doc.text(today, M, 280);
    bigNum("Active people",   activeEmployees.length, M,           360, [255, 255, 255]);
    bigNum("Departments",     deptRows.length,        M + 200,     360, [255, 255, 255]);
    bigNum("Locations",       locations.length,       M + 400,     360, [255, 255, 255]);
    if (atLeast(mode, "advanced")) bigNum("Hotspots", (hotspots || []).length, M + 580, 360, [251, 191, 36]);
    drawFooter(1, TOTAL);

    // ─── Slide 2: Org shape (departments) ──────────────────────────────────
    doc.addPage();
    drawHeader("Org shape", "Headcount by department");
    table(deptRows.map(([d, n]) => [d, n, `${(n / activeEmployees.length * 100).toFixed(1)}%`]),
      M, M + 70, [220, 100, 80], ["Department", "Headcount", "Share"]);
    drawFooter(2, TOTAL);

    // ─── Slide 3: Level pyramid ─────────────────────────────────────────────
    doc.addPage();
    drawHeader("Headcount pyramid", "People by level — top to bottom (executive → IC)");
    // Bar chart: each row gets a horizontal bar
    const maxN = Math.max(...pyramidRows.map(r => r[1]), 1);
    const barX = M + 80;
    const barMaxW = W - M - barX - 80;
    let by = M + 80;
    pyramidRows.forEach(([lv, n]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(lv, M, by + 4);
      doc.setFillColor(59, 130, 246);
      doc.rect(barX, by - 8, (n / maxN) * barMaxW, 14, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(String(n), barX + (n / maxN) * barMaxW + 6, by + 4);
      by += 22;
    });
    drawFooter(3, TOTAL);

    // ─── Slide 4: Hotspots ──────────────────────────────────────────────────
    doc.addPage();
    drawHeader(`Hotspots · ${(hotspots || []).length} flagged`, "Risk areas detected from span-of-control, tenure, and pipeline signals");
    if (topHotspots.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.text("No hotspots detected in the current org.", M, M + 80);
    } else {
      const rows = topHotspots.map(h => {
        const node = tree.map[h.nodeId];
        const who = node ? `${node.first} ${node.last} (${node.title || ""})` : h.nodeId;
        return [h.severity?.toUpperCase() || "—", who, h.type || "—", h.msg || ""];
      });
      table(rows, M, M + 70, [80, 240, 130, 240], ["Severity", "Owner", "Kind", "Why"]);
    }
    drawFooter(4, TOTAL);

    // ─── Slide 5: Headcount plan ────────────────────────────────────────────
    doc.addPage();
    drawHeader("Headcount plan · top deltas", `${planYears || planHorizonQ / 4 || "—"} year horizon`);
    if (planSum.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.text("No plan deltas configured. Use the Headcount Plan tab to set targets.", M, M + 80);
    } else {
      table(planSum.map(([g, n]) => [g, (n > 0 ? "+" : "") + n]),
        M, M + 70, [320, 120], ["Group", "Net change"]);
    }
    drawFooter(5, TOTAL);

    // ─── Slide 6: Top risks (flight risk) ───────────────────────────────────
    doc.addPage();
    drawHeader("Top retention risks", "Highest flight-risk individuals — brief, talk to managers in week 1");
    if (topRisks.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.text("No flight-risk signals — enable the Flight Risk overlay to compute.", M, M + 80);
    } else {
      const rows = topRisks.map(r => [
        `${r.first} ${r.last}`,
        r.title || "",
        r.dept || "",
        (r.risk || "").toUpperCase(),
        r.score?.toString() || "",
      ]);
      table(rows, M, M + 70, [180, 220, 130, 80, 60], ["Person", "Title", "Dept", "Risk", "Score"]);
    }
    drawFooter(6, TOTAL);

    doc.save(`semicorp-exec-deck-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [activeEmployees, employees, tree, hotspots, flightRisks, plan, locations, planYears, planHorizonQ, mode]);

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return activeEmployees.filter(e =>
      `${e.first} ${e.last}`.toLowerCase().includes(q) ||
      e.title.toLowerCase().includes(q) ||
      e.dept.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery, activeEmployees]);

  const displayRoot = useMemo(() => {
    if (focusRoot && tree.map[focusRoot]) return tree.map[focusRoot];
    return tree.root;
  }, [focusRoot, tree]);

  // Import a full employee dataset from CSV. Mirrors the export shape so users can round-trip:
  // export → tweak in Excel → re-import. Required columns: id, first, last, level, dept, managerId.
  // Unknown manager refs are reset to root and reporting cycles are broken so the org always
  // forms a valid forest. Replaces the current employees array (push to undo stack first).
  // Read a CSV or Excel (.xlsx/.xls) file and open the guided import dialog
  // (column mapping + replace/append + preview). Excel is parsed with SheetJS
  // (window.XLSX, loaded via CDN); its first worksheet is flattened to the same
  // rows-of-strings shape parseCSV produces, so everything downstream is shared.
  function openImportWizard(file) {
    const name = (file.name || "").toLowerCase();
    const isExcel = /\.(xlsx|xlsm|xlsb|xls)$/.test(name);
    const reader = new FileReader();

    if (isExcel) {
      reader.onload = ev => {
        try {
          const XLSX = window.XLSX;
          if (!XLSX) throw new Error("Excel library not loaded — reload the page and try again.");
          const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
          const firstSheet = wb.SheetNames[0];
          if (!firstSheet) throw new Error("The workbook has no sheets");
          // header:1 → array-of-arrays; defval:"" keeps blank cells; raw:false → formatted strings (dates, etc.)
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1, defval: "", raw: false, blankrows: false });
          const rows = aoa.map(r => r.map(c => (c == null ? "" : String(c)))).filter(r => r.some(c => c.trim() !== ""));
          if (rows.length < 2) throw new Error("The first sheet has no data rows");
          const header = rows[0].map(c => (c || "").trim());
          const sheetNote = wb.SheetNames.length > 1 ? ` (sheet “${firstSheet}” of ${wb.SheetNames.length})` : "";
          setImportState({ fileName: (file.name || "import.xlsx") + sheetNote, header, rows: rows.slice(1) });
        } catch (err) { alert("Could not read Excel file: " + err.message); }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    reader.onload = ev => {
      try {
        const rows = parseCSV(String(ev.target.result || ""));
        if (rows.length < 2) throw new Error("File has no data rows");
        const header = rows[0].map(c => (c || "").trim());
        setImportState({ fileName: file.name || "import.csv", header, rows: rows.slice(1) });
      } catch (err) { alert("Could not read CSV: " + err.message); }
    };
    reader.readAsText(file);
  }

  // Apply an import once the user has confirmed their column mapping + mode in the wizard.
  function applyEmployeeImport({ rows }, mapping, mode) {
    const col = k => (mapping[k] ?? -1);
    const get = (row, i) => i >= 0 ? (row[i] ?? "").toString().trim() : "";
    const out = [];
    const seenIds = new Set();
    let dupIds = 0, blankRows = 0, lvDefaulted = 0;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const id = get(row, col("id"));
      if (!id) { blankRows++; continue; }
      if (seenIds.has(id)) { dupIds++; continue; }
      seenIds.add(id);
      let first = get(row, col("first")), last = get(row, col("last"));
      if ((!first || !last) && col("fullName") >= 0) {
        const p = get(row, col("fullName")).split(/\s+/);
        if (!first) first = p[0] || "";
        if (!last) last = p.slice(1).join(" ") || "";
      }
      if (!first && !last) first = id; // never leave a person nameless (blank avatar/labels)
      const dept = get(row, col("dept")) || "General";
      let level = normalizeLevel(get(row, col("level")));
      if (!level) { level = "IC3"; lvDefaulted++; }
      const mgr = get(row, col("managerId"));
      out.push({
        id, first, last,
        title: get(row, col("title")) || `${displayLevel(level)} ${dept}`,
        level, dept,
        bg: get(row, col("bg")) || dept,
        fn: get(row, col("fn")) || dept,
        location: get(row, col("location")) || "Unknown",
        country: get(row, col("country")) || "—",
        employmentType: get(row, col("employmentType")) || "FTE",
        managerId: mgr || null,
        status: get(row, col("status")) || "Active",
        // Missing dates default to ~18mo before "today" so tenure math stays sane (not 1970)
        startDate: get(row, col("startDate")) || "2024-01-01",
        endDate: get(row, col("endDate")) || null,
        costCenter: get(row, col("costCenter")) || null,
        band: get(row, col("band")) || null,
      });
    }
    if (out.length === 0) { alert("No valid rows found to import."); return; }

    let finalList;
    if (mode === "append") {
      const byId = new Map(employees.map(e => [e.id, e]));
      out.forEach(e => byId.set(e.id, e)); // same id updates the existing person
      finalList = [...byId.values()];
    } else {
      finalList = out;
    }
    const idSet = new Set(finalList.map(e => e.id));
    let orphaned = 0;
    finalList.forEach(e => {
      if (e.managerId && !idSet.has(e.managerId)) { e.managerId = null; orphaned++; }
      if (e.id === e.managerId) { e.managerId = null; orphaned++; }
    });
    const idMap = new Map(finalList.map(e => [e.id, e]));
    let cyclesBroken = 0;
    finalList.forEach(e => {
      const seen = new Set(); let cur = e;
      while (cur && cur.managerId) { if (seen.has(cur.id)) { e.managerId = null; cyclesBroken++; break; } seen.add(cur.id); cur = idMap.get(cur.managerId); }
    });

    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(employees))]);
    setEmployees(finalList);
    setSelectedNode(null); setDetailPanel(null); setFocusRoot(null);
    setExpandedNodes(new Set()); setInsightHighlightIds(new Set()); setChainFilterId(null);
    setImportState(null);
    const notes = [];
    if (mode === "append") notes.push(`merged into existing org — ${finalList.length} total`);
    if (dupIds)       notes.push(`${dupIds} duplicate id${dupIds > 1 ? "s" : ""} skipped`);
    if (blankRows)    notes.push(`${blankRows} blank row${blankRows > 1 ? "s" : ""} skipped`);
    if (lvDefaulted)  notes.push(`${lvDefaulted} unrecognized level${lvDefaulted > 1 ? "s" : ""} set to L3`);
    if (orphaned)     notes.push(`${orphaned} unknown manager ref${orphaned > 1 ? "s" : ""} reset to root`);
    if (cyclesBroken) notes.push(`${cyclesBroken} reporting cycle${cyclesBroken > 1 ? "s" : ""} broken`);
    alert(`Imported ${out.length} row${out.length > 1 ? "s" : ""}.${notes.length ? "\n• " + notes.join("\n• ") : ""}`);
  }

  // Pipeline config — currently the user-editable piece is just the stage order, persisted in
  // localStorage by ProductPipelineView. Export wraps it with a version tag so future fields
  // (custom GA targets, custom stage definitions) can extend without breaking older imports.
  function exportPipelineConfig() {
    let stageOrder = null;
    try {
      const saved = JSON.parse(localStorage.getItem("orgSimStageOrder") || "null");
      if (Array.isArray(saved)) stageOrder = saved;
    } catch {}
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      stageOrder: stageOrder || DEFAULT_PIPELINE_STAGES.map(s => s.id),
      gaTargets: STAGE_CAT_GA_TARGET,
    };
    downloadFile(`pipeline-config-${new Date().toISOString().slice(0,10)}.json`,
      JSON.stringify(payload, null, 2), "application/json");
  }
  function importPipelineConfig(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data?.stageOrder)) throw new Error("Missing stageOrder array");
        const validIds = new Set(DEFAULT_PIPELINE_STAGES.map(s => s.id));
        const filtered = data.stageOrder.filter(id => validIds.has(id));
        if (filtered.length !== DEFAULT_PIPELINE_STAGES.length) {
          throw new Error(`stageOrder must contain all ${DEFAULT_PIPELINE_STAGES.length} known stage ids`);
        }
        try { localStorage.setItem("orgSimStageOrder", JSON.stringify(filtered)); } catch {}
        alert("Pipeline order imported. Reload or revisit the Pipeline tab to see the change.");
      } catch (err) { alert("Could not parse pipeline config: " + err.message); }
    };
    reader.readAsText(file);
  }


  // Build context value — new object each render is fine; components re-render but don't remount
  const ctxValue = {
    employees, setEmployees, view, setView, searchQuery, setSearchQuery,
    selectedNode, setSelectedNode, expandedNodes, setExpandedNodes,
    annotations, setAnnotations, showAnnotationForm, setShowAnnotationForm,
    annotationText, setAnnotationText, annotationType, setAnnotationType,
    colorBy, setColorBy, filterDept, setFilterDept, filterLoc, setFilterLoc,
    filterCountry, setFilterCountry, filterEmpType, setFilterEmpType,
    filterBG, setFilterBG, showHotspots, setShowHotspots,
    dragNode, setDragNode, dragOver, setDragOver, dragMode, setDragMode,
    undoStack, setUndoStack, detailPanel, setDetailPanel,
    focusRoot, setFocusRoot, sidebarCollapsed, setSidebarCollapsed,
    timelineMonth, setTimelineMonth, timelinePlaying, setTimelinePlaying,
    dashTab, setDashTab, zoom, setZoom,
    timelineSpeed, setTimelineSpeed, growthDimension, setGrowthDimension,
    insightHighlightIds, setInsightHighlightIds,
    chainFilterId, setChainFilterId,
    showDeparted, setShowDeparted, fullTree, chartDisplayRoot,
    exitSimNode, setExitSimNode,
    filterLevel, setFilterLevel,
    orgViewMode, setOrgViewMode,
    showFlightRisk, setShowFlightRisk, flightRisks,
    plan, setPlan, planGroupBy, setPlanGroupBy,
    planStartYear, setPlanStartYear, planHorizonQ, setPlanHorizonQ,
    planLocFilter, setPlanLocFilter, planEmployees,
    showPlannedInOrgChart, setShowPlannedInOrgChart,
    // Lifted EC + reqs state
    earlyTargetPct, setEarlyTargetPct,
    earlyMode, setEarlyMode,
    hireMixPct, setHireMixPct,
    internRatio, setInternRatio,
    annualExpHiresOverride, setAnnualExpHiresOverride,
    reqIncludeECCalc, setReqIncludeECCalc,
    projects, setProjects,
    reqOverrides, setReqOverrides, overrideReq, resetOverrides,
    positionMode, setPositionMode,
    customReqs, setCustomReqs,
    addPositionUnder, removePositionUnder,
    // 3-year attrition + growth model
    attritionPct, setAttritionPct,
    growthTarget3Yr, setGrowthTarget3Yr,
    growthShiftPerYear, setGrowthShiftPerYear,
    promoPctPerYear, setPromoPctPerYear,
    acquisitionsPerYear, setAcquisitionsPerYear,
    growthModel, levelHistogram,
    // Headcount derivations
    planGroupKey, planGroupLabel, planGroups, planCurrent, planProjected,
    planRollups, planSumPlan, planHorizon, planYears,
    plannedHires, defaultAnnualExpHires, annualExpHires,
    earlyByGroup, earlyCalc, earlyAllocByGroup,
    planManagersByGroup, chartReqs, reqsByManager,
    mode, setMode,
    teamDragRef, shiftHeldRef,
    activeEmployees, tree, hotspots, hotspotNodeIds, hotspotReasons, departments, locations, countries, businessGroups,
    searchResults, displayRoot,
    toggleExpand, expandAll, collapseAll, navigateTo, goToInsight, navigateToDept, focusChain, focusSubtree, handleDrop, undo,
    saveAnnotation, removeAnnotation, getNodeColor, getTenureColor, isFiltered, getTimelineMonths,
    importEmployeesCSV: openImportWizard, exportPipelineConfig, importPipelineConfig,
    tutorialMode, setTutorialMode, toggleTutorialMode,
    cmdkOpen, setCmdkOpen,
    nlOpen, setNlOpen,
    pendingDrop, confirmDrop, cancelDrop,
  };

  return (
    <AppCtx.Provider value={ctxValue}>
      <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif", background: "#f8fafc" }}>
      {!dataNoticeDismissed && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-3 text-xs text-amber-900">
          <span className="font-semibold">Privacy notice:</span>
          <span>All data stays in your browser — nothing is sent over the network. There is no auto-save; use Export to save your work.</span>
          <button onClick={clearAllLocalData}
            className="ml-auto text-[11px] px-2 py-1 rounded bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition-colors font-medium">
            Clear all local data
          </button>
          <button onClick={dismissDataNotice}
            className="text-[11px] px-2 py-1 rounded bg-amber-700 text-white hover:bg-amber-800 transition-colors font-medium">
            Got it
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&display=swap');
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
          .org-tree-scroll::-webkit-scrollbar { height: 6px; }
          @keyframes chartFadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes milestonePop {
            0%   { opacity: 0; transform: scale(0.4) translateY(30px); }
            70%  { transform: scale(1.06) translateY(-4px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes milestoneFadeOut {
            0%   { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(0.85) translateY(-20px); }
          }

        `}</style>

        {/* Sidebar */}
        <div className={`${sidebarCollapsed ? "w-14" : "w-56"} bg-slate-900 text-white flex flex-col shrink-0 transition-all duration-300 no-print`}>
          <div className="p-3 border-b border-slate-700 flex items-center gap-2">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-black">SC</div>
                <div><div className="text-xs font-bold">SemiCorp</div><div className="text-xs text-slate-400" style={{ fontSize: 9 }}>Org Navigator</div></div>
              </div>
            )}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1 hover:bg-slate-700 rounded transition-colors">
              {sidebarCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
            </button>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {[
              { id: "org-chart",    label: "Org Chart",   icon: Layers,        minMode: "simple"   },
              { id: "slides",       label: "Slides",      icon: FileText,      minMode: "simple"   },
              { id: "timeline",     label: "Timeline",    icon: Clock,         minMode: "advanced" },
              { id: "dashboards",   label: "Dashboards",  icon: BarChart3,     minMode: "advanced" },
              { id: "headcount",    label: "Headcount",   icon: Users,         minMode: "advanced" },
              { id: "analytics",    label: "Analytics",   icon: Zap,           minMode: "advanced" },
              { id: "pipeline",     label: "Pipeline",    icon: GitMerge,      minMode: "expert"   },
            ].filter(item => atLeast(mode, item.minMode)).map(item => (
              <button key={item.id} onClick={() => setView(item.id)} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${view === item.id ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}>
                <item.icon size={15}/>
                {!sidebarCollapsed && item.label}
              </button>
            ))}
          </nav>

          {/* ── Mode switcher ── */}
          <div className="p-2 border-t border-slate-700">
            {!sidebarCollapsed ? (
              <div>
                <div className="text-xs text-slate-500 px-1 mb-1.5 font-medium uppercase tracking-wide" style={{ fontSize: 9 }}>Mode</div>
                <div className="space-y-1">
                  {MODES.map(m => {
                    const meta = MODE_META[m];
                    const active = mode === m;
                    return (
                      <Tip key={m} text={meta.desc} side="right">
                        <button
                          onClick={() => { setMode(m); try { localStorage.setItem("orgSimMode", m); } catch {} if (!atLeast(m, VIEW_MIN_MODE[view] ?? "simple")) setView("org-chart"); }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${active ? "text-white font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
                          style={active ? { background: meta.color } : {}}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: active ? "white" : meta.color }}/>
                          {meta.label}
                        </button>
                      </Tip>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {MODES.map(m => {
                  const meta = MODE_META[m];
                  const active = mode === m;
                  return (
                    <Tip key={m} text={`${meta.label}: ${meta.desc}`} side="right">
                      <button
                        onClick={() => { setMode(m); try { localStorage.setItem("orgSimMode", m); } catch {} if (!atLeast(m, VIEW_MIN_MODE[view] ?? "simple")) setView("org-chart"); }}
                        className="w-full flex items-center justify-center py-1 rounded transition-all"
                        style={{ opacity: active ? 1 : 0.35 }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: meta.color }}/>
                      </button>
                    </Tip>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Tutorial toggle ── */}
          <div className="p-2 border-t border-slate-700">
            {!sidebarCollapsed ? (
              <Tip text={tutorialMode ? "Hide the ? help dots" : "Show ? help dots next to non-obvious controls"} side="right">
                <button
                  onClick={toggleTutorialMode}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${tutorialMode ? "bg-blue-600 text-white font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}>
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${tutorialMode ? "bg-white text-blue-600" : "bg-slate-700 text-slate-300"}`}>?</span>
                  Tutorial mode
                </button>
              </Tip>
            ) : (
              <Tip text={`Tutorial mode: ${tutorialMode ? "on" : "off"} — toggle ? help dots`} side="right">
                <button
                  onClick={toggleTutorialMode}
                  className="w-full flex items-center justify-center py-1 rounded transition-all">
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${tutorialMode ? "bg-blue-500 text-white" : "bg-slate-700 text-slate-400"}`}>?</span>
                </button>
              </Tip>
            )}
          </div>

          {!sidebarCollapsed && (
            <div className="p-3 border-t border-slate-700 space-y-2">
              <div className="flex justify-between text-xs"><span className="text-slate-400">Employees</span><span className="font-bold">{activeEmployees.length}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">Departments</span><span className="font-bold">{departments.length}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-400">Locations</span><span className="font-bold">{locations.length}</span></div>
              {atLeast(mode, "advanced") && <div className="flex justify-between text-xs"><span className="text-slate-400">Hotspots</span><span className="font-bold text-amber-400">{hotspots.length}</span></div>}
            </div>
          )}
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-3 shrink-0 flex-wrap no-print" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, title, department, ID..." className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"/>
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {searchResults.map(e => (
                    <button key={e.id} onClick={() => { navigateTo(e.id); setView("org-chart"); }} className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-center gap-2 text-xs border-b border-gray-50">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs" style={{ background: DEPT_COLORS[e.dept] || "#64748b", fontSize: 8 }}>{e.first[0]}{e.last[0]}</div>
                      <div><div className="font-medium text-gray-800">{e.first} {e.last}</div><div className="text-gray-400">{e.title} · {e.dept}</div></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Filters (org chart view only) */}
            {view === "org-chart" && (
              <>
                <Help text="Org Chart — the live reporting tree. Click a node to expand/collapse, or a person for their detail panel. Recolor nodes with the Color buttons (Dept / BU / Discipline / Location), narrow the view with these filters or search, and turn on Team Move to drag whole teams and model reorgs." side="bottom" width={320} />
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600">
                  <option value="All">All Departments</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterCountry} onChange={e => { setFilterCountry(e.target.value); setFilterLoc("All"); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600">
                  <option value="All">All Countries</option>
                  {countries.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600">
                  <option value="All">All Cities</option>
                  {locations.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={filterEmpType} onChange={e => setFilterEmpType(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600">
                  <option value="All">FTE + Contract</option>
                  <option value="FTE">FTE only</option>
                  <option value="Contract">Contract only</option>
                </select>
                {atLeast(mode, "advanced") && <>
                  <select value={filterBG} onChange={e => setFilterBG(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600">
                    <option value="All">All BUs</option>
                    {businessGroups.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600">
                    <option value="All">All Levels</option>
                    <option value="C-Suite">C-Suite</option>
                    <option value="VP+">VP+</option>
                    <option value="Director+">Director+</option>
                    <option value="Managers">Managers</option>
                    <option value="Senior ICs">Senior ICs (IC4+)</option>
                  </select>
                </>}
                <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
                  <span className="text-xs text-gray-400">Color:</span>
                  {["department", "business_group", "discipline", "location"].map(c => (
                    <button key={c} onClick={() => setColorBy(c)} className={`text-xs px-2 py-1 rounded transition-colors ${colorBy === c ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                      {c === "department" ? "Dept" : c === "business_group" ? "BU" : c === "discipline" ? "Discipline" : "Loc"}
                    </button>
                  ))}
                </div>
                <button onClick={() => setDragMode(m => m === "team" ? "individual" : "team")} className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${dragMode === "team" ? "bg-violet-600 text-white ring-2 ring-violet-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  title="When ON: dragging a node moves its entire reporting chain. Dropping on a subordinate swaps positions — both teams roll up to the next higher manager so neither person inherits the other's org.">
                  <Move size={12}/>{dragMode === "team" ? "Team Move ON" : "Team Move"}
                </button>
                {atLeast(mode, "advanced") && (
                  <button onClick={() => setShowPlannedInOrgChart(v => !v)} className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${showPlannedInOrgChart ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    title="Show open requisitions as dotted-ring ghost nodes under their hiring manager">
                    <Plus size={12}/>Open Reqs {showPlannedInOrgChart ? "ON" : "OFF"}
                  </button>
                )}
                {atLeast(mode, "advanced") && (
                  <button onClick={() => {
                      const next = !positionMode;
                      setPositionMode(next);
                      if (next) setShowPlannedInOrgChart(true);
                    }}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${positionMode ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    title="Inline +/− under each card to add or remove open positions reporting to that person">
                    <UserPlus size={12}/>Position Mode {positionMode ? "ON" : "OFF"}
                  </button>
                )}
                {atLeast(mode, "advanced") && <>
                  <button onClick={() => setShowHotspots(!showHotspots)} className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${showHotspots ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    <AlertTriangle size={12}/>Hotspots {showHotspots ? "ON" : "OFF"}
                  </button>
                  <button onClick={() => setShowFlightRisk(!showFlightRisk)} className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${showFlightRisk ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    <TrendingUp size={12}/>Flight Risk {showFlightRisk ? "ON" : "OFF"}
                  </button>
                  <button onClick={() => setShowDeparted(d => !d)} className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${showDeparted ? "bg-slate-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    title="Render terminated employees as ghost cards at their last manager">
                    <EyeOff size={12}/>Departed {showDeparted ? "ON" : "OFF"}
                  </button>
                </>}
              </>
            )}
            {undoStack.length > 0 && (
              <button onClick={undo} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 transition-colors" title="Undo (Ctrl+Z)">↩ Undo</button>
            )}
            {/* Export buttons */}
            <div className="flex items-center gap-1 ml-auto border-l border-gray-100 pl-3">
              <button
                title="Export employees as CSV — round-trips with Import below"
                onClick={() => {
                  const cols = ["id","first","last","title","dept","bg","fn","level","location","country","employmentType","managerId","isManager","tenureYears","status","startDate","endDate","costCenter","band"];
                  const rows = [cols.join(","), ...employees.map(e => cols.map(c => csvCell(e[c])).join(","))];
                  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "employees.csv"; a.click();
                }}
                className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
              ><Download size={12}/>CSV</button>
              <label
                title="Import employees from Excel (.xlsx) or CSV. Opens a guided dialog: auto-detects your columns (and lets you remap any), choose replace or append, download a starter template, and preview before importing. Ctrl+Z to undo."
                className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer">
                <Plus size={12}/>Import
                <input type="file" accept=".csv,text/csv,.xlsx,.xls,.xlsm,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) openImportWizard(f); e.target.value = ""; }}/>
              </label>
              {atLeast(mode, "advanced") && <button
                title="Export analytics report as JSON"
                onClick={() => {
                  const insights = computeInsights(employees, tree);
                  const { score, breakdown } = computeOrgHealthScore(insights, activeEmployees.length);
                  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), orgHealthScore: score, breakdown, insights }, null, 2)], { type: "application/json" });
                  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "analytics-report.json"; a.click();
                }}
                className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
              ><Download size={12}/>Analytics</button>}
              <button
                title="Ask the org in natural language (Claude Opus 4.7)"
                onClick={() => setNlOpen(true)}
                className="flex items-center gap-1 text-xs bg-violet-50 border border-violet-200 text-violet-700 px-2.5 py-1.5 rounded-lg hover:bg-violet-100 transition-colors">
                <Sparkles size={12}/>Ask
              </button>
              <button
                title="Generate a 6-slide exec deck PDF (cover, org shape, pyramid, hotspots, plan, risks)"
                onClick={generateExecDeck}
                className="flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
                <FileText size={12}/>Exec deck
              </button>
            </div>
          </div>

          {/* Focus root breadcrumb / chain filter banner */}
          {view === "org-chart" && (focusRoot && tree.map[focusRoot] || insightHighlightIds.size > 0) && (
            <div className={`border-b px-4 py-1.5 flex items-center gap-2 text-xs ${chainFilterId ? "bg-violet-50 border-violet-100" : "bg-blue-50 border-blue-100"}`}>
              <GitMerge size={12} className={chainFilterId ? "text-violet-600" : "text-blue-600"}/>
              {focusRoot && tree.map[focusRoot] ? (
                <>
                  <span className="text-blue-700">Subtree view:</span>
                  {getAncestorPath(tree.map, focusRoot).map((n, i, arr) => (
                    <span key={n.id}>
                      <button onClick={() => focusSubtree(n.id)} className="text-blue-600 hover:underline">{n.first} {n.last}</button>
                      {i < arr.length - 1 && <span className="text-blue-300 mx-1">›</span>}
                    </span>
                  ))}
                </>
              ) : chainFilterId && tree.map[chainFilterId] ? (
                <>
                  <span className="text-violet-700">Chain view:</span>
                  <span className="font-semibold text-violet-900">{tree.map[chainFilterId].first} {tree.map[chainFilterId].last}</span>
                  <span className="text-violet-400">—</span>
                  <span className="text-violet-600">{getAncestorPath(tree.map, chainFilterId).length - 1} levels up to CEO</span>
                  <span className="text-violet-300">·</span>
                  <span className="text-violet-600">{insightHighlightIds.size - getAncestorPath(tree.map, chainFilterId).length} reports below</span>
                </>
              ) : (
                <span className="text-violet-700">Analytics insight highlight — <span className="font-semibold">{insightHighlightIds.size}</span> nodes</span>
              )}
              <button onClick={() => { setFocusRoot(null); setInsightHighlightIds(new Set()); setChainFilterId(null); }} className={`ml-auto flex items-center gap-1 transition-colors ${chainFilterId ? "text-violet-600 hover:text-violet-800" : "text-blue-600 hover:text-blue-800"}`}><X size={12}/>Show Full Org</button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {view === "org-chart" && (
              <div ref={treeContainerRef} className="h-full overflow-auto p-6 org-tree-scroll flex flex-col">
                {/* Planned headcount overlay (toggled from toolbar Planned HC button) */}
                {showPlannedInOrgChart && (() => {
                  const items = [];
                  Object.entries(plan).forEach(([g, byLv]) => {
                    Object.entries(byLv).forEach(([lv, d]) => { if (d > 0) items.push({ g, lv, d }); });
                  });
                  const grouped = items.reduce((m, it) => { (m[it.g] = m[it.g] || []).push(it); return m; }, {});
                  const totalPlanned = items.reduce((s, it) => s + it.d, 0);
                  const ghostCount = chartReqs.length;
                  const groupKey   = { dept: "dept", bg: "bg", fn: "fn" }[planGroupBy];
                  const groupLabel = { dept: "Department", bg: "Business Unit", fn: "Discipline" }[planGroupBy];
                  return (
                    <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3 shrink-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Plus size={14} className="text-emerald-700"/>
                        <span className="text-xs font-bold text-emerald-800">Open Reqs Overlay</span>
                        <span className="text-xs text-emerald-700">{ghostCount} dotted-ring node{ghostCount === 1 ? "" : "s"} on chart · plan adds +{totalPlanned} across {Object.keys(grouped).length} {groupLabel.toLowerCase()}{Object.keys(grouped).length === 1 ? "" : "s"}</span>
                        <span className="text-[10px] text-emerald-600 ml-2">Edit in Headcount ▸ Reqs. State syncs both ways.</span>
                        <button onClick={() => setShowPlannedInOrgChart(false)} className="ml-auto text-emerald-700 hover:text-emerald-900"><X size={12}/></button>
                      </div>
                      {totalPlanned === 0 ? (
                        <div className="text-xs text-emerald-700 italic">No planned hires yet — go to Headcount Planning to add some.</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(grouped).map(([g, lst]) => {
                            const groupTotal = lst.reduce((s, it) => s + it.d, 0);
                            // Try to highlight the matching dept/bg/fn in the chart
                            const matchingMgrs = activeEmployees.filter(e => e[groupKey] === g
                              && tree.map[e.id] && tree.map[e.id]._directReports > 0).slice(0, 1);
                            const target = matchingMgrs[0];
                            return (
                              <button key={g}
                                onClick={() => target && navigateTo(target.id)}
                                title={target ? `Jump to ${target.first} ${target.last}` : "No matching node"}
                                className="bg-white border border-emerald-200 rounded-lg px-2 py-1 text-xs hover:bg-emerald-100 transition-colors flex items-center gap-2">
                                <span className="font-semibold text-emerald-800">+{groupTotal}</span>
                                <span className="text-gray-700">{g}</span>
                                <span className="flex gap-0.5">
                                  {lst.map(it => (
                                    <span key={it.lv} className={`px-1 rounded font-mono text-[10px] ${EARLY_DISPLAY_LEVELS.has(it.lv) ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"}`}>
                                      {it.lv}×{it.d}
                                    </span>
                                  ))}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Chart controls */}
                <div className="flex items-center gap-2 mb-4 flex-wrap shrink-0">
                  {/* View mode pills — Treemap/Sunburst are advanced */}
                  {atLeast(mode, "advanced") && (
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mr-2">
                      {[["tree","Tree"],["treemap","Treemap"],["sunburst","Sunburst"],["whiteboard","Whiteboard"],["galaxy","3D Galaxy"],["city","🏙 City"]].map(([m,l]) => (
                        <button key={m} onClick={() => setOrgViewMode(m)}
                          className="text-xs px-2.5 py-1 rounded-md transition-all"
                          style={{ background: orgViewMode === m ? "white" : "transparent", color: orgViewMode === m ? "#1e293b" : "#64748b", fontWeight: orgViewMode === m ? 600 : 400, boxShadow: orgViewMode === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                  {orgViewMode === "tree" && <>
                    <button onClick={expandAll} className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Expand All</button>
                    <button onClick={collapseAll} className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Collapse All</button>
                    <div className="text-xs text-gray-400 ml-2">
                      {dragNode
                        ? dragMode === "team"
                          ? <span className="text-violet-600 font-medium">⛓ Chain drag — whole subtree moves with them · release Shift to switch</span>
                          : <span className="text-blue-600 font-medium">👤 Solo drag — reports roll up to their manager · hold Shift to take the chain</span>
                        : <span>Drag to reassign · <kbd className="bg-gray-100 border border-gray-300 rounded px-1 py-0.5 font-mono" style={{fontSize:10}}>Shift</kbd>+drag = move whole chain · Click to view details</span>}
                    </div>
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 ml-auto">
                      <button onClick={() => setZoom(z => Math.max(0.05, +(z - 0.1).toFixed(2)))} className="text-xs bg-white border border-gray-200 w-7 h-7 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center font-bold text-gray-600">−</button>
                      <span className="text-xs text-gray-500 w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(2)))} className="text-xs bg-white border border-gray-200 w-7 h-7 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center font-bold text-gray-600">+</button>
                      {atLeast(mode, "advanced") && <>
                        <button onClick={() => setZoom(1)} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">100%</button>
                        <button onClick={() => setZoom(0.5)} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">50%</button>
                        <button onClick={() => setZoom(0.25)} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">25%</button>
                        <button onClick={() => setZoom(0.1)} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">10%</button>
                      </>}
                    </div>
                  </>}
                </div>
                {/* Tree view */}
                {orgViewMode === "tree" && chartDisplayRoot && (
                  <div className="flex-1 overflow-auto">
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: "fit-content", transition: "transform 0.12s ease" }}>
                      <div className="inline-block min-w-max"><OrgNode node={chartDisplayRoot}/></div>
                    </div>
                  </div>
                )}
                {orgViewMode === "treemap" && <TreemapOrgView/>}
                {orgViewMode === "sunburst" && <SunburstOrgView/>}
                {orgViewMode === "whiteboard" && <WhiteboardOrgView/>}
                {orgViewMode === "galaxy" && <GalaxyOrgView/>}
                {orgViewMode === "city" && <CityOrgView/>}
              </div>
            )}
            {view === "slides"      && <OrgSlideView/>}
            {view === "timeline"    && <TimelineView/>}
            {view === "dashboards"  && <DashboardView/>}
            {view === "headcount"   && <HeadcountPlanningView/>}
            {view === "analytics"   && <AnalyticsView/>}
            {view === "pipeline"    && <ProductPipelineView/>}
          </div>
        </div>

        {/* Detail panel */}
        {detailPanel && <DetailPanel/>}
        {importState && <EmployeeImportWizard data={importState} onCancel={() => setImportState(null)} onConfirm={(mapping, mode) => applyEmployeeImport(importState, mapping, mode)} />}
        {exitSimNode && <ExitSimModal/>}
      </div>
      </div>
      <CommandPalette/>
      <ReorgRipplePreview/>
      <NaturalLanguageQuery/>
    </AppCtx.Provider>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(OrgChartApp));
  