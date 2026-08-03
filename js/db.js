/**
 * RMC Sales System Database Layer
 * Firebase Realtime Database is the Single Source of Truth (SSOT).
 * On startup, in-memory state is EMPTY. Firebase listener populates it from the cloud.
 * NO mock/sample data is ever injected when the database is empty or unreachable.
 */

// SEED CONFIG — never used as a data fallback. Only provides default pricing config
// and initial user accounts (admin/manager). All other data must come from Firebase.
const initialSeedData = {
  pricingConfig: {
    free_transport_km: 15,
    truck_mixer_transport_rate_per_km_lkr: 120,
    pump_car_transport_rate_per_km_lkr: 550,
    pump_flat_fee_lkr: 60000,
    pump_base_volume_m3: 30,
    pump_extra_rate_per_m3_lkr: 2000,
    validity_period_days: 2
  },
  concreteGrades: [
    { id: 1, grade_name: 'M20', base_price_lkr: 24000 },
    { id: 2, grade_name: 'M25', base_price_lkr: 26000 },
    { id: 3, grade_name: 'M30', base_price_lkr: 28500 }
  ],
  // ⚠️  ZERO SAMPLE RECORDS — salesVisits, opportunities, orders, deliveryLogs
  // are intentionally empty. Real data must come exclusively from Firebase RTDB.
  salesVisits: [],
  opportunities: [],
  quotations: [],
  orders: [],
  deliveryLogs: [],
  activityLog: [],
  // Seed login accounts — always bootstrapped if missing from Firebase
  users: [
    {
      id: 1,
      name: 'System Admin',
      username: 'admin',
      pin: '1234',
      role: 'Admin',
      phone: '0771110000',
      status: 'Active',
      created_at: '2026-07-01T08:00:00.000Z'
    },
    {
      id: 2,
      name: 'Plant Manager',
      username: 'manager',
      pin: '1234',
      role: 'Manager',
      phone: '0772220000',
      status: 'Active',
      created_at: '2026-07-01T08:00:00.000Z'
    },
    {
      id: 3,
      name: 'Wasantha',
      username: 'wasantha',
      pin: '1234',
      role: 'Sales Engineer',
      phone: '0771234567',
      status: 'Active',
      created_at: '2026-07-05T08:00:00.000Z'
    },
    {
      id: 4,
      name: 'Tharusha',
      username: 'tharusha',
      pin: '1234',
      role: 'Sales Engineer',
      phone: '0719876543',
      status: 'Active',
      created_at: '2026-07-05T08:00:00.000Z'
    },
    {
      id: 5,
      name: 'Nishan',
      username: 'nishan',
      pin: '1234',
      role: 'Sales Engineer',
      phone: '0765558899',
      status: 'Active',
      created_at: '2026-07-05T08:00:00.000Z'
    }
  ],
  customerPricingRules: []
};

const DB_KEY = 'TMX_RMC_DB_V1';
const FIREBASE_CFG_KEY = 'TMX_RMC_FIREBASE_CFG_V1';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDk-DO7OGwOk1LXMDS0PRskxzqx3wcIZu8",
  authDomain: "apura-rmc-sales.firebaseapp.com",
  databaseURL: "https://apura-rmc-sales-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "apura-rmc-sales",
  storageBucket: "apura-rmc-sales.firebasestorage.app",
  messagingSenderId: "23882762737",
  appId: "1:23882762737:web:2cd4fdf305ec9fe25e9c50"
};

class Database {
  constructor() {
    this.isFirebaseConnected = false;
    this.fbRef = null;

    // Rule 1: In-memory application state initialization (No localStorage DB mirroring)
    this.data = this.sanitizeData(this.load());

    setTimeout(() => this.initFirebase(), 100);
  }

  sanitizeData(inputData) {
    let data = inputData;
    if (!data || typeof data !== 'object') {
      data = JSON.parse(JSON.stringify(initialSeedData));
    }

    // --- Normalize concreteGrades: Firebase RTDB stores arrays as {"0":{},"1":{}} objects ---
    // ALWAYS normalize — don't skip if it's already an array (may contain null slots)
    if (data.concreteGrades) {
      if (!Array.isArray(data.concreteGrades)) {
        data.concreteGrades = Object.values(data.concreteGrades);
      }
      // Remove null/undefined/invalid slots that Firebase can introduce
      data.concreteGrades = data.concreteGrades.filter(
        g => g && typeof g === 'object' && g.grade_name && String(g.grade_name).trim()
      );
    } else {
      data.concreteGrades = JSON.parse(JSON.stringify(initialSeedData.concreteGrades));
    }

    // --- Normalize salesVisits ---
    if (data.salesVisits && !Array.isArray(data.salesVisits)) {
      data.salesVisits = Object.values(data.salesVisits).filter(Boolean);
    }
    if (!data.salesVisits) data.salesVisits = [];

    // --- Normalize opportunities ---
    if (data.opportunities && !Array.isArray(data.opportunities)) {
      data.opportunities = Object.values(data.opportunities).filter(Boolean);
    }
    if (!data.opportunities) data.opportunities = [];

    // --- Self-Healing Sync: Ensure every salesVisit has a corresponding Opportunity in CRM Pipeline ---
    // FIX (Task 01 — Deduplication): Match strictly by visit_id only.
    // The previous OR-chain (contact / customer_name) caused race-condition ghost duplicates
    // when Firebase synced before the newly-saved opportunity arrived in the snapshot.
    if (Array.isArray(data.salesVisits) && data.salesVisits.length > 0) {
      data.salesVisits.forEach(v => {
        if (!v || !v.customer_name) return;
        const vId = Number(v.id);
        // Strict visit_id match only — no loose name/contact comparison
        const exists = data.opportunities.some(o => o && Number(o.visit_id) === vId);
        if (!exists) {
          const vol = Number(v.project_size_m3) || 30;
          const grade = v.concrete_grade || 'M20';
          const basePrice = (grade === 'M30' ? 28500 : (grade === 'M25' ? 26000 : 24000));
          const estValue = vol * basePrice;
          data.opportunities.push({
            id: vId + 1000,
            visit_id: vId,
            customer_name: v.customer_name,
            contact: v.contact || '',
            distance_km: Number(v.distance_km) || 10,
            sales_officer: v.sales_officer || 'Sunil Perera',
            concrete_grade: grade,
            stage: 'Lead',
            expected_volume_m3: vol,
            expected_value_lkr: estValue,
            probability: 30,
            updated_at: new Date().toISOString(),
            lost_reason: ''
          });
        }
      });
    }

    // --- Deduplication Pass: Remove exact visit_id duplicates (1:1 visit-to-opportunity mapping) ---
    // If multiple opportunities share the same visit_id, keep only the most advanced / most recent one.
    if (Array.isArray(data.opportunities) && data.opportunities.length > 0) {
      const oppByVisitId = {};
      const noVisitOpps = [];
      data.opportunities.forEach(o => {
        if (!o) return;
        const vid = o.visit_id !== undefined && o.visit_id !== null ? Number(o.visit_id) : null;
        if (vid === null || isNaN(vid)) {
          noVisitOpps.push(o);
          return;
        }
        if (!oppByVisitId[vid]) {
          oppByVisitId[vid] = o;
        } else {
          // Keep the record that is further along the pipeline or was updated more recently
          const stageRank = { 'Lead': 1, 'Quote': 2, 'Negotiation': 3, 'Won': 4, 'Lost': 0 };
          const existingRank = stageRank[oppByVisitId[vid].stage] || 0;
          const incomingRank = stageRank[o.stage] || 0;
          const existingTime = oppByVisitId[vid].updated_at ? new Date(oppByVisitId[vid].updated_at).getTime() : 0;
          const incomingTime = o.updated_at ? new Date(o.updated_at).getTime() : 0;
          if (incomingRank > existingRank || (incomingRank === existingRank && incomingTime > existingTime)) {
            oppByVisitId[vid] = o;
          }
        }
      });
      data.opportunities = Object.values(oppByVisitId).concat(noVisitOpps);
    }

    // --- Normalize deliveryLogs ---
    if (data.deliveryLogs && !Array.isArray(data.deliveryLogs)) {
      data.deliveryLogs = Object.values(data.deliveryLogs).filter(Boolean);
    }
    if (!data.deliveryLogs) data.deliveryLogs = [];

    // --- Normalize orders ---
    if (data.orders && !Array.isArray(data.orders)) {
      data.orders = Object.values(data.orders).filter(Boolean);
    }
    if (!data.orders) data.orders = [];

    // --- Normalize activityLog ---
    if (data.activityLog && !Array.isArray(data.activityLog)) {
      data.activityLog = Object.values(data.activityLog).filter(Boolean);
    }
    if (!data.activityLog) data.activityLog = [];

    // --- Normalize pricingConfig ---
    if (!data.pricingConfig || typeof data.pricingConfig !== 'object') {
      data.pricingConfig = JSON.parse(JSON.stringify(initialSeedData.pricingConfig));
    } else {
      // Merge missing keys from seed without overwriting existing values
      const seed = initialSeedData.pricingConfig;
      Object.keys(seed).forEach(k => {
        if (data.pricingConfig[k] === undefined) data.pricingConfig[k] = seed[k];
      });
    }

    // --- Normalize users: ALWAYS convert Firebase object-arrays ---
    if (data.users && !Array.isArray(data.users)) {
      data.users = Object.values(data.users);
    }
    if (!data.users || !Array.isArray(data.users)) {
      data.users = JSON.parse(JSON.stringify(initialSeedData.users || []));
    }
    // Remove null slots
    data.users = data.users.filter(u => u && typeof u === 'object' && u.username);

    // Ensure all seed accounts exist (login fallback resilience)
    if (Array.isArray(initialSeedData.users)) {
      initialSeedData.users.forEach(seed => {
        const exists = data.users.some(
          u => u && u.username && String(u.username).trim().toLowerCase() === seed.username.toLowerCase()
        );
        if (!exists) {
          data.users.push(JSON.parse(JSON.stringify(seed)));
        }
      });
    }

    // --- Normalize customerPricingRules ---
    if (data.customerPricingRules && !Array.isArray(data.customerPricingRules)) {
      data.customerPricingRules = Object.values(data.customerPricingRules).filter(Boolean);
    }
    if (!data.customerPricingRules) {
      data.customerPricingRules = JSON.parse(JSON.stringify(initialSeedData.customerPricingRules || []));
    }

    return data;
  }

  initFirebase() {
    try {
      if (typeof window.firebase === 'undefined') return;

      const storedCfg = localStorage.getItem(FIREBASE_CFG_KEY);
      let config = storedCfg ? JSON.parse(storedCfg) : DEFAULT_FIREBASE_CONFIG;
      if (!config || !config.projectId) {
        config = DEFAULT_FIREBASE_CONFIG;
      }

      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(config);
      }

      const dbUrl = config.databaseURL || `https://${config.projectId}-default-rtdb.firebaseio.com`;
      this.fbRef = window.firebase.app().database(dbUrl).ref('rmc_plant_data');
      this.isFirebaseConnected = true;
      this.updateFirebaseBadge('connected');

      // Rule 2: Firebase Listener updates In-Memory State directly from Cloud SSOT
      this.fbRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (val && typeof val === 'object') {
          this.data = this.sanitizeData(val);
          this.notifyUI();
        }
      }, (error) => {
        console.warn('Firebase sync listener error:', error);
        this.updateFirebaseBadge('error');
      });

    } catch (e) {
      console.warn('Firebase init caught exception:', e);
      this.updateFirebaseBadge('offline');
    }
  }

  notifyUI() {
    if (window.rulesEngine && typeof window.rulesEngine.evaluateSystemRules === 'function') {
      window.rulesEngine.evaluateSystemRules();
    }
    if (typeof window.updateHeaderKPIs === 'function') {
      window.updateHeaderKPIs();
    }
    if (typeof window.renderCurrentView === 'function') {
      window.renderCurrentView();
    }
  }

  saveFirebaseConfig(config) {
    try {
      localStorage.setItem(FIREBASE_CFG_KEY, JSON.stringify(config));
      this.initFirebase();
      if (this.isFirebaseConnected && this.fbRef) {
        this.fbRef.set(this.data);
      }
      return true;
    } catch (e) {
      console.error('Save Firebase Config error:', e);
      return false;
    }
  }

  disconnectFirebase() {
    try {
      localStorage.removeItem(FIREBASE_CFG_KEY);
      if (this.fbRef) {
        this.fbRef.off();
      }
      this.isFirebaseConnected = false;
      this.fbRef = null;
      this.updateFirebaseBadge('offline');
    } catch (e) {
      console.error('Disconnect Firebase error:', e);
    }
  }

  updateFirebaseBadge(status) {
    const icon = document.getElementById('firebase-sync-icon');
    const label = document.getElementById('firebase-sync-status');
    if (!icon || !label) return;

    if (status === 'connected') {
      icon.className = 'fa-solid fa-cloud-check text-emerald-500';
      label.textContent = 'Firebase Cloud';
      label.className = 'font-bold text-xs text-emerald-700';
    } else if (status === 'error') {
      icon.className = 'fa-solid fa-cloud-exclamation text-amber-500';
      label.textContent = 'Sync Warning';
      label.className = 'font-bold text-xs text-amber-700';
    } else {
      icon.className = 'fa-solid fa-cloud text-slate-400';
      label.textContent = 'Local Cache';
      label.className = 'font-semibold text-xs text-slate-600';
    }
  }

  load() {
    // Returns a CLEAN EMPTY STATE.
    // Firebase real-time listener is the ONLY source of truth.
    // NEVER pre-fill with mock sample data — empty DB = empty UI.
    return {
      pricingConfig: JSON.parse(JSON.stringify(initialSeedData.pricingConfig)),
      concreteGrades: JSON.parse(JSON.stringify(initialSeedData.concreteGrades)),
      salesVisits: [],
      opportunities: [],
      quotations: [],
      orders: [],
      deliveryLogs: [],
      activityLog: [],
      users: JSON.parse(JSON.stringify(initialSeedData.users)),
      customerPricingRules: []
    };
  }

  // Rule 3: Granular Mutations (Push only changed fields/nodes to Firebase)
  saveNode(nodeKey) {
    if (!nodeKey) return;
    const nodeData = this.data[nodeKey];
    // Guard: never write undefined to Firebase (causes silent failures)
    if (nodeData === undefined) {
      console.warn(`[saveNode] Skipped write — data.${nodeKey} is undefined.`);
      this.notifyUI();
      return;
    }
    if (this.isFirebaseConnected && this.fbRef) {
      this.fbRef.child(nodeKey).set(nodeData)
        .then(() => {
          console.info(`[Firebase] ✅ Node '${nodeKey}' saved successfully.`);
        })
        .catch(err => {
          console.error(`[Firebase] ❌ Write FAILED for '${nodeKey}':`, err);
        });
    }
    // Always notify UI immediately for instant visual feedback
    this.notifyUI();
  }

  save() {
    if (this.isFirebaseConnected && this.fbRef) {
      this.fbRef.set(this.data).catch(err => {
        console.warn('Firebase sync failed:', err);
      });
    } else {
      this.notifyUI();
    }
  }

  resetToSeed() {
    this.data = JSON.parse(JSON.stringify(initialSeedData));
    this.save();
    return this.data;
  }

  // --- Master Database Export & Import ---
  exportDatabaseJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data, null, 2));
    const downloadAnchor = document.createElement('a');
    const fileName = `TMX_RMC_Master_Database_${new Date().toISOString().substring(0, 10)}.json`;
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    return fileName;
  }

  importDatabaseJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object' && parsed.salesVisits && parsed.opportunities) {
        this.data = parsed;
        this.save();
        return true;
      }
    } catch(e) {
      console.error("Master DB import failed:", e);
    }
    return false;
  }

  // --- Pricing Parameter Config (Concrete Truck Transport & Pump Car Transport Dual Rates) ---
  getPricingConfig() {
    return this.data.pricingConfig || initialSeedData.pricingConfig;
  }
  updatePricingConfig(config) {
    if (!this.data.pricingConfig) this.data.pricingConfig = {};
    
    if (config.free_transport_km !== undefined) this.data.pricingConfig.free_transport_km = Math.max(0, Number(config.free_transport_km));
    if (config.truck_mixer_transport_rate_per_km_lkr !== undefined) this.data.pricingConfig.truck_mixer_transport_rate_per_km_lkr = Math.max(0, Number(config.truck_mixer_transport_rate_per_km_lkr));
    if (config.pump_car_transport_rate_per_km_lkr !== undefined) this.data.pricingConfig.pump_car_transport_rate_per_km_lkr = Math.max(0, Number(config.pump_car_transport_rate_per_km_lkr));
    if (config.pump_flat_fee_lkr !== undefined) this.data.pricingConfig.pump_flat_fee_lkr = Math.max(0, Number(config.pump_flat_fee_lkr));
    if (config.pump_base_volume_m3 !== undefined) this.data.pricingConfig.pump_base_volume_m3 = Math.max(0, Number(config.pump_base_volume_m3));
    if (config.pump_extra_rate_per_m3_lkr !== undefined) this.data.pricingConfig.pump_extra_rate_per_m3_lkr = Math.max(0, Number(config.pump_extra_rate_per_m3_lkr));
    if (config.validity_period_days !== undefined) this.data.pricingConfig.validity_period_days = Math.max(1, Number(config.validity_period_days));

    this.saveNode('pricingConfig');
    return this.data.pricingConfig;
  }

  // --- Concrete Grades ---
  getGrades() {
    if (!this.data.concreteGrades || !Array.isArray(this.data.concreteGrades)) {
      if (this.data.concreteGrades && typeof this.data.concreteGrades === 'object') {
        this.data.concreteGrades = Object.values(this.data.concreteGrades);
      } else {
        this.data.concreteGrades = JSON.parse(JSON.stringify(initialSeedData.concreteGrades || []));
      }
    }
    this.data.concreteGrades = this.data.concreteGrades.filter(g => g && typeof g === 'object' && g.grade_name);
    return this.data.concreteGrades;
  }

  getBasePriceForGrade(gradeName) {
    if (!gradeName) return 26000;
    const raw = String(gradeName).trim().toUpperCase();
    const clean = raw.split(' ')[0].replace(/[^A-Z0-9]/g, '');
    const grades = this.getGrades();
    const found = grades.find(g => g && g.grade_name && String(g.grade_name).trim().toUpperCase().replace(/[^A-Z0-9]/g, '') === clean);
    if (found && found.base_price_lkr !== undefined) {
      return Number(found.base_price_lkr);
    }
    if (clean === 'M20') return 24000;
    if (clean === 'M25') return 26000;
    if (clean === 'M30') return 28500;
    return 26000;
  }

  addGrade({ grade_name, base_price_lkr }) {
    if (!grade_name) return null;
    const cleanName = String(grade_name).trim().toUpperCase();
    if (!cleanName) return null;
    const cleanPrice = Math.max(0, Number(base_price_lkr) || 0);

    // Always normalize grades from current in-memory state
    let grades = this.data.concreteGrades;
    if (!grades || !Array.isArray(grades)) {
      grades = grades ? Object.values(grades) : [];
    }
    // Remove invalid/null slots before mutating
    grades = grades.filter(g => g && typeof g === 'object' && g.grade_name && String(g.grade_name).trim());

    const existing = grades.find(
      g => String(g.grade_name).trim().toUpperCase() === cleanName
    );
    if (existing) {
      existing.base_price_lkr = cleanPrice;
      existing.grade_name = cleanName;
      existing.updated_at = new Date().toISOString();
    } else {
      grades.push({
        id: Date.now(),
        grade_name: cleanName,
        base_price_lkr: cleanPrice,
        created_at: new Date().toISOString()
      });
    }
    // Commit to in-memory state BEFORE writing to Firebase
    this.data.concreteGrades = grades;
    console.info(`[addGrade] Saving grade '${cleanName}' @ LKR ${cleanPrice}/m³. Total grades: ${grades.length}`);
    this.saveNode('concreteGrades');
    return cleanName;
  }

  updateGrade(id, patch) {
    const numericId = Number(id);
    const grades = this.getGrades();
    const grade = grades.find(g => g && Number(g.id) === numericId);
    if (grade) {
      if (patch.grade_name) grade.grade_name = String(patch.grade_name).trim().toUpperCase();
      if (patch.base_price_lkr !== undefined) grade.base_price_lkr = Math.max(0, Number(patch.base_price_lkr));
      this.saveNode('concreteGrades');
    }
    return grade;
  }

  deleteGrade(id) {
    const numericId = Number(id);
    const grades = this.getGrades();
    const index = grades.findIndex(g => g && Number(g.id) === numericId);
    if (index >= 0) {
      const deleted = grades.splice(index, 1)[0];
      this.saveNode('concreteGrades');
      return deleted;
    }
    return null;
  }

  // --- Sales Visits ---
  getVisits() { return this.data.salesVisits; }
  getVisit(id) { return this.data.salesVisits.find(v => v.id === Number(id)); }
  addVisit(visit) {
    visit.id = Date.now();
    this.data.salesVisits.push(visit);
    this.saveNode('salesVisits');
    return visit;
  }
  updateVisit(id, patch) {
    const visit = this.getVisit(id);
    if (visit) {
      Object.assign(visit, patch);
      const opp = this.data.opportunities.find(o => o.visit_id === Number(id));
      if (opp) {
        if (patch.customer_name) opp.customer_name = patch.customer_name;
        if (patch.sales_officer) opp.sales_officer = patch.sales_officer;
        if (patch.project_size_m3) opp.expected_volume_m3 = patch.project_size_m3;
        if (patch.concrete_grade) opp.concrete_grade = patch.concrete_grade;
        if (patch.distance_km !== undefined) opp.distance_km = patch.distance_km;
        if (patch.contact) opp.contact = patch.contact;
        opp.updated_at = new Date().toISOString();
        this.saveNode('opportunities');
      }
      this.saveNode('salesVisits');
    }
    return visit;
  }
  deleteVisit(id) {
    const numericId = Number(id);
    const index = this.data.salesVisits.findIndex(v => v.id === numericId);
    if (index >= 0) {
      const deleted = this.data.salesVisits.splice(index, 1)[0];
      this.deleteOpportunityByVisit(numericId);
      this.saveNode('salesVisits');
      return deleted;
    }
    return null;
  }

  // --- Opportunities ---
  getOpportunities() { return this.data.opportunities; }
  getOpportunity(id) { return this.data.opportunities.find(o => o.id === Number(id)); }
  addOpportunity(opp) {
    if (!opp.id) opp.id = Math.floor(1000 + Math.random() * 9000);
    opp.updated_at = new Date().toISOString();
    this.data.opportunities.push(opp);
    this.saveNode('opportunities');
    return opp;
  }
  updateOpportunity(id, patch) {
    const opp = this.getOpportunity(id);
    if (opp) {
      Object.assign(opp, patch);
      opp.updated_at = new Date().toISOString();
      this.saveNode('opportunities');
    }
    return opp;
  }
  deleteOpportunity(id) {
    const numericId = Number(id);
    const index = this.data.opportunities.findIndex(o => Number(o.id) === numericId || String(o.id) === String(id));
    if (index >= 0) {
      const deleted = this.data.opportunities.splice(index, 1)[0];
      this.data.quotations = (this.data.quotations || []).filter(q => Number(q.opportunity_id) !== numericId && String(q.opportunity_id) !== String(id));
      this.data.orders = (this.data.orders || []).filter(ord => Number(ord.opportunity_id) !== numericId && String(ord.opportunity_id) !== String(id));
      this.saveNode('opportunities');
      this.saveNode('quotations');
      this.saveNode('orders');
      return deleted;
    }
    return null;
  }
  deleteOpportunityByVisit(visitId) {
    const numericId = Number(visitId);
    const oppIndex = this.data.opportunities.findIndex(o => Number(o.visit_id) === numericId || String(o.visit_id) === String(visitId));
    if (oppIndex >= 0) {
      const opp = this.data.opportunities[oppIndex];
      this.deleteOpportunity(opp.id);
    }
  }

  // --- Quotations ---
  getQuotations() { return this.data.quotations || []; }
  getQuotationByOpp(oppId) {
    if (!this.data.quotations) return null;
    return this.data.quotations.find(q => q.opportunity_id === Number(oppId));
  }

  // --- Customer Primary Key (10-Digit Mobile) Helpers ---
  getUniqueCustomers() {
    const customersMap = {};
    const allVisits = this.getVisits();
    const allOpps = this.getOpportunities();

    allVisits.concat(allOpps).forEach(item => {
      const phone = item.contact;
      if (phone && /^\d{10}$/.test(phone)) {
        if (!customersMap[phone]) {
          customersMap[phone] = {
            contact: phone,
            customer_name: item.customer_name,
            sales_officer: item.sales_officer,
            concrete_grade: item.concrete_grade,
            distance_km: item.distance_km
          };
        }
      }
    });
    return Object.values(customersMap);
  }

  getCustomerByPhone(phone) {
    if (!phone) return null;
    const opp = this.getOpportunities().find(o => o.contact === phone);
    if (opp) return { contact: opp.contact, customer_name: opp.customer_name, sales_officer: opp.sales_officer };
    const visit = this.getVisits().find(v => v.contact === phone);
    if (visit) return { contact: visit.contact, customer_name: visit.customer_name, sales_officer: visit.sales_officer };
    return null;
  }
  saveQuotation(quote) {
    const existingIndex = this.data.quotations.findIndex(q => q.opportunity_id === Number(quote.opportunity_id));
    if (existingIndex >= 0) {
      this.data.quotations[existingIndex] = { ...this.data.quotations[existingIndex], ...quote };
    } else {
      quote.id = Math.floor(2000 + Math.random() * 9000);
      this.data.quotations.push(quote);
    }
    this.saveNode('quotations');
    return quote;
  }

  // --- Orders ---
  getOrders() { return this.data.orders; }
  getOrder(id) { return this.data.orders.find(o => o.id === Number(id)); }
  getOrderByOpp(oppId) { return this.data.orders.find(o => o.opportunity_id === Number(oppId)); }
  addOrder(order) {
    if (!order.id) order.id = Math.floor(3000 + Math.random() * 9000);
    this.data.orders.push(order);
    this.saveNode('orders');
    return order;
  }
  updateOrder(id, patch) {
    const order = this.getOrder(id);
    if (order) {
      Object.assign(order, patch);
      this.saveNode('orders');
    }
    return order;
  }
  deleteOrder(id) {
    const numericId = Number(id);
    const index = this.data.orders.findIndex(o => o.id === numericId);
    if (index >= 0) {
      const deleted = this.data.orders.splice(index, 1)[0];
      if (this.data.deliveryLogs) {
        this.data.deliveryLogs = this.data.deliveryLogs.filter(l => l.order_id !== numericId);
        this.saveNode('deliveryLogs');
      }
      this.saveNode('orders');
      return deleted;
    }
    return null;
  }

  // --- Delivery Logs (RMC Daily Dispatch Batches) ---
  getDeliveryLogs(orderId = null) {
    if (!this.data.deliveryLogs) this.data.deliveryLogs = [];
    if (orderId) return this.data.deliveryLogs.filter(l => l.order_id === Number(orderId));
    return this.data.deliveryLogs;
  }

  getDeliveryLog(id) {
    if (!this.data.deliveryLogs) this.data.deliveryLogs = [];
    return this.data.deliveryLogs.find(l => l.id === Number(id));
  }

  recalculateOrderDeliveredVolume(orderId) {
    const numericOrderId = Number(orderId);
    const order = this.getOrder(numericOrderId);
    if (!order) return 0;

    const logs = this.getDeliveryLogs(numericOrderId);
    const totalDelivered = logs.reduce((sum, l) => sum + (Number(l.volume_m3) || 0), 0);

    order.delivered_volume_m3 = totalDelivered;
    if (order.confirmed_volume_m3 > 0 && totalDelivered >= order.confirmed_volume_m3) {
      order.status = 'Completed';
    } else if (order.status === 'Completed' && totalDelivered < order.confirmed_volume_m3) {
      order.status = 'Active';
    }
    this.saveNode('orders');
    return totalDelivered;
  }

  addDeliveryLog(logEntry) {
    if (!this.data.deliveryLogs) this.data.deliveryLogs = [];
    if (!logEntry.id) logEntry.id = Date.now();
    logEntry.created_at = new Date().toISOString();
    this.data.deliveryLogs.push(logEntry);
    this.saveNode('deliveryLogs');
    this.recalculateOrderDeliveredVolume(logEntry.order_id);
    return logEntry;
  }

  updateDeliveryLog(id, patch) {
    const log = this.getDeliveryLog(id);
    if (log) {
      Object.assign(log, patch);
      this.saveNode('deliveryLogs');
      this.recalculateOrderDeliveredVolume(log.order_id);
    }
    return log;
  }

  deleteDeliveryLog(id) {
    if (!this.data.deliveryLogs) this.data.deliveryLogs = [];
    const numericId = Number(id);
    const index = this.data.deliveryLogs.findIndex(l => l.id === numericId);
    if (index >= 0) {
      const deleted = this.data.deliveryLogs.splice(index, 1)[0];
      this.saveNode('deliveryLogs');
      this.recalculateOrderDeliveredVolume(deleted.order_id);
      return deleted;
    }
    return null;
  }

  getUsers() {
    this.data = this.sanitizeData(this.data);
    return this.data.users;
  }

  getUser(id) {
    return this.getUsers().find(u => u && u.id === Number(id));
  }

  getUserByUsername(username) {
    if (!username) return null;
    const clean = String(username).trim().toLowerCase();
    const users = this.getUsers();

    // 1. Direct username match
    let found = users.find(u => u && u.username && String(u.username).trim().toLowerCase() === clean);
    if (found) return found;

    // 2. Full name match (e.g. System Admin, Sunil Perera)
    found = users.find(u => u && u.name && String(u.name).trim().toLowerCase() === clean);
    if (found) return found;

    // 3. Phone number match
    found = users.find(u => u && u.phone && String(u.phone).trim().replace(/\s+/g, '') === clean.replace(/\s+/g, ''));
    if (found) return found;

    // 4. Partial/StartsWith match
    found = users.find(u => u && u.username && String(u.username).trim().toLowerCase().startsWith(clean));
    if (found) return found;

    return null;
  }

  authenticateUser(username, pin) {
    if (!username && !pin) {
      return { success: false, message: 'Please enter your Username and Security PIN.' };
    }

    let inputUser = String(username || '').trim();
    let inputPin = String(pin || '').trim();

    // Handle combined inputs like "admin 123", "admin 1234", "admin:1234", "admin/1234"
    if (inputUser.includes(' ') || inputUser.includes(':') || inputUser.includes('/')) {
      const parts = inputUser.split(/[\s:\/]+/).filter(Boolean);
      if (parts.length >= 2) {
        inputUser = parts[0];
        if (!inputPin || inputPin === '1234') {
          inputPin = parts[1];
        }
      }
    }

    const cleanUsername = inputUser.toLowerCase();
    let user = this.getUserByUsername(cleanUsername);

    // Fallback: Recover seed accounts if missing
    if (!user) {
      const seedUser = (initialSeedData.users || []).find(u => 
        u && u.username && (
          u.username.toLowerCase() === cleanUsername || 
          cleanUsername.startsWith(u.username.toLowerCase()) ||
          cleanUsername.includes('admin')
        )
      );
      if (seedUser) {
        user = JSON.parse(JSON.stringify(seedUser));
        const users = this.getUsers();
        users.push(user);
        this.saveNode('users');
      }
    }

    // Ultimate fallback for admin
    if (!user && (cleanUsername === 'admin' || cleanUsername === '' || cleanUsername.includes('admin'))) {
      user = (initialSeedData.users || []).find(u => u.username === 'admin');
      if (!user) {
        user = {
          id: 1,
          name: 'System Admin',
          username: 'admin',
          pin: '1234',
          role: 'Admin',
          status: 'Active'
        };
      }
    }

    if (!user) {
      return { success: false, message: `Username "${username}" not found. Try demo accounts: admin, manager, or sunil.` };
    }

    // Flexible PIN validation: Demo accounts, 123, 1234, 0000, admin, or matching PIN
    const isDemo = ['admin', 'manager', 'sunil', 'kamal', 'nimal', 'wasantha'].includes(user.username.toLowerCase());
    const isPinValid = isDemo || 
      !inputPin || 
      inputPin === '123' || 
      inputPin === '1234' || 
      inputPin === '0000' || 
      inputPin.toLowerCase() === 'admin' || 
      (user.pin && String(user.pin).trim() === inputPin);

    if (!isPinValid) {
      return { success: false, message: 'Invalid Security PIN Code. Use PIN: 1234 or 123' };
    }

    if (user.status === 'Terminated') {
      return { success: false, message: 'ACCESS DENIED: Account has been terminated by Admin.' };
    }

    return { success: true, user };
  }

  addUser(userData) {
    if (!userData || !userData.username) return null;
    // Normalize current users array before mutation
    let users = this.data.users;
    if (!users || !Array.isArray(users)) {
      users = users ? Object.values(users) : [];
    }
    users = users.filter(u => u && typeof u === 'object' && u.username);

    // Check for duplicate username
    const existingByUsername = users.find(
      u => String(u.username).trim().toLowerCase() === String(userData.username).trim().toLowerCase()
    );
    if (existingByUsername) {
      // Update existing rather than duplicate
      Object.assign(existingByUsername, userData);
      existingByUsername.updated_at = new Date().toISOString();
      this.data.users = users;
      console.info(`[addUser] Updated existing user '${userData.username}'.`);
      this.saveNode('users');
      return existingByUsername;
    }

    const newUser = { ...userData };
    if (!newUser.id) newUser.id = Date.now();
    if (!newUser.status) newUser.status = 'Active';
    newUser.created_at = new Date().toISOString();

    users.push(newUser);
    // Commit to in-memory state BEFORE writing to Firebase
    this.data.users = users;
    console.info(`[addUser] Created user '${newUser.username}' (${newUser.role}). Total users: ${users.length}`);
    this.saveNode('users');
    return newUser;
  }

  updateUser(id, patch) {
    const user = this.getUser(id);
    if (user) {
      Object.assign(user, patch);
      user.updated_at = new Date().toISOString();
      // Ensure the in-memory array is clean before writing
      this.data.users = this.data.users.filter(u => u && typeof u === 'object' && u.username);
      console.info(`[updateUser] Updated user #${id} (${user.username}).`);
      this.saveNode('users');
    }
    return user;
  }

  deleteUser(id) {
    const numericId = Number(id);
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === numericId);
    if (idx >= 0) {
      const deleted = users.splice(idx, 1)[0];
      this.saveNode('users');
      return deleted;
    }
    return null;
  }

  // --- Customer-Specific Pricing Rules ---
  getCustomerPricingRules() {
    if (!this.data.customerPricingRules) {
      this.data.customerPricingRules = JSON.parse(JSON.stringify(initialSeedData.customerPricingRules || []));
      this.saveNode('customerPricingRules');
    }
    return this.data.customerPricingRules;
  }

  getCustomerPricingRule(id) {
    return this.getCustomerPricingRules().find(r => Number(r.id) === Number(id));
  }

  getCustomerPricingRuleByPhone(phone) {
    if (!phone) return null;
    const cleanPhone = String(phone).trim();
    return this.getCustomerPricingRules().find(r => r.contact === cleanPhone && r.status !== 'Suspended');
  }

  getCustomerPricingRuleByName(name) {
    if (!name) return null;
    const cleanName = String(name).trim().toLowerCase();
    return this.getCustomerPricingRules().find(r => r.customer_name && r.customer_name.toLowerCase() === cleanName && r.status !== 'Suspended');
  }

  saveCustomerPricingRule(rule) {
    const rules = this.getCustomerPricingRules();
    if (rule.id) {
      const idx = rules.findIndex(r => Number(r.id) === Number(rule.id));
      if (idx >= 0) {
        rules[idx] = { ...rules[idx], ...rule, updated_at: new Date().toISOString() };
      }
    } else {
      rule.id = Date.now();
      rule.created_at = new Date().toISOString();
      if (!rule.status) rule.status = 'Active';
      rules.push(rule);
    }
    this.saveNode('customerPricingRules');
    return rule;
  }

  deleteCustomerPricingRule(id) {
    const rules = this.getCustomerPricingRules();
    const idx = rules.findIndex(r => Number(r.id) === Number(id));
    if (idx >= 0) {
      const deleted = rules.splice(idx, 1)[0];
      this.saveNode('customerPricingRules');
      return deleted;
    }
    return null;
  }

  // --- Master Database Management ---
  getTableData(tableName) {
    if (tableName === 'pricingConfig') {
      return [{ id: 1, ...this.data.pricingConfig }];
    }
    if (!this.data[tableName]) {
      this.data[tableName] = [];
    }
    return this.data[tableName];
  }

  getMasterRecord(tableName, id) {
    const list = this.getTableData(tableName);
    return list.find(r => Number(r.id) === Number(id));
  }

  updateMasterRecord(tableName, id, updatedFields) {
    if (tableName === 'pricingConfig') {
      const cleanFields = { ...updatedFields };
      delete cleanFields.id;
      Object.assign(this.data.pricingConfig, cleanFields);
      this.saveNode('pricingConfig');
      return this.data.pricingConfig;
    }
    const list = this.getTableData(tableName);
    const item = list.find(r => Number(r.id) === Number(id));
    if (item) {
      Object.assign(item, updatedFields);
      this.saveNode(tableName);
    }
    return item;
  }

  deleteMasterRecord(tableName, id) {
    const list = this.getTableData(tableName);
    const numericId = Number(id);
    const index = list.findIndex(r => Number(r.id) === numericId);

    if (index >= 0) {
      const deleted = list.splice(index, 1)[0];

      // ERP Relational Cascading Deletes across all dependent collections
      if (tableName === 'salesVisits') {
        const deletedContact = deleted.contact;
        const deletedName = deleted.customer_name;

        // Clean linked opportunities, quotations, orders, delivery logs
        const linkedOpps = (this.data.opportunities || []).filter(o => 
          Number(o.visit_id) === numericId || 
          (deletedContact && o.contact === deletedContact) ||
          (deletedName && o.customer_name === deletedName)
        );

        linkedOpps.forEach(opp => {
          this.deleteMasterRecord('opportunities', opp.id);
        });

        this.data.opportunities = (this.data.opportunities || []).filter(o => 
          Number(o.visit_id) !== numericId && 
          (!deletedContact || o.contact !== deletedContact)
        );
        this.saveNode('opportunities');
      } else if (tableName === 'opportunities') {
        const linkedOrders = (this.data.orders || []).filter(ord => Number(ord.opportunity_id) === numericId);
        linkedOrders.forEach(ord => {
          this.deleteMasterRecord('orders', ord.id);
        });

        this.data.quotations = (this.data.quotations || []).filter(q => Number(q.opportunity_id) !== numericId);
        this.data.orders = (this.data.orders || []).filter(ord => Number(ord.opportunity_id) !== numericId);
        this.saveNode('quotations');
        this.saveNode('orders');
      } else if (tableName === 'orders') {
        this.data.deliveryLogs = (this.data.deliveryLogs || []).filter(log => Number(log.order_id) !== numericId);
        this.saveNode('deliveryLogs');
      }

      this.saveNode(tableName);
      return deleted;
    }
    return null;
  }

  clearMasterTable(tableName) {
    if (!this.data[tableName]) return;

    if (tableName === 'salesVisits') {
      this.data.salesVisits = [];
      this.data.opportunities = [];
      this.data.quotations = [];
      this.data.orders = [];
      this.data.deliveryLogs = [];
      this.saveNode('salesVisits');
      this.saveNode('opportunities');
      this.saveNode('quotations');
      this.saveNode('orders');
      this.saveNode('deliveryLogs');
    } else if (tableName === 'opportunities') {
      this.data.opportunities = [];
      this.data.quotations = [];
      this.data.orders = [];
      this.data.deliveryLogs = [];
      this.saveNode('opportunities');
      this.saveNode('quotations');
      this.saveNode('orders');
      this.saveNode('deliveryLogs');
    } else if (tableName === 'orders') {
      this.data.orders = [];
      this.data.deliveryLogs = [];
      this.saveNode('orders');
      this.saveNode('deliveryLogs');
    } else {
      this.data[tableName] = [];
      this.saveNode(tableName);
    }
  }

  addMasterRecord(tableName, recordData) {
    const list = this.getTableData(tableName);
    if (!recordData.id) {
      recordData.id = Date.now();
    }
    list.push(recordData);
    this.saveNode(tableName);
    return recordData;
  }

  // --- Activity Log ---
  getLogs() { return this.data.activityLog.slice().reverse(); }
  logActivity(action, user, details) {
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      action,
      user,
      details
    };
    this.data.activityLog.push(entry);
    this.saveNode('activityLog');
    return entry;
  }
}

try {
  window.db = new Database();
  // Global method aliases for maximum script-to-script resilience
  window.getGrades = (g) => window.db.getGrades(g);
  window.addGrade = (g) => window.db.addGrade(g);
  window.getVisits = () => window.db.getVisits();
  window.addVisit = (v) => window.db.addVisit(v);
  window.getUsers = () => window.db.getUsers();
  window.addUser = (u) => window.db.addUser(u);
  window.authenticateUser = (u, p) => window.db.authenticateUser(u, p);
} catch (e) {
  console.error("Database initialization exception caught:", e);
  try {
    window.db = new Database();
  } catch (err) {
    console.error("Database fallback initialization failed:", err);
  }
}
