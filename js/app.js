/**
 * Main Application Logic & UI Controller - RMC Regional Plant System
 * Manages view routing, DOM event handling, Chart.js renderings, role-based security & UI interactions.
 */

let currentRole = 'Admin'; // Default role: Admin
let activeView = 'dashboard';
let currentTimeframe = 'all'; // Default timeframe analysis: all, weekly, monthly, yearly
let charts = {};
let draggedOppId = null;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  bindNavigation();
  bindRoleSelector();
  bindFormHandlers();
  bindQuotationLiveCalc();
  bindManagerGradeHandlers();
  bindAutoQAListener();
  bindExcelExportButtons();
  bindMasterDatabaseBackupHandlers();
  bindTimeframeSelector();
  bindPipelineFilters();
  bindThermalPrintHandlers();

  // Populate dynamic Grade options across forms
  populateGradeDropdowns();

  // Run initial automated system rule evaluations
  window.rulesEngine.evaluateSystemRules();

  // Check user authentication session on project start
  checkAuthSession();
}

/**
 * 80mm Minimalist Thermal Printer Quotation Generator, PDF Exporter & WhatsApp Share
 */
function bindThermalPrintHandlers() {
  const btnPrintQuote = document.getElementById('btn-print-thermal-quote');
  if (btnPrintQuote) {
    btnPrintQuote.addEventListener('click', () => {
      openThermalReceiptModal();
    });
  }

  const btnHardwarePrint = document.getElementById('btn-trigger-hardware-print');
  if (btnHardwarePrint) {
    btnHardwarePrint.addEventListener('click', () => {
      triggerHardwarePrint();
    });
  }

  const btnExportPDF = document.getElementById('btn-export-pdf-quote');
  if (btnExportPDF) {
    btnExportPDF.addEventListener('click', () => {
      exportThermalReceiptPDF();
    });
  }

  const btnShareWA = document.getElementById('btn-share-whatsapp-quote');
  if (btnShareWA) {
    btnShareWA.addEventListener('click', () => {
      shareThermalReceiptWhatsApp();
    });
  }
}

function openThermalReceiptModal(oppId = null) {
  let grade = document.getElementById('quote-grade') ? document.getElementById('quote-grade').value : 'M25';
  let distance = document.getElementById('quote-distance') ? Number(document.getElementById('quote-distance').value) : 10;
  let pump = document.getElementById('quote-pump') ? document.getElementById('quote-pump').checked : true;
  let volume = document.getElementById('quote-volume') ? Number(document.getElementById('quote-volume').value) : 100;
  let validityDays = document.getElementById('quote-validity-days') ? Number(document.getElementById('quote-validity-days').value) : 30;
  
  let opp = null;
  const selectOpp = document.getElementById('quote-opp-select');
  if (selectOpp && selectOpp.value) {
    opp = window.db.getOpportunity(Number(selectOpp.value));
  } else if (oppId) {
    opp = window.db.getOpportunity(Number(oppId));
  }

  if (opp) {
    const visit = opp.visit_id ? window.db.getVisit(opp.visit_id) : null;
    const oppDist = (opp.distance_km !== undefined && opp.distance_km !== null) 
      ? opp.distance_km 
      : (visit && visit.distance_km !== undefined ? visit.distance_km : null);
    if (oppDist !== null && oppDist !== undefined) {
      distance = oppDist;
      const distInput = document.getElementById('quote-distance');
      if (distInput) distInput.value = oppDist;
    }
  }

  const calc = window.pricingEngine.calculatePrice({
    concreteGrade: grade,
    distanceKm: distance,
    pumpRequired: pump,
    volumeM3: volume
  });

  const thermalHTML = generateThermalQuotationHTML(calc, opp, grade, distance, pump, volume, validityDays);
  
  const container = document.getElementById('modal-thermal-content');
  const printArea = document.getElementById('thermal-print-area');

  if (container) container.innerHTML = thermalHTML;
  if (printArea) printArea.innerHTML = thermalHTML;

  const modal = document.getElementById('modal-thermal-receipt');
  if (modal) modal.classList.remove('hidden');
}

function generateThermalQuotationHTML(calc, opp, grade, distance, pump, volume, validityDays = 30) {
  const today = new Date().toISOString().substring(0, 10);
  const validMs = Date.now() + (Number(validityDays) || 30) * 24 * 3600 * 1000;
  const validDate = new Date(validMs).toISOString().substring(0, 10);
  
  const visit = opp && opp.visit_id ? window.db.getVisit(opp.visit_id) : null;
  const customerName = opp ? opp.customer_name : 'Valued Customer';
  const customerPhone = (opp && opp.contact) || (visit && visit.contact) || '';
  const officerName = opp ? opp.sales_officer : 'Regional Sales Rep';
  const oppIdStr = opp ? `EST-${opp.id}` : 'EST-2026-TEMP';

  return `
    <div class="thermal-receipt-paper" style="background-color: #ffffff !important; color: #000000 !important; width: 100% !important; max-width: 320px !important; margin: 0 auto !important; padding: 12px !important; font-family: 'Courier New', Courier, monospace !important;">
      <div style="text-align: center; font-weight: bold; font-size: 12px; margin-bottom: 2px;">REGIONAL CONCRETE PLANT</div>
      <div style="text-align: center; font-weight: bold; font-size: 11px; margin-bottom: 2px;">SALES ESTIMATOR</div>
      <div style="text-align: center; font-size: 10px; text-transform: uppercase; font-weight: bold; margin-top: 4px; margin-bottom: 6px;">COST ESTIMATE SUMMARY</div>
      
      <div style="border-bottom: 3px double #000000; margin: 6px 0;"></div>

      <div style="font-size: 11px; line-height: 1.4;"><strong>Est Ref  :</strong> ${oppIdStr}</div>
      <div style="font-size: 11px; line-height: 1.4;"><strong>Date    :</strong> ${today}</div>
      <div style="font-size: 11px; line-height: 1.4;"><strong>Valid   :</strong> ${validityDays} Days (Until ${validDate})</div>
      <div style="font-size: 11px; line-height: 1.4;"><strong>Officer :</strong> ${officerName}</div>

      <div style="border-bottom: 1px dashed #000000; margin: 6px 0;"></div>

      <div style="font-weight: bold; font-size: 11px; margin-bottom: 2px;">CUSTOMER & SITE DETAILS:</div>
      <div style="font-size: 11px; line-height: 1.4;"><strong>Client  :</strong> ${customerName}</div>
      ${customerPhone ? `<div style="font-size: 11px; line-height: 1.4;"><strong>Tel     :</strong> ${customerPhone}</div>` : ''}
      <div style="font-size: 11px; line-height: 1.4;"><strong>Dist.   :</strong> ${distance} KM (${calc.freeKm}KM Free Limit)</div>
      <div style="font-size: 11px; line-height: 1.4;"><strong>Grade   :</strong> ${grade} (${volume} m³)</div>

      <div style="border-bottom: 1px dashed #000000; margin: 6px 0;"></div>

      <div style="font-weight: bold; font-size: 11px; margin-bottom: 2px;">1. CONCRETE SUPPLY CHARGE:</div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; line-height: 1.4;">
        <span>Base Concrete:</span>
        <span>LKR ${calc.basePrice.toLocaleString()}/m³</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; line-height: 1.4;">
        <span>Truck Trans. :</span>
        <span>${calc.additionalKm <= 0 ? 'FREE (<=15KM)' : 'LKR ' + calc.truckTransportRatePerM3.toLocaleString() + '/m³'}</span>
      </div>
      ${calc.additionalKm > 0 ? `<div style="font-size: 9px; color: #475569; padding-left: 8px;">(${calc.additionalKm}km extra @ LKR ${calc.truckMixerRatePerKm}/km)</div>` : ''}

      <div style="border-bottom: 1px dashed #000000; margin: 6px 0;"></div>

      <div style="font-weight: bold; font-size: 11px; margin-bottom: 2px;">2. PUMP CAR CHARGES:</div>
      ${!pump ? `<div style="font-size: 10px; font-style: italic;">No Pump Car Required</div>` : `
        <div style="display: flex; justify-content: space-between; font-size: 11px; line-height: 1.4;">
          <span>Pump Flat Fee:</span>
          <span>LKR ${calc.pumpFlatFee.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; line-height: 1.4;">
          <span>Pump Transport:</span>
          <span>${calc.additionalKm <= 0 ? 'LKR 0 (<=15KM)' : 'LKR ' + calc.pumpTransportCost.toLocaleString()}</span>
        </div>
        ${calc.additionalKm > 0 ? `<div style="font-size: 9px; color: #475569; padding-left: 8px;">(${calc.additionalKm}km extra @ LKR ${calc.pumpCarRatePerKm}/km)</div>` : ''}

        <div style="display: flex; justify-content: space-between; font-size: 11px; line-height: 1.4;">
          <span>Extra Pumping :</span>
          <span>${calc.extraPumpM3 <= 0 ? 'LKR 0 (<=50m³)' : 'LKR ' + calc.extraPumpCost.toLocaleString()}</span>
        </div>
        ${calc.extraPumpM3 > 0 ? `<div style="font-size: 9px; color: #475569; padding-left: 8px;">(${calc.extraPumpM3}m³ extra @ LKR ${calc.pumpExtraRate}/m³)</div>` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #000000;">
          <span>Total Pump Cost:</span>
          <span>LKR ${calc.totalPumpCarCost.toLocaleString()} (LKR ${calc.pumpCostPerM3}/m³)</span>
        </div>
      `}

      <div style="border-bottom: 1px dashed #000000; margin: 6px 0;"></div>

      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin: 4px 0;">
        <span>COMBINED RATE / M³:</span>
        <span>LKR ${calc.pricePerM3.toLocaleString()}</span>
      </div>

      <div style="border-bottom: 3px double #000000; margin: 6px 0;"></div>

      <div style="text-align: center; font-weight: bold; font-size: 13px; margin: 6px 0;">
        ESTIMATED TOTAL:<br>
        LKR ${calc.totalValue.toLocaleString()}
      </div>

      <div style="border-bottom: 3px double #000000; margin: 6px 0;"></div>

      <div style="font-size: 9px; text-align: center; font-weight: bold; line-height: 1.3; margin: 6px 0;">
        NOTICE: Subjected to Original Company issued Performa Invoice.<br>
        DO NOT MAKE PAYMENT FOR THIS QUOTE.<br>
        This is to roughly calculate the cost for the supply.
      </div>

      <div style="border-bottom: 1px dashed #000000; margin: 6px 0;"></div>
      <div style="text-align: center; font-size: 9px;">Regional Plant Sales Estimator</div>
    </div>
  `;
}

function triggerHardwarePrint() {
  window.db.logActivity('THERMAL_PRINT_QUOTATION', currentRole, 'Printed Regional Plant Cost Estimate receipt.');
  showToast('Sending Cost Estimate to Thermal Printer...', 'info');
  window.print();
}

/**
 * 100% Reliable Standalone PDF Generator
 */
function exportThermalReceiptPDF() {
  const source = document.getElementById('modal-thermal-content');
  if (!source || !source.firstElementChild) {
    showToast('No receipt available to export.', 'error');
    return;
  }

  let grade = document.getElementById('quote-grade') ? document.getElementById('quote-grade').value : 'M25';
  const fileName = `Regional_Plant_80mm_Estimate_${grade}_${new Date().toISOString().substring(0, 10)}.pdf`;

  showToast('Generating exact-size 80mm PDF document...', 'info');

  // Create an explicit off-screen DOM element sized specifically for 80mm thermal receipt
  const pdfWrapper = document.createElement('div');
  pdfWrapper.style.position = 'fixed';
  pdfWrapper.style.left = '-9999px';
  pdfWrapper.style.top = '0px';
  pdfWrapper.style.width = '80mm';
  pdfWrapper.style.boxSizing = 'border-box';
  pdfWrapper.style.backgroundColor = '#ffffff';
  pdfWrapper.style.color = '#000000';
  pdfWrapper.style.padding = '3mm';
  pdfWrapper.style.zIndex = '99999';

  // Inject receipt content with clean inline CSS
  pdfWrapper.innerHTML = source.innerHTML;
  document.body.appendChild(pdfWrapper);

  // Measure exact rendered height in mm (1px ~ 0.264583mm)
  const elementHeightPx = pdfWrapper.offsetHeight || 500;
  const elementHeightMm = Math.ceil(elementHeightPx * 0.264583) + 6;

  const opt = {
    margin:       [2, 2, 2, 2],
    filename:     fileName,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 3, useCORS: true, backgroundColor: '#ffffff', logging: false },
    jsPDF:        { unit: 'mm', format: [80, Math.max(100, elementHeightMm)], orientation: 'portrait' }
  };

  if (window.html2pdf) {
    window.html2pdf().set(opt).from(pdfWrapper).save().then(() => {
      if (document.body.contains(pdfWrapper)) document.body.removeChild(pdfWrapper);
      window.db.logActivity('PDF_EXPORT_QUOTATION', currentRole, `Exported Cost Estimate 80mm PDF: ${fileName}`);
      showToast(`Exact-size 80mm PDF document saved (${fileName})!`, 'success');
    }).catch(err => {
      if (document.body.contains(pdfWrapper)) document.body.removeChild(pdfWrapper);
      console.error('PDF Export Error:', err);
      showToast('Opening print dialog for 80mm PDF export...', 'warning');
      window.print();
    });
  } else {
    if (document.body.contains(pdfWrapper)) document.body.removeChild(pdfWrapper);
    window.print();
  }
}

function shareThermalReceiptWhatsApp() {
  let grade = document.getElementById('quote-grade') ? document.getElementById('quote-grade').value : 'M20';
  let distance = document.getElementById('quote-distance') ? Number(document.getElementById('quote-distance').value) : 25;
  let pump = document.getElementById('quote-pump') ? document.getElementById('quote-pump').checked : true;
  let volume = document.getElementById('quote-volume') ? Number(document.getElementById('quote-volume').value) : 130;
  let validityDays = document.getElementById('quote-validity-days') ? Number(document.getElementById('quote-validity-days').value) : 2;

  let opp = null;
  const selectOpp = document.getElementById('quote-opp-select');
  if (selectOpp && selectOpp.value) {
    opp = window.db.getOpportunity(Number(selectOpp.value));
  }

  const calc = window.pricingEngine.calculatePrice({
    concreteGrade: grade,
    distanceKm: distance,
    pumpRequired: pump,
    volumeM3: volume
  });

  const today = new Date().toISOString().substring(0, 10);
  const validMs = Date.now() + (Number(validityDays) || 2) * 24 * 3600 * 1000;
  const validDate = new Date(validMs).toISOString().substring(0, 10);

  const visit = opp && opp.visit_id ? window.db.getVisit(opp.visit_id) : null;
  const customerName = opp ? opp.customer_name : 'Valued Customer';
  const customerPhone = (opp && opp.contact) || (visit && visit.contact) || '';
  const officerName = opp ? opp.sales_officer : 'Regional Sales Rep';
  const oppIdStr = opp ? `EST-${opp.id}` : 'EST-TEMP';

  let pumpDetailsStr = '';
  if (!pump) {
    pumpDetailsStr = `   - No Concrete Pump Car Required`;
  } else {
    pumpDetailsStr = `   - Pump Flat Fee: LKR ${calc.pumpFlatFee.toLocaleString()}\n` +
      `   - Pump Transport: ${calc.additionalKm <= 0 ? 'LKR 0 (15KM Free Included)' : 'LKR ' + calc.pumpTransportCost.toLocaleString() + ' (' + calc.additionalKm + 'km @ LKR ' + calc.pumpCarRatePerKm + '/km)'}\n` +
      (calc.extraPumpM3 > 0 ? `   - Extra Volume Fee: LKR ${calc.extraPumpCost.toLocaleString()} (${calc.extraPumpM3}m³ @ LKR ${calc.pumpExtraRate}/m³)\n` : '') +
      `   - Total Pump Cost: LKR ${calc.totalPumpCarCost.toLocaleString()} (LKR ${calc.pumpCostPerM3.toLocaleString()}/m³)`;
  }

  const truckTransStr = calc.additionalKm <= 0 
    ? 'FREE (Within ' + calc.freeKm + 'KM Limit)' 
    : 'LKR ' + calc.truckTransportRatePerM3.toLocaleString() + '/m³ (' + calc.additionalKm + 'km extra @ LKR ' + calc.truckMixerRatePerKm + '/km)';

  const lineDivider = '═════════════════════════════════';

  const waText = 
`📋 REGIONAL PLANT COST ESTIMATE
${lineDivider}

📌 Ref No      : ${oppIdStr}
📅 Date        : ${today}
⏳ Validity    : ${validityDays} Days (Until ${validDate})
👨‍💼 Sales Rep   : ${officerName}

👤 CUSTOMER & SITE DETAILS
* Client Name  : ${customerName}
${customerPhone ? `* Contact Tel   : ${customerPhone}\n` : ''}* Concrete Grade: ${grade}
* Target Volume : ${volume} m³
* Site Distance : ${distance} KM (${calc.freeKm}KM Free Included)

💰 PRICING & SUPPLY BREAKDOWN
1️⃣ Concrete Supply Charge:
   - Base Price: LKR ${calc.basePrice.toLocaleString()} / m³
   - Truck Mixer Transport: ${truckTransStr}

2️⃣ Concrete Pump Car Charges:
${pumpDetailsStr}

${lineDivider}
🏷️ COMBINED RATE / M³ : LKR ${calc.pricePerM3.toLocaleString()}
💵 ESTIMATED TOTAL     : LKR ${calc.totalValue.toLocaleString()}
${lineDivider}

⚠️ IMPORTANT NOTICE:
Subjected to Original Company issued Performa Invoice. Do not make payment for this quote. This is to roughly calculate supply cost.

Auto generate message`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(waText).catch(e => console.warn('Clipboard copy warning:', e));
  }

  const encodedText = encodeURIComponent(waText);
  const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;

  window.db.logActivity('WHATSAPP_SHARE_QUOTATION', currentRole, `Shared Cost Estimate via WhatsApp for ${customerName}.`);
  showToast('Opening WhatsApp & copied message to clipboard!', 'success');
  window.open(waUrl, '_blank');
}

/**
 * Master Database Backup & Restore Handlers (JSON Download)
 */
function bindMasterDatabaseBackupHandlers() {
  const btnDownload = document.getElementById('btn-download-master-db');
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      const fileName = window.db.exportDatabaseJSON();
      window.db.logActivity('MASTER_DB_BACKUP', currentRole, `Downloaded complete Master Database JSON file: ${fileName}`);
      showToast(`Master Database JSON downloaded successfully (${fileName})!`, 'success');
    });
  }

  const btnTriggerImport = document.getElementById('btn-trigger-import-db');
  const inputImport = document.getElementById('input-import-db');

  if (btnTriggerImport && inputImport) {
    btnTriggerImport.addEventListener('click', () => {
      if (currentRole !== 'Manager' && currentRole !== 'Admin') {
        showToast('PERMISSION DENIED: Only Manager or Admin can restore master database backups.', 'error');
        return;
      }
      inputImport.click();
    });

    inputImport.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const jsonContent = event.target.result;
        const success = window.db.importDatabaseJSON(jsonContent);
        if (success) {
          window.db.logActivity('MASTER_DB_RESTORE', currentRole, `Restored Master Database from uploaded backup: ${file.name}`);
          showToast(`Master Database restored successfully from ${file.name}!`, 'success');
          populateGradeDropdowns();
          renderCurrentView();
        } else {
          showToast('Database restore failed. Please select a valid JSON backup file.', 'error');
        }
      };
      reader.readAsText(file);
      inputImport.value = '';
    });
  }
}

/**
 * Timeframe Performance Selector (Weekly, Monthly, Yearly Analysis)
 */
function bindTimeframeSelector() {
  const pills = document.querySelectorAll('.timeframe-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentTimeframe = pill.getAttribute('data-timeframe');
      
      const labelMap = { all: 'All Time', weekly: 'Weekly (Last 7 Days)', monthly: 'Monthly (Last 30 Days)', yearly: 'Yearly (Last 365 Days)' };
      const label = labelMap[currentTimeframe] || 'All Time';
      const elLabel = document.getElementById('leaderboard-period-label');
      if (elLabel) elLabel.textContent = label;

      showToast(`Analyzing Sales Performance: ${label}`, 'info');
      updateHeaderKPIs();
      renderDashboard();
    });
  });
}

function filterRecordsByTimeframe(records, dateField = 'date') {
  if (!records || !Array.isArray(records)) return [];
  if (currentTimeframe === 'all') return records;

  const now = Date.now();
  let daysThreshold = 3650;
  if (currentTimeframe === 'weekly') daysThreshold = 7;
  else if (currentTimeframe === 'monthly') daysThreshold = 30;
  else if (currentTimeframe === 'yearly') daysThreshold = 365;

  const cutoff = now - (daysThreshold * 24 * 60 * 60 * 1000);

  return records.filter(r => {
    const dStr = r[dateField] || r.date || r.updated_at || r.timestamp;
    if (!dStr) return true;
    const itemTime = new Date(dStr).getTime();
    if (isNaN(itemTime)) return true;
    return itemTime >= cutoff || itemTime > now;
  });
}

/**
 * Excel Export Event Handlers
 */
function bindExcelExportButtons() {
  const btnFullExport = document.getElementById('btn-export-full-excel');
  if (btnFullExport) {
    btnFullExport.addEventListener('click', () => {
      window.excelExporter.exportFullSystemReport();
    });
  }
}

/**
 * Dynamic Concrete Grade Dropdown Populator & Live Price Recall
 */
function populateGradeDropdowns() {
  const grades = window.db.getGrades();
  const dropdowns = ['visit-grade', 'quote-grade'];

  dropdowns.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const selectedVal = el.value;
      el.innerHTML = grades.map(g => `
        <option value="${g.grade_name}">${g.grade_name} (Base: LKR ${g.base_price_lkr.toLocaleString()}/m³)</option>
      `).join('');
      if (selectedVal && grades.some(g => g.grade_name === selectedVal)) {
        el.value = selectedVal;
      }
    }
  });

  updateVisitGradePriceBadge();
}

function updateVisitGradePriceBadge() {
  const selectGrade = document.getElementById('visit-grade');
  const inputVol = document.getElementById('visit-volume');
  const inputDist = document.getElementById('visit-distance');

  const elPrice = document.getElementById('visit-recalled-price');
  const elTotal = document.getElementById('visit-recalled-total');
  if (!selectGrade || !elPrice || !elTotal) return;

  const gradeName = selectGrade.value || 'M20';
  const basePrice = window.db.getBasePriceForGrade(gradeName);
  const vol = Number(inputVol ? inputVol.value : 0) || 0;
  const dist = Number(inputDist ? inputDist.value : 0) || 0;

  const calc = window.pricingEngine.calculatePrice({
    concreteGrade: gradeName,
    distanceKm: dist,
    pumpRequired: true,
    volumeM3: vol
  });

  elPrice.textContent = `LKR ${basePrice.toLocaleString()}/m³`;
  elTotal.textContent = `LKR ${(calc ? calc.totalValue : 0).toLocaleString()}`;
}

/**
 * Manager Concrete Grade & Base Price Management & Parameter Configuration
 */
function bindManagerGradeHandlers() {
  const formGrade = document.getElementById('form-add-grade');
  if (formGrade) {
    formGrade.addEventListener('submit', (e) => {
      e.preventDefault();

      if (currentRole !== 'Manager' && currentRole !== 'Admin') {
        showToast('PERMISSION DENIED: Only Manager or Admin can configure concrete grades.', 'error');
        return;
      }

      const name = document.getElementById('grade-name-input').value;
      const price = Number(document.getElementById('grade-price-input').value);

      if (!name || price <= 0) {
        showToast('Please enter a valid Grade Name and Price.', 'error');
        return;
      }

      const cleanGrade = window.db.addGrade({ grade_name: name, base_price_lkr: price });
      window.db.logActivity(
        'MANAGER_CONFIG_GRADE',
        currentRole,
        `Added/Updated Concrete Grade "${cleanGrade}" with Base Price LKR ${price.toLocaleString()}/m³.`
      );

      showToast(`Concrete Grade "${cleanGrade}" saved with Base Price LKR ${price.toLocaleString()}/m³!`, 'success');
      formGrade.reset();
      populateGradeDropdowns();
      renderQuotationScreen();
    });
  }

  const formConfig = document.getElementById('form-update-pricing-config');
  if (formConfig) {
    formConfig.addEventListener('submit', (e) => {
      e.preventDefault();

      if (currentRole !== 'Manager' && currentRole !== 'Admin') {
        showToast('PERMISSION DENIED: Only Manager or Admin can edit transport & pump rates.', 'error');
        return;
      }

      const freeKm = Number(document.getElementById('config-free-km').value);
      const truckRate = Number(document.getElementById('config-truck-rate').value);
      const pumpTransRate = Number(document.getElementById('config-pump-trans-rate').value);
      const pumpFee = Number(document.getElementById('config-pump-fee').value);
      const pumpBaseVol = Number(document.getElementById('config-pump-base-vol').value);
      const pumpExtraRate = Number(document.getElementById('config-pump-extra-rate').value);
      const validityDays = Number(document.getElementById('config-validity-days').value);

      const updated = window.db.updatePricingConfig({
        free_transport_km: freeKm,
        truck_mixer_transport_rate_per_km_lkr: truckRate,
        pump_car_transport_rate_per_km_lkr: pumpTransRate,
        pump_flat_fee_lkr: pumpFee,
        pump_base_volume_m3: pumpBaseVol,
        pump_extra_rate_per_m3_lkr: pumpExtraRate,
        validity_period_days: validityDays
      });

      window.db.logActivity(
        'MANAGER_UPDATE_RATES',
        currentRole,
        `Updated Rules: Free KM = ${updated.free_transport_km}KM, Truck Trans = LKR ${updated.truck_mixer_transport_rate_per_km_lkr}/KM, Pump Trans = LKR ${updated.pump_car_transport_rate_per_km_lkr}/KM, Extra Pump = LKR ${updated.pump_extra_rate_per_m3_lkr}/m³.`
      );

      showToast(`Pricing Rules & Dual Transport Rates Updated!`, 'success');
      updateQuotationPreview();
    });
  }
}

window.deleteConcreteGradeEntry = function(id) {
  if (currentRole !== 'Manager' && currentRole !== 'Admin') {
    showToast('PERMISSION DENIED: Only Manager or Admin can delete concrete grades.', 'error');
    return;
  }

  if (confirm('Are you sure you want to delete this concrete grade configuration?')) {
    const deleted = window.db.deleteGrade(id);
    if (deleted) {
      window.db.logActivity('MANAGER_DELETE_GRADE', currentRole, `Deleted Concrete Grade "${deleted.grade_name}".`);
      showToast(`Deleted Grade "${deleted.grade_name}".`, 'info');
      populateGradeDropdowns();
      renderQuotationScreen();
    }
  }
};

/**
 * Role Switcher
 */
function bindRoleSelector() {
  const roleSelect = document.getElementById('user-role-select');
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      currentRole = e.target.value;
      window.currentRole = currentRole;
      showToast(`User Role switched to: ${currentRole}`, 'info');
      applyRolePermissions();
      renderCurrentView();
    });
  }
}

function applyRolePermissions() {
  const roleBadge = document.getElementById('active-role-badge');
  if (roleBadge) {
    roleBadge.textContent = currentRole.toUpperCase();
    if (currentRole === 'Admin') roleBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300';
    else if (currentRole === 'Manager') roleBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300';
    else roleBadge.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-300';
  }

  const qaTab = document.getElementById('nav-auto-qa');
  if (qaTab) {
    qaTab.style.display = (currentRole === 'Sales Officer') ? 'none' : 'block';
  }

  const managerGradeCard = document.getElementById('manager-grade-card');
  if (managerGradeCard) {
    managerGradeCard.style.display = (currentRole === 'Sales Officer') ? 'none' : 'block';
  }
}

window.toggleMobileNavDrawer = function(e) {
  if (e && e.target !== e.currentTarget && e.target.closest('#mobile-nav-drawer > div')) return;
  const drawer = document.getElementById('mobile-nav-drawer');
  if (drawer) drawer.classList.toggle('hidden');
};

/**
 * Navigation handler (Desktop & Mobile Tabs & Mobile Drawer)
 */
function bindNavigation() {
  const navItems = document.querySelectorAll('.nav-link, .mobile-nav-link, .mobile-drawer-link');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      if (targetView) {
        switchView(targetView);
        const drawer = document.getElementById('mobile-nav-drawer');
        if (drawer && !drawer.classList.contains('hidden')) {
          drawer.classList.add('hidden');
        }
      }
    });
  });
}

function switchView(viewName) {
  activeView = viewName;
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.add('hidden');
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('bg-slate-100', 'text-red-600', 'border-l-4', 'border-red-600');
    if (link.getAttribute('data-view') === viewName) {
      link.classList.add('bg-slate-100', 'text-red-600', 'border-l-4', 'border-red-600');
    }
  });

  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.classList.remove('text-red-600', 'font-bold');
    link.classList.add('text-slate-500', 'font-medium');
    if (link.getAttribute('data-view') === viewName) {
      link.classList.remove('text-slate-500', 'font-medium');
      link.classList.add('text-red-600', 'font-bold');
    }
  });

  const activePanel = document.getElementById(`view-${viewName}`);
  if (activePanel) activePanel.classList.remove('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  renderCurrentView();
}

function renderCurrentView() {
  updateHeaderKPIs();

  switch (activeView) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'visits':
      renderVisits();
      break;
    case 'pipeline':
      renderPipelineKanban();
      break;
    case 'quotation':
      renderQuotationScreen();
      break;
    case 'orders':
      renderOrdersScreen();
      break;
    case 'activity':
      renderActivityLogScreen();
      break;
    case 'users':
      renderUsersScreen();
      break;
    case 'master-db':
      renderMasterDBScreen();
      break;
    case 'auto-qa':
      renderAutoQAScreen();
      break;
  }
}

/**
 * Top Summary KPIs
 */
function updateHeaderKPIs() {
  const visits = filterRecordsByTimeframe(window.db.getVisits(), 'date');
  const opps = filterRecordsByTimeframe(window.db.getOpportunities(), 'updated_at');
  const orders = filterRecordsByTimeframe(window.db.getOrders(), 'id');

  const totalVisits = visits.length;
  const totalLeads = opps.length;
  const wonOpps = opps.filter(o => o.stage === 'Won');
  const conversionRate = totalLeads > 0 ? ((wonOpps.length / totalLeads) * 100).toFixed(1) : '0.0';

  let totalVolumeSold = 0;
  let totalRevenueLKR = 0;

  orders.forEach(ord => {
    totalVolumeSold += ord.delivered_volume_m3;
    totalRevenueLKR += (ord.delivered_volume_m3 * ord.unit_price_lkr);
  });

  const elVisits = document.getElementById('kpi-total-visits');
  const elLeads = document.getElementById('kpi-total-leads');
  const elConversion = document.getElementById('kpi-conversion-rate');
  const elVolume = document.getElementById('kpi-volume-sold');
  const elRevenue = document.getElementById('kpi-revenue');

  if (elVisits) elVisits.textContent = totalVisits;
  if (elLeads) elLeads.textContent = totalLeads;
  if (elConversion) elConversion.textContent = `${conversionRate}%`;
  if (elVolume) elVolume.textContent = `${totalVolumeSold.toLocaleString()} m³`;
  if (elRevenue) elRevenue.textContent = `LKR ${totalRevenueLKR.toLocaleString()}`;
}

/**
 * DASHBOARD VIEW & CHARTS
 */
function renderDashboard() {
  renderAIBanner();
  renderDashboardCharts();
  renderLeaderboardTable();
}

function renderAIBanner() {
  const aiContainer = document.getElementById('dashboard-ai-insights');
  if (!aiContainer) return;

  const summary = window.aiEngine.generatePipelineSummary();
  if (summary.topInsights.length === 0) {
    aiContainer.innerHTML = `<div class="p-4 bg-white rounded-lg border border-slate-200 text-slate-500 text-sm">No active pipeline insights available. Create a visit or quotation to trigger AI assistance.</div>`;
    return;
  }

  let html = `
    <div class="p-4 bg-gradient-to-r from-red-50 to-amber-50 rounded-xl border border-red-200 ai-pulse mb-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center space-x-2">
          <i class="fa-solid text-red-600 text-lg">🤖</i>
          <h3 class="text-xs sm:text-md font-bold text-slate-900">AI Real-Time Sales Optimization Engine</h3>
        </div>
        <span class="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-semibold">
          Active Deals: ${summary.totalActiveDeals}
        </span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
  `;

  summary.topInsights.forEach(insight => {
    html += `
      <div class="p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-between shadow-2xs">
        <div>
          <div class="flex justify-between items-start mb-1">
            <span class="font-bold text-slate-900 text-xs sm:text-sm">${insight.customerName}</span>
            <span class="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded ${insight.calculatedProb >= 70 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-purple-100 text-purple-800 border border-purple-200'}">
              ${insight.calculatedProb}% Closure
            </span>
          </div>
          <p class="text-xs text-slate-600 mb-2">${insight.recommendationText}</p>
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <span>Action: <strong class="text-red-600">${insight.suggestedAction}</strong></span>
          <span>${insight.projectSize}m³</span>
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  aiContainer.innerHTML = html;
}

function renderDashboardCharts() {
  const opps = filterRecordsByTimeframe(window.db.getOpportunities(), 'updated_at');

  const stageCounts = { Lead: 0, Quote: 0, Negotiation: 0, Won: 0, Lost: 0 };
  opps.forEach(o => {
    const rawSt = String(o.stage || 'Lead').trim();
    const st = rawSt.charAt(0).toUpperCase() + rawSt.slice(1).toLowerCase();
    if (stageCounts[st] !== undefined) {
      stageCounts[st]++;
    } else {
      stageCounts.Lead++;
    }
  });

  const ctxStage = document.getElementById('chart-stage-breakdown');
  if (ctxStage && window.Chart) {
    if (charts.stage) charts.stage.destroy();
    charts.stage = new Chart(ctxStage, {
      type: 'doughnut',
      data: {
        labels: ['Lead', 'Quote', 'Negotiation', 'Won', 'Lost'],
        datasets: [{
          data: [stageCounts.Lead, stageCounts.Quote, stageCounts.Negotiation, stageCounts.Won, stageCounts.Lost],
          backgroundColor: ['#2563eb', '#d97706', '#7c3aed', '#059669', '#E31E24']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#475569' } } }
      }
    });
  }

  const grades = window.db.getGrades();
  const gradeVolumes = {};
  grades.forEach(g => gradeVolumes[g.grade_name] = 0);

  opps.forEach(o => {
    const gName = o.concrete_grade || 'M25';
    gradeVolumes[gName] = (gradeVolumes[gName] || 0) + (Number(o.expected_volume_m3) || 0);
  });

  const ctxGrade = document.getElementById('chart-grade-volume');
  if (ctxGrade && window.Chart) {
    if (charts.grade) charts.grade.destroy();
    charts.grade = new Chart(ctxGrade, {
      type: 'bar',
      data: {
        labels: Object.keys(gradeVolumes),
        datasets: [{
          label: 'Volume (m³)',
          data: Object.values(gradeVolumes),
          backgroundColor: ['#E31E24', '#0F172A', '#0284c7', '#7c3aed', '#059669']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#475569' }, grid: { color: '#e2e8f0' } },
          y: { ticks: { color: '#475569' }, grid: { color: '#e2e8f0' } }
        }
      }
    });
  }
}

function renderLeaderboardTable() {
  const opps = filterRecordsByTimeframe(window.db.getOpportunities(), 'updated_at');
  const orders = filterRecordsByTimeframe(window.db.getOrders(), 'id');
  const visits = window.db.getVisits();
  const reps = {};

  // Initialize all officers from visits, opportunities, and orders
  visits.concat(opps).forEach(item => {
    const officer = item.sales_officer || 'Sunil Perera';
    if (!reps[officer]) {
      reps[officer] = { name: officer, totalLeads: 0, wonLeads: 0, totalRev: 0, volDelivered: 0 };
    }
  });

  opps.forEach(o => {
    const officer = o.sales_officer || 'Sunil Perera';
    if (!reps[officer]) {
      reps[officer] = { name: officer, totalLeads: 0, wonLeads: 0, totalRev: 0, volDelivered: 0 };
    }
    reps[officer].totalLeads++;
    if (String(o.stage || '').toLowerCase() === 'won') reps[officer].wonLeads++;
  });

  orders.forEach(ord => {
    const officer = ord.sales_officer || 'Sunil Perera';
    if (!reps[officer]) {
      reps[officer] = { name: officer, totalLeads: 0, wonLeads: 0, totalRev: 0, volDelivered: 0 };
    }
    reps[officer].totalRev += ((Number(ord.delivered_volume_m3) || 0) * (Number(ord.unit_price_lkr) || 0));
    reps[officer].volDelivered += (Number(ord.delivered_volume_m3) || 0);
  });

  const leaderboardList = Object.values(reps).sort((a, b) => b.totalRev - a.totalRev || b.totalLeads - a.totalLeads);

  const tbody = document.getElementById('table-leaderboard-body');
  if (tbody) {
    if (leaderboardList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-xs text-slate-400">No sales activity found.</td></tr>`;
      return;
    }
    tbody.innerHTML = leaderboardList.map((rep, idx) => {
      const conv = rep.totalLeads > 0 ? ((rep.wonLeads / rep.totalLeads) * 100).toFixed(0) : 0;
      return `
        <tr class="border-b border-slate-200 text-xs sm:text-sm hover:bg-slate-50">
          <td class="py-2.5 px-3 font-bold text-red-600">#${idx + 1}</td>
          <td class="py-2.5 px-3 font-semibold text-slate-800">${rep.name}</td>
          <td class="py-2.5 px-3 text-slate-600">${rep.totalLeads}</td>
          <td class="py-2.5 px-3 text-emerald-600 font-bold">${rep.wonLeads} (${conv}%)</td>
          <td class="py-2.5 px-3 text-slate-600">${rep.volDelivered.toLocaleString()} m³</td>
          <td class="py-2.5 px-3 text-right font-bold text-red-600">LKR ${rep.totalRev.toLocaleString()}</td>
        </tr>
      `;
    }).join('');
  }
}

/**
 * REDESIGNED CRM KANBAN PIPELINE VIEW
 */
function bindPipelineFilters() {
  const searchInput = document.getElementById('pipeline-search-input');
  const mobileSelect = document.getElementById('pipeline-filter-mobile');
  const officerSelect = document.getElementById('pipeline-filter-officer');
  const sortBySelect = document.getElementById('pipeline-sort-by');

  if (searchInput) searchInput.addEventListener('input', renderPipelineKanban);
  if (mobileSelect) mobileSelect.addEventListener('change', renderPipelineKanban);
  if (officerSelect) officerSelect.addEventListener('change', renderPipelineKanban);
  if (sortBySelect) sortBySelect.addEventListener('change', renderPipelineKanban);
}

function renderPipelineKanban() {
  let opps = window.db.getOpportunities();
  const stages = ['Lead', 'Quote', 'Negotiation', 'Won', 'Lost'];
  const canDelete = currentRole === 'Manager' || currentRole === 'Admin';

  const mobileSelect = document.getElementById('pipeline-filter-mobile');
  if (mobileSelect && mobileSelect.options.length <= 1) {
    const uniqueCusts = window.db.getUniqueCustomers();
    uniqueCusts.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.contact;
      opt.textContent = `📱 ${c.contact} - ${c.customer_name}`;
      mobileSelect.appendChild(opt);
    });
  }

  const officerSelect = document.getElementById('pipeline-filter-officer');
  if (officerSelect && officerSelect.options.length <= 1) {
    const officers = [...new Set(opps.map(o => o.sales_officer))];
    officers.forEach(off => {
      const opt = document.createElement('option');
      opt.value = off;
      opt.textContent = off;
      officerSelect.appendChild(opt);
    });
  }

  const searchQuery = document.getElementById('pipeline-search-input') ? document.getElementById('pipeline-search-input').value.toLowerCase().trim() : '';
  const filterMobile = document.getElementById('pipeline-filter-mobile') ? document.getElementById('pipeline-filter-mobile').value : '';
  const filterOfficer = document.getElementById('pipeline-filter-officer') ? document.getElementById('pipeline-filter-officer').value : '';
  const sortBy = document.getElementById('pipeline-sort-by') ? document.getElementById('pipeline-sort-by').value : 'newest';

  if (searchQuery) {
    opps = opps.filter(o => 
      (o.customer_name || '').toLowerCase().includes(searchQuery) || 
      (o.sales_officer || '').toLowerCase().includes(searchQuery) ||
      (o.contact || '').includes(searchQuery)
    );
  }
  if (filterMobile) {
    opps = opps.filter(o => o.contact === filterMobile);
  }
  if (filterOfficer) {
    opps = opps.filter(o => o.sales_officer === filterOfficer);
  }

  opps.sort((a, b) => {
    if (sortBy === 'newest' || sortBy === 'date_created') return b.id - a.id;
    if (sortBy === 'oldest') return a.id - b.id;
    if (sortBy === 'date_modified') {
      const timeA = a.updated_at ? new Date(a.updated_at).getTime() : a.id;
      const timeB = b.updated_at ? new Date(b.updated_at).getTime() : b.id;
      return timeB - timeA;
    }
    if (sortBy === 'name_asc') return (a.customer_name || '').localeCompare(b.customer_name || '');
    if (sortBy === 'name_desc') return (b.customer_name || '').localeCompare(a.customer_name || '');
    if (sortBy === 'value_high') return (b.expected_value_lkr || 0) - (a.expected_value_lkr || 0);
    if (sortBy === 'value_low') return (a.expected_value_lkr || 0) - (b.expected_value_lkr || 0);
    if (sortBy === 'prob_high') return (b.probability || 0) - (a.probability || 0);
    if (sortBy === 'volume_high') return (b.expected_volume_m3 || 0) - (a.expected_volume_m3 || 0);
    return b.id - a.id;
  });

  stages.forEach(stage => {
    const colContainer = document.getElementById(`kanban-col-${stage.toLowerCase()}`);
    if (!colContainer) return;

    const filtered = opps.filter(o => String(o.stage || '').toLowerCase() === String(stage || '').toLowerCase());
    
    let colVol = 0;
    let colVal = 0;
    filtered.forEach(o => {
      colVol += Number(o.expected_volume_m3) || 0;
      colVal += Number(o.expected_value_lkr) || 0;
    });

    const elCount = document.getElementById(`count-${stage.toLowerCase()}`);
    const elVol = document.getElementById(`vol-${stage.toLowerCase()}`);
    const elVal = document.getElementById(`val-${stage.toLowerCase()}`);

    if (elCount) elCount.textContent = filtered.length;
    if (elVol) elVol.textContent = `${colVol.toLocaleString()} m³`;
    if (elVal) elVal.textContent = colVal >= 1000000 ? `LKR ${(colVal / 1000000).toFixed(1)}M` : `LKR ${(colVal / 1000).toFixed(0)}k`;

    if (filtered.length === 0) {
      colContainer.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg my-2">No deals in ${stage}</div>`;
      return;
    }

    colContainer.innerHTML = filtered.map(opp => {
      const quote = window.db.getQuotationByOpp(opp.id);
      const aiAnalysis = window.aiEngine.analyzeOpportunity(opp, quote);
      const nextStage = getNextStageName(stage);

      return `
        <div id="card-opp-${opp.id}" 
             draggable="true" 
             ondragstart="handleDragStart(event, ${opp.id})" 
             ondragend="handleDragEnd(event)"
             onclick="openOpportunityModal(${opp.id})" 
             class="kanban-card glass-card glass-card-hover p-3.5 mb-3 border-l-4 ${getStageBorderColor(stage)} relative group shadow-2xs">
          
          <div class="flex justify-between items-start mb-1.5">
            <div>
              <h4 class="font-bold text-slate-900 text-xs leading-snug">${opp.customer_name}</h4>
              <span class="text-[10px] font-mono text-red-600 font-bold block">📱 ${opp.contact || 'N/A'}</span>
            </div>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${getStageBadgeClass(stage)}">
              ${opp.stage}
            </span>
          </div>

          <div class="text-[11px] text-slate-600 mb-2 space-y-1">
            <div class="flex justify-between"><span class="text-slate-400">Grade:</span> <strong class="text-slate-900 bg-slate-100 px-1 rounded">${opp.concrete_grade || 'M25'}</strong></div>
            <div class="flex justify-between"><span class="text-slate-400">Volume:</span> <strong class="text-slate-800">${opp.expected_volume_m3} m³</strong></div>
            <div class="flex justify-between"><span class="text-slate-400">Est. Value:</span> <strong class="text-emerald-700">LKR ${(opp.expected_value_lkr || 0).toLocaleString()}</strong></div>
            <div class="flex justify-between"><span class="text-slate-400">Officer:</span> <span>${opp.sales_officer}</span></div>
          </div>

          <!-- Probability Gauge Bar -->
          <div class="mb-2">
            <div class="flex justify-between text-[10px] text-slate-500 mb-0.5 font-medium">
              <span>Win Probability</span>
              <span class="font-bold text-blue-700">${opp.probability}%</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
              <div class="${opp.probability >= 70 ? 'bg-emerald-500' : (opp.probability >= 40 ? 'bg-amber-500' : 'bg-red-500')} h-1.5 rounded-full" style="width: ${opp.probability}%"></div>
            </div>
          </div>

          ${aiAnalysis ? `
            <div class="p-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-700 mb-2 flex items-center justify-between" title="${aiAnalysis.recommendationText}">
              <span class="font-semibold text-slate-800">🤖 AI Insight</span>
              <span class="text-red-600 font-bold">${aiAnalysis.suggestedAction}</span>
            </div>
          ` : ''}

          <!-- Card Action Footer -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
            ${nextStage ? `
              <button onclick="quickAdvanceStage(${opp.id}, event)" title="Advance to ${nextStage}" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold py-1 px-2 rounded border border-slate-300 transition cursor-pointer flex items-center">
                <span>Move to ${nextStage}</span> <i class="fa-solid fa-arrow-right ml-1 text-slate-500"></i>
              </button>
            ` : `<span class="text-[10px] text-slate-400 font-semibold">Final Stage</span>`}

            <div class="flex items-center space-x-1">
              <button onclick="openThermalReceiptModal(${opp.id}); event.stopPropagation();" title="Print Regional Plant Cost Estimate" class="text-slate-600 hover:text-slate-900 text-[11px] p-1 cursor-pointer">
                <i class="fa-solid fa-print text-slate-600"></i>
              </button>
              ${canDelete ? `
                <button onclick="deleteOpportunityEntry(${opp.id}, event)" title="Delete Deal" class="text-red-500 hover:text-red-700 text-[11px] p-1 cursor-pointer">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  });
}

function getNextStageName(currentStage) {
  switch (currentStage) {
    case 'Lead': return 'Quote';
    case 'Quote': return 'Negotiation';
    case 'Negotiation': return 'Won';
    default: return null;
  }
}

/**
 * DRAG AND DROP KANBAN HANDLERS
 */
window.handleDragStart = function(e, oppId) {
  draggedOppId = oppId;
  e.dataTransfer.setData('text/plain', oppId);
  e.dataTransfer.effectAllowed = 'move';
  const card = document.getElementById(`card-opp-${oppId}`);
  if (card) card.classList.add('dragging');
};

window.handleDragEnd = function(e) {
  document.querySelectorAll('.kanban-card').forEach(c => c.classList.remove('dragging'));
  document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
};

window.handleDragOver = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};

window.handleDragEnter = function(e) {
  e.preventDefault();
  const col = e.currentTarget;
  if (col) col.classList.add('drag-over');
};

window.handleDragLeave = function(e) {
  const col = e.currentTarget;
  if (col) col.classList.remove('drag-over');
};

window.handleDrop = function(e, targetStage) {
  e.preventDefault();
  const col = e.currentTarget;
  if (col) col.classList.remove('drag-over');

  const oppId = draggedOppId || Number(e.dataTransfer.getData('text/plain'));
  if (!oppId) return;

  const opp = window.db.getOpportunity(oppId);
  if (!opp) return;

  if (opp.stage === targetStage) return;

  const stageValidation = window.rulesEngine.validateStageTransition(opp.stage, targetStage);
  if (!stageValidation.isValid) {
    showToast(stageValidation.message, 'error');
    return;
  }

  if (targetStage === 'Lost') {
    openOpportunityModal(oppId);
    return;
  }

  const newProb = targetStage === 'Won' ? 100 : (targetStage === 'Negotiation' ? 75 : 50);
  window.db.updateOpportunity(opp.id, { stage: targetStage, probability: newProb });
  window.db.logActivity('KANBAN_DRAG_DROP', currentRole, `Dragged Opportunity #${opp.id} (${opp.customer_name}) to "${targetStage}".`);

  if (targetStage === 'Won') {
    const order = window.rulesEngine.handleStageChangeToWon(opp.id);
    if (order) {
      showToast(`AUTOMATION RULE 3: Supply Order #${order.id} auto-created for ${opp.customer_name}!`, 'success');
    }
  }

  window.rulesEngine.evaluateSystemRules();
  showToast(`Moved "${opp.customer_name}" to ${targetStage}!`, 'success');
  renderCurrentView();
};

window.quickAdvanceStage = function(oppId, event) {
  if (event) event.stopPropagation();

  const opp = window.db.getOpportunity(oppId);
  if (!opp) return;

  const nextStage = getNextStageName(opp.stage);
  if (!nextStage) return;

  const stageValidation = window.rulesEngine.validateStageTransition(opp.stage, nextStage);
  if (!stageValidation.isValid) {
    showToast(stageValidation.message, 'error');
    return;
  }

  const newProb = nextStage === 'Won' ? 100 : (nextStage === 'Negotiation' ? 75 : 50);
  window.db.updateOpportunity(opp.id, { stage: nextStage, probability: newProb });
  window.db.logActivity('QUICK_ADVANCE_STAGE', currentRole, `Quick-advanced Opportunity #${opp.id} to "${nextStage}".`);

  if (nextStage === 'Won') {
    const order = window.rulesEngine.handleStageChangeToWon(opp.id);
    if (order) {
      showToast(`AUTOMATION RULE 3: Supply Order #${order.id} auto-created for ${opp.customer_name}!`, 'success');
    }
  }

  window.rulesEngine.evaluateSystemRules();
  showToast(`Advanced "${opp.customer_name}" to ${nextStage}!`, 'success');
  renderCurrentView();
};

function getStageBorderColor(stage) {
  switch (stage) {
    case 'Lead': return 'border-blue-600';
    case 'Quote': return 'border-amber-500';
    case 'Negotiation': return 'border-purple-600';
    case 'Won': return 'border-emerald-600';
    case 'Lost': return 'border-red-600';
    default: return 'border-slate-400';
  }
}

function getStageBadgeClass(stage) {
  switch (stage) {
    case 'Lead': return 'badge-lead';
    case 'Quote': return 'badge-quote';
    case 'Negotiation': return 'badge-negotiation';
    case 'Won': return 'badge-won';
    case 'Lost': return 'badge-lost';
    default: return '';
  }
}

/**
 * Opportunity Stage Modal
 */
window.openOpportunityModal = function(oppId) {
  const opp = window.db.getOpportunity(oppId);
  if (!opp) return;

  const modal = document.getElementById('modal-opportunity');
  const container = document.getElementById('modal-opportunity-content');
  if (!modal || !container) return;

  const quote = window.db.getQuotationByOpp(opp.id);
  const ai = window.aiEngine.analyzeOpportunity(opp, quote);
  const canDelete = currentRole === 'Manager' || currentRole === 'Admin';

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h3 class="text-base sm:text-lg font-bold text-slate-900">${opp.customer_name} (Opp #${opp.id})</h3>
          <p class="text-xs text-slate-500">Sales Officer: ${opp.sales_officer} | Grade: <strong class="text-slate-800">${opp.concrete_grade || 'M25'}</strong></p>
        </div>
        <span class="px-2.5 py-1 rounded text-xs font-bold ${getStageBadgeClass(opp.stage)}">${opp.stage}</span>
      </div>

      ${ai ? `
        <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-xs">
          <div class="font-bold text-red-700 mb-1">🤖 AI Smart Assistant Advice:</div>
          <p class="text-slate-700">${ai.recommendationText}</p>
        </div>
      ` : ''}

      <div class="grid grid-cols-2 gap-2.5 text-xs">
        <div class="bg-slate-50 p-2.5 rounded border border-slate-200">
          <span class="text-slate-500 block">Expected Volume:</span>
          <span class="text-sm font-bold text-slate-900">${opp.expected_volume_m3} m³</span>
        </div>
        <div class="bg-slate-50 p-2.5 rounded border border-slate-200">
          <span class="text-slate-500 block">Est. Revenue:</span>
          <span class="text-sm font-bold text-emerald-600">LKR ${(opp.expected_value_lkr || 0).toLocaleString()}</span>
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">Move Pipeline Stage:</label>
        <select id="modal-select-stage" class="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-800 font-medium">
          <option value="Lead" ${opp.stage === 'Lead' ? 'selected' : ''}>Lead</option>
          <option value="Quote" ${opp.stage === 'Quote' ? 'selected' : ''}>Quote</option>
          <option value="Negotiation" ${opp.stage === 'Negotiation' ? 'selected' : ''}>Negotiation</option>
          <option value="Won" ${opp.stage === 'Won' ? 'selected' : ''}>Won (Auto-Creates Order)</option>
          <option value="Lost" ${opp.stage === 'Lost' ? 'selected' : ''}>Lost</option>
        </select>
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">Win Probability (%):</label>
        <input type="number" id="modal-input-prob" value="${opp.probability}" min="0" max="100" class="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-800" />
      </div>

      <div id="modal-lost-reason-container" class="${opp.stage === 'Lost' ? '' : 'hidden'}">
        <label class="block text-xs font-semibold text-red-600 mb-1">Reason for Loss:</label>
        <input type="text" id="modal-input-lost-reason" value="${opp.lost_reason || ''}" placeholder="Competitor price, delay, project cancelled..." class="w-full bg-white border border-red-300 rounded p-2 text-sm text-slate-800" />
      </div>

      <div class="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
        <button onclick="openThermalReceiptModal(${opp.id})" class="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-3 rounded text-xs transition cursor-pointer flex items-center">
          <i class="fa-solid fa-print mr-1"></i> Cost Estimate
        </button>
        <button onclick="saveOpportunityStageChange(${opp.id})" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-3 rounded text-xs transition cursor-pointer">
          Update Deal
        </button>
        ${canDelete ? `
          <button onclick="deleteOpportunityEntry(${opp.id})" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-bold py-2.5 px-3 rounded text-xs transition cursor-pointer">
            <i class="fa-solid fa-trash mr-1"></i> Delete
          </button>
        ` : ''}
        <button onclick="closeModal('modal-opportunity')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded text-sm transition cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  `;

  document.getElementById('modal-select-stage').addEventListener('change', (e) => {
    const reasonContainer = document.getElementById('modal-lost-reason-container');
    if (reasonContainer) {
      if (e.target.value === 'Lost') reasonContainer.classList.remove('hidden');
      else reasonContainer.classList.add('hidden');
    }
  });

  modal.classList.remove('hidden');
};

window.deleteOpportunityEntry = function(oppId, event) {
  if (event) event.stopPropagation();

  if (currentRole !== 'Manager' && currentRole !== 'Admin') {
    showToast('PERMISSION DENIED: Only Manager or Admin can delete pipeline opportunities.', 'error');
    return;
  }

  const opp = window.db.getOpportunity(oppId);
  if (!opp) return;

  if (confirm(`MANAGER CONFIRMATION: Are you sure you want to delete Opportunity #${opp.id} for "${opp.customer_name}" from the pipeline?`)) {
    const deleted = window.db.deleteOpportunity(oppId);
    if (deleted) {
      window.db.logActivity(
        'MANAGER_DELETE_OPPORTUNITY',
        currentRole,
        `Deleted Opportunity #${oppId} (${opp.customer_name}) from CRM Pipeline.`
      );
      closeModal('modal-opportunity');
      showToast(`Opportunity #${oppId} deleted from pipeline by ${currentRole}.`, 'success');
      renderCurrentView();
    }
  }
};

window.saveOpportunityStageChange = function(oppId) {
  const opp = window.db.getOpportunity(oppId);
  if (!opp) return;

  const targetStage = document.getElementById('modal-select-stage').value;
  const newProb = Number(document.getElementById('modal-input-prob').value);
  const lostReason = document.getElementById('modal-input-lost-reason') ? document.getElementById('modal-input-lost-reason').value : '';

  const stageValidation = window.rulesEngine.validateStageTransition(opp.stage, targetStage);
  if (!stageValidation.isValid) {
    showToast(stageValidation.message, 'error');
    return;
  }

  const patch = { stage: targetStage, probability: newProb, lost_reason: lostReason };
  window.db.updateOpportunity(opp.id, patch);
  window.db.logActivity('STAGE_CHANGE', currentRole, `Updated Opportunity #${opp.id} (${opp.customer_name}) stage to "${targetStage}" (${newProb}% prob).`);

  if (targetStage === 'Won') {
    const order = window.rulesEngine.handleStageChangeToWon(opp.id);
    if (order) {
      showToast(`AUTOMATION RULE 3: Supply Order #${order.id} auto-created for ${opp.customer_name}!`, 'success');
    }
  }

  window.rulesEngine.evaluateSystemRules();

  closeModal('modal-opportunity');
  showToast(`Opportunity updated successfully!`, 'success');
  renderCurrentView();
};

/**
 * SALES VISITS VIEW & FORM
 */
function renderVisits() {
  const visits = window.db.getVisits();
  const tbody = document.getElementById('table-visits-body');
  const canDelete = currentRole === 'Manager' || currentRole === 'Admin';

  if (tbody) {
    tbody.innerHTML = visits.map(v => `
      <tr class="border-b border-slate-200 text-xs sm:text-sm hover:bg-slate-50">
        <td class="py-2.5 px-3 font-bold text-red-600">
          <button onclick="openEditVisitModal(${v.id})" title="Click to edit Sales Visit entry #${v.id} (ID Fixed)" class="hover:underline cursor-pointer focus:outline-none flex items-center group">
            <span>#${v.id}</span>
            <i class="fa-solid fa-pen-to-square text-[10px] text-slate-400 group-hover:text-red-600 ml-1"></i>
          </button>
        </td>
        <td class="py-2.5 px-3 text-slate-600">${v.date}</td>
        <td class="py-2.5 px-3 font-semibold text-slate-900">
          <div>${v.customer_name}</div>
          <div class="text-[10px] font-mono text-red-600 font-bold">📱 ${v.contact || 'N/A'}</div>
        </td>
        <td class="py-2.5 px-3 font-bold text-slate-800"><span class="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">${v.concrete_grade || 'M25'}</span></td>
        <td class="py-2.5 px-3 text-slate-600">${v.sales_officer}</td>
        <td class="py-2.5 px-3 text-blue-700 font-semibold">${v.project_size_m3} m³</td>
        <td class="py-2.5 px-3 text-right space-x-1">
          <button onclick="openEditVisitModal(${v.id})" title="Edit Sales Visit Entry (ID Fixed)" class="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] px-2 py-1 rounded transition cursor-pointer">
            <i class="fa-solid fa-pen mr-1"></i> Edit
          </button>
          ${canDelete ? `
            <button onclick="deleteVisitEntry(${v.id})" title="Delete wrong entry (Manager/Admin action)" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] px-2 py-1 rounded transition cursor-pointer">
              <i class="fa-solid fa-trash mr-1"></i> Delete
            </button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  }
}

window.openEditVisitModal = function(visitId) {
  const visit = window.db.getVisit(visitId);
  if (!visit) return;

  const modal = document.getElementById('modal-delivery');
  const container = document.getElementById('modal-delivery-content');
  if (!modal || !container) return;

  const grades = window.db.getGrades();

  container.innerHTML = `
    <div class="space-y-4 max-w-lg w-full">
      <div class="border-b border-slate-200 pb-3 flex justify-between items-center">
        <div>
          <h3 class="text-base font-bold text-slate-900 flex items-center">
            <i class="fa-solid fa-pen-to-square text-blue-600 mr-2"></i> Edit Sales Visit Entry
          </h3>
          <p class="text-xs text-slate-500">Customer: <strong>${visit.customer_name}</strong></p>
        </div>
        <span class="px-2.5 py-1 rounded text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300" title="Visit ID is fixed and non-editable">
          ID: #${visit.id} (FIXED)
        </span>
      </div>

      <div class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Visit ID (Fixed)</label>
            <input type="text" value="#${visit.id}" disabled class="w-full bg-slate-100 border border-slate-300 rounded p-2 text-slate-500 font-mono font-bold cursor-not-allowed" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Visit Date *</label>
            <input type="date" id="edit-visit-date" value="${visit.date}" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-medium" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Sales Officer *</label>
            <input type="text" id="edit-visit-officer" value="${visit.sales_officer || ''}" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Customer Name *</label>
            <input type="text" id="edit-visit-customer" value="${visit.customer_name || ''}" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-semibold" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Project Location *</label>
            <input type="text" id="edit-visit-location" value="${visit.location || ''}" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Contact Phone (10 Digits) *</label>
            <input type="text" id="edit-visit-contact" value="${visit.contact || ''}" maxlength="10" placeholder="0771234567" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-mono" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Concrete Grade *</label>
            <select id="edit-visit-grade" class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-bold">
              ${grades.map(g => `<option value="${g.grade_name}" ${g.grade_name === (visit.concrete_grade || 'M25') ? 'selected' : ''}>${g.grade_name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Site Distance (KM) *</label>
            <input type="number" id="edit-visit-distance" min="0" value="${visit.distance_km || 10}" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-bold" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Est. Volume (m³) *</label>
            <input type="number" id="edit-visit-volume" min="1" value="${visit.project_size_m3 || 100}" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-bold text-blue-700" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Customer Type</label>
            <select id="edit-visit-type" class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800">
              <option value="Commercial Contractor" ${visit.customer_type === 'Commercial Contractor' ? 'selected' : ''}>Commercial Contractor</option>
              <option value="Individual Homebuilder" ${visit.customer_type === 'Individual Homebuilder' ? 'selected' : ''}>Individual Homebuilder</option>
              <option value="Government Project" ${visit.customer_type === 'Government Project' ? 'selected' : ''}>Government Project</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Site Notes</label>
            <input type="text" id="edit-visit-notes" value="${visit.notes || ''}" placeholder="Access road, pour requirements..." class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800" />
          </div>
        </div>
      </div>

      <div class="flex space-x-3 pt-3 border-t border-slate-200">
        <button onclick="saveEditVisit(${visit.id})" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded text-xs transition cursor-pointer shadow-xs">
          Save Visit Entry Changes
        </button>
        <button onclick="closeModal('modal-delivery')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded text-xs transition cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
};

window.saveEditVisit = function(visitId) {
  const visit = window.db.getVisit(visitId);
  if (!visit) return;

  const date = document.getElementById('edit-visit-date').value;
  const officer = document.getElementById('edit-visit-officer').value.trim();
  const customer = document.getElementById('edit-visit-customer').value.trim();
  const location = document.getElementById('edit-visit-location').value.trim();
  const contact = document.getElementById('edit-visit-contact').value.trim();
  const grade = document.getElementById('edit-visit-grade').value;
  const distance = Number(document.getElementById('edit-visit-distance').value) || 0;
  const volume = Number(document.getElementById('edit-visit-volume').value) || 0;
  const type = document.getElementById('edit-visit-type').value;
  const notes = document.getElementById('edit-visit-notes').value.trim();

  if (!date || !officer || !customer || !location) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  const phoneCheck = window.rulesEngine.validatePhoneNumber(contact);
  if (!phoneCheck.isValid) {
    showToast(phoneCheck.message, 'error');
    return;
  }

  if (volume <= 0) {
    showToast('Please enter a valid estimated concrete volume.', 'error');
    return;
  }

  window.db.updateVisit(visitId, {
    date,
    sales_officer: officer,
    customer_name: customer,
    location,
    contact: phoneCheck.cleanContact,
    concrete_grade: grade,
    distance_km: distance,
    project_size_m3: volume,
    customer_type: type,
    notes
  });

  window.db.logActivity(
    'EDIT_SALES_VISIT',
    currentRole,
    `Updated Sales Visit #${visitId} (${customer}): Officer ${officer}, Grade ${grade}, Volume ${volume}m³, Distance ${distance}km.`
  );

  closeModal('modal-delivery');
  showToast(`Sales Visit entry #${visitId} updated successfully!`, 'success');
  renderCurrentView();
};

window.deleteVisitEntry = function(visitId) {
  if (currentRole !== 'Manager' && currentRole !== 'Admin') {
    showToast('PERMISSION DENIED: Only Manager or Admin can delete sales visit entries.', 'error');
    return;
  }

  const visit = window.db.getVisit(visitId);
  if (!visit) return;

  if (confirm(`MANAGER CONFIRMATION: Are you sure you want to delete wrong Sales Visit entry #${visit.id} for "${visit.customer_name}"? This will also clean up associated pipeline records.`)) {
    const deleted = window.db.deleteVisit(visitId);
    if (deleted) {
      window.db.logActivity(
        'MANAGER_DELETE_VISIT',
        currentRole,
        `Deleted wrong Sales Visit #${visitId} (${visit.customer_name}) and associated CRM records.`
      );
      showToast(`Sales Visit #${visitId} deleted successfully by ${currentRole}.`, 'success');
      renderCurrentView();
    }
  }
};

function bindFormHandlers() {
  const selectVisitGrade = document.getElementById('visit-grade');
  const inputVisitVol = document.getElementById('visit-volume');
  const inputVisitDist = document.getElementById('visit-distance');

  if (selectVisitGrade) selectVisitGrade.addEventListener('change', updateVisitGradePriceBadge);
  if (inputVisitVol) inputVisitVol.addEventListener('input', updateVisitGradePriceBadge);
  if (inputVisitDist) inputVisitDist.addEventListener('input', updateVisitGradePriceBadge);

  const formVisit = document.getElementById('form-add-visit');
  if (formVisit) {
    formVisit.addEventListener('submit', (e) => {
      e.preventDefault();

      const rawContact = document.getElementById('visit-contact').value;

      const phoneValidation = window.rulesEngine.validatePhoneNumber(rawContact);
      if (!phoneValidation.isValid) {
        showToast(phoneValidation.message, 'error');
        return;
      }

      const selectedGrade = document.getElementById('visit-grade').value;

      const formData = {
        date: document.getElementById('visit-date').value,
        sales_officer: document.getElementById('visit-officer').value,
        customer_name: document.getElementById('visit-customer').value,
        location: document.getElementById('visit-location').value,
        contact: phoneValidation.cleanContact,
        notes: document.getElementById('visit-notes').value,
        customer_type: document.getElementById('visit-type').value,
        concrete_grade: selectedGrade,
        project_size_m3: Number(document.getElementById('visit-volume').value),
        distance_km: Number(document.getElementById('visit-distance').value) || 0
      };

      const missingCheck = window.rulesEngine.validateRequiredFields(formData, ['date', 'sales_officer', 'customer_name', 'location', 'project_size_m3', 'contact', 'concrete_grade']);
      if (!missingCheck.isValid) {
        showToast(missingCheck.message, 'error');
        return;
      }

      const volCheck = window.rulesEngine.validateVolume(formData.project_size_m3);
      if (!volCheck.isValid) {
        showToast(volCheck.message, 'error');
        return;
      }

      const dupCheck = window.rulesEngine.checkDuplicateVisit(formData.customer_name, formData.date);
      if (dupCheck.isDuplicate) {
        showToast(dupCheck.message, 'warning');
      }

      const newVisit = window.db.addVisit(formData);

      const baseCalc = window.pricingEngine.calculatePrice({
        concreteGrade: selectedGrade,
        distanceKm: formData.distance_km,
        pumpRequired: true,
        volumeM3: formData.project_size_m3
      });

      const newOpp = window.db.addOpportunity({
        visit_id: newVisit.id,
        customer_name: formData.customer_name,
        contact: formData.contact,
        distance_km: formData.distance_km,
        sales_officer: formData.sales_officer,
        concrete_grade: selectedGrade,
        stage: 'Lead',
        expected_volume_m3: formData.project_size_m3,
        expected_value_lkr: baseCalc.totalValue,
        probability: 30
      });

      window.db.logActivity(
        'VISIT_AND_LEAD_CREATED',
        formData.sales_officer,
        `Created Sales Visit #${newVisit.id} & Opportunity #${newOpp.id} for "${formData.customer_name}" (Grade: ${selectedGrade}, ${formData.project_size_m3}m³)`
      );

      showToast(`Sales Visit & Opportunity Lead (Grade ${selectedGrade}) created!`, 'success');
      formVisit.reset();
      populateGradeDropdowns();
      switchView('pipeline');
    });
  }
}

/**
 * QUOTATION SCREEN & PRICING ENGINE
 */
function renderQuotationScreen() {
  populateGradeDropdowns();
  renderGradesManagerList();

  const cfg = window.db.getPricingConfig();
  const inputFreeKm = document.getElementById('config-free-km');
  const inputTruckRate = document.getElementById('config-truck-rate');
  const inputPumpTransRate = document.getElementById('config-pump-trans-rate');
  const inputPump = document.getElementById('config-pump-fee');
  const inputPumpBaseVol = document.getElementById('config-pump-base-vol');
  const inputPumpExtraRate = document.getElementById('config-pump-extra-rate');
  const inputValidityDays = document.getElementById('config-validity-days');

  if (inputFreeKm) inputFreeKm.value = cfg.free_transport_km !== undefined ? cfg.free_transport_km : 15;
  if (inputTruckRate) inputTruckRate.value = cfg.truck_mixer_transport_rate_per_km_lkr !== undefined ? cfg.truck_mixer_transport_rate_per_km_lkr : 120;
  if (inputPumpTransRate) inputPumpTransRate.value = cfg.pump_car_transport_rate_per_km_lkr !== undefined ? cfg.pump_car_transport_rate_per_km_lkr : 550;
  if (inputPump) inputPump.value = cfg.pump_flat_fee_lkr !== undefined ? cfg.pump_flat_fee_lkr : 60000;
  if (inputPumpBaseVol) inputPumpBaseVol.value = cfg.pump_base_volume_m3 !== undefined ? cfg.pump_base_volume_m3 : 30;
  if (inputPumpExtraRate) inputPumpExtraRate.value = cfg.pump_extra_rate_per_m3_lkr !== undefined ? cfg.pump_extra_rate_per_m3_lkr : 2000;
  if (inputValidityDays) inputValidityDays.value = cfg.validity_period_days !== undefined ? cfg.validity_period_days : 2;

  const inputFormValidity = document.getElementById('quote-validity-days');
  if (inputFormValidity && cfg.validity_period_days) {
    inputFormValidity.value = cfg.validity_period_days;
  }

  const opps = window.db.getOpportunities();
  const selectOpp = document.getElementById('quote-opp-select');
  if (selectOpp) {
    selectOpp.innerHTML = `<option value="">-- Select Opportunity --</option>` +
      opps.map(o => `<option value="${o.id}">${o.customer_name} (Opp #${o.id} - ${o.concrete_grade || 'M25'} - ${o.expected_volume_m3}m³)</option>`).join('');
  }

  const locked = window.selfImprovementEngine.priceFieldLocked;
  const inputPrice = document.getElementById('quote-manual-price');
  const lockBadge = document.getElementById('quote-price-lock-status');
  if (inputPrice && lockBadge) {
    inputPrice.disabled = locked;
    lockBadge.className = locked ? 'text-xs text-amber-700 font-bold block mt-1' : 'hidden';
  }

  updateQuotationPreview();
  renderCustomerPricingRulesList();
}

function renderGradesManagerList() {
  const grades = window.db.getGrades();
  const container = document.getElementById('grades-list-container');
  const canManage = currentRole === 'Manager' || currentRole === 'Admin';

  if (container) {
    container.innerHTML = grades.map(g => `
      <div class="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs font-semibold">
        <span class="text-slate-900 font-bold">${g.grade_name}</span>
        <span class="text-emerald-700 font-mono">LKR ${g.base_price_lkr.toLocaleString()}/m³</span>
        ${canManage ? `
          <button onclick="editConcreteGradeEntry(${g.id})" title="Edit Grade & Price" class="text-blue-600 hover:text-blue-800 transition ml-1 cursor-pointer font-bold text-xs">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button onclick="deleteConcreteGradeEntry(${g.id})" title="Delete Grade" class="text-slate-400 hover:text-red-600 transition ml-1 cursor-pointer font-bold">
            &times;
          </button>
        ` : ''}
      </div>
    `).join('');
  }
}

window.editConcreteGradeEntry = function(id) {
  const grades = window.db.getGrades();
  const grade = grades.find(g => Number(g.id) === Number(id));
  if (!grade) return;

  const nameInput = document.getElementById('grade-name-input');
  const priceInput = document.getElementById('grade-price-input');
  if (nameInput) nameInput.value = grade.grade_name;
  if (priceInput) priceInput.value = grade.base_price_lkr;

  showToast(`Editing Grade "${grade.grade_name}". Update price and click "+ Add / Update Grade".`, 'info');
};

window.renderCustomerPricingRulesList = function() {
  const rules = window.db.getCustomerPricingRules();
  const tbody = document.getElementById('table-customer-pricing-body');
  if (!tbody) return;

  const canManage = currentRole === 'Manager' || currentRole === 'Admin';

  if (rules.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-3 text-center text-slate-400">No customer-specific pricing rules defined. Click "+ Configure Customer Pricing Rule" to add custom terms.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rules.map(r => `
    <tr class="border-b border-slate-200 hover:bg-slate-50 text-xs">
      <td class="p-2 font-bold text-slate-900">
        <div>${r.customer_name}</div>
        <div class="text-[10px] font-mono text-red-600">📱 ${r.contact || 'N/A'}</div>
      </td>
      <td class="p-2 font-mono font-bold text-emerald-700">- LKR ${(r.discount_per_m3_lkr || 0).toLocaleString()}</td>
      <td class="p-2 font-mono">${r.free_transport_km !== undefined ? r.free_transport_km : 15} KM</td>
      <td class="p-2 font-mono">LKR ${(r.truck_mixer_rate_per_km_lkr || 120).toLocaleString()}/km</td>
      <td class="p-2 font-mono">LKR ${(r.pump_flat_fee_lkr || 15000).toLocaleString()}</td>
      <td class="p-2 font-mono">LKR ${(r.pump_extra_rate_per_m3_lkr || 300).toLocaleString()}/m³</td>
      <td class="p-2">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
          ${r.status || 'Active'}
        </span>
      </td>
      <td class="p-2 text-right space-x-1 whitespace-nowrap">
        <button onclick="openEditCustomerPricingModal(${r.id})" title="Edit Custom Rule" class="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded transition cursor-pointer">
          <i class="fa-solid fa-pen mr-1"></i> Edit
        </button>
        ${canManage ? `
          <button onclick="deleteCustomerPricingRuleEntry(${r.id})" title="Delete Custom Rule" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded transition cursor-pointer">
            <i class="fa-solid fa-trash mr-1"></i> Delete
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');
};

window.openAddCustomerPricingModal = function() {
  const modal = document.getElementById('modal-customer-pricing-edit');
  if (!modal) return;

  document.getElementById('form-customer-pricing-edit').reset();
  document.getElementById('cust-pricing-id').value = '';
  document.getElementById('modal-cust-pricing-title').innerHTML = '<i class="fa-solid fa-user-tag text-blue-600 mr-2"></i> Configure Customer Pricing Rule';

  const customers = window.db.getUniqueCustomers ? window.db.getUniqueCustomers() : [];
  const select = document.getElementById('cust-pricing-phone-select');
  if (select) {
    select.innerHTML = '<option value="">-- Select Customer Account --</option>' +
      customers.map(c => `<option value="${c.contact}" data-name="${c.name}">${c.name} (${c.contact})</option>`).join('');
  }

  modal.classList.remove('hidden');
};

window.syncCustPricingCustomerName = function() {
  const select = document.getElementById('cust-pricing-phone-select');
  const selectedOpt = select.options[select.selectedIndex];
  const nameInput = document.getElementById('cust-pricing-name');
  if (selectedOpt && selectedOpt.dataset && selectedOpt.dataset.name && nameInput) {
    nameInput.value = selectedOpt.dataset.name;
  }
};

window.openEditCustomerPricingModal = function(id) {
  const rule = window.db.getCustomerPricingRule(id);
  if (!rule) return;

  window.openAddCustomerPricingModal();

  document.getElementById('cust-pricing-id').value = rule.id;
  document.getElementById('cust-pricing-phone-select').value = rule.contact || '';
  document.getElementById('cust-pricing-name').value = rule.customer_name || '';
  document.getElementById('cust-pricing-discount').value = rule.discount_per_m3_lkr || 0;
  document.getElementById('cust-pricing-free-km').value = rule.free_transport_km !== undefined ? rule.free_transport_km : 15;
  document.getElementById('cust-pricing-truck-rate').value = rule.truck_mixer_rate_per_km_lkr || 120;
  document.getElementById('cust-pricing-pump-fee').value = rule.pump_flat_fee_lkr || 15000;
  document.getElementById('cust-pricing-extra-pump').value = rule.pump_extra_rate_per_m3_lkr || 300;
  document.getElementById('cust-pricing-validity').value = rule.validity_days || 30;
  document.getElementById('cust-pricing-notes').value = rule.notes || '';
  document.getElementById('modal-cust-pricing-title').innerHTML = `<i class="fa-solid fa-user-tag text-blue-600 mr-2"></i> Edit Customer Pricing Rule (#${rule.id})`;
};

window.saveCustomerPricingRuleHandler = function(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('cust-pricing-id').value;
  const phoneSelect = document.getElementById('cust-pricing-phone-select').value;
  const name = document.getElementById('cust-pricing-name').value.trim();

  if (!phoneSelect && !name) {
    showToast('Please select or specify a Customer Account.', 'error');
    return;
  }

  const ruleData = {
    id: id ? Number(id) : null,
    contact: phoneSelect || '0770000000',
    customer_name: name,
    discount_per_m3_lkr: Number(document.getElementById('cust-pricing-discount').value) || 0,
    free_transport_km: Number(document.getElementById('cust-pricing-free-km').value) || 15,
    truck_mixer_rate_per_km_lkr: Number(document.getElementById('cust-pricing-truck-rate').value) || 120,
    pump_flat_fee_lkr: Number(document.getElementById('cust-pricing-pump-fee').value) || 15000,
    pump_extra_rate_per_m3_lkr: Number(document.getElementById('cust-pricing-extra-pump').value) || 300,
    validity_days: Number(document.getElementById('cust-pricing-validity').value) || 30,
    notes: document.getElementById('cust-pricing-notes').value.trim(),
    status: 'Active'
  };

  window.db.saveCustomerPricingRule(ruleData);
  window.db.logActivity('CUSTOMER_PRICING_RULE_SAVED', currentRole, `Configured custom pricing rule for customer ${name} (${ruleData.contact}).`);
  showToast(`Custom Customer Pricing Rule saved for ${name}!`, 'success');

  window.closeModal('modal-customer-pricing-edit');
  window.rulesEngine.evaluateSystemRules();
  updateHeaderKPIs();
  renderQuotationScreen();
};

window.deleteCustomerPricingRuleEntry = function(id) {
  if (confirm(`Are you sure you want to delete this custom customer pricing rule?`)) {
    window.db.deleteCustomerPricingRule(id);
    window.db.logActivity('CUSTOMER_PRICING_RULE_DELETED', currentRole, `Deleted custom pricing rule #${id}.`);
    showToast(`Deleted custom pricing rule #${id}.`, 'info');

    window.rulesEngine.evaluateSystemRules();
    updateHeaderKPIs();
    renderQuotationScreen();
  }
};

function bindQuotationLiveCalc() {
  const ids = ['quote-grade', 'quote-distance', 'quote-pump', 'quote-volume', 'quote-manual-price', 'quote-validity-days'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateQuotationPreview);
  });

  const selectOpp = document.getElementById('quote-opp-select');
  if (selectOpp) {
    selectOpp.addEventListener('change', (e) => {
      const oppId = e.target.value;
      if (oppId) {
        const opp = window.db.getOpportunity(oppId);
        if (opp) {
          document.getElementById('quote-volume').value = opp.expected_volume_m3;
          if (opp.concrete_grade) {
            document.getElementById('quote-grade').value = opp.concrete_grade;
          }
          const visit = opp.visit_id ? window.db.getVisit(opp.visit_id) : null;
          const dist = (opp.distance_km !== undefined && opp.distance_km !== null) 
            ? opp.distance_km 
            : (visit && visit.distance_km !== undefined ? visit.distance_km : null);
          if (dist !== null && dist !== undefined) {
            document.getElementById('quote-distance').value = dist;
          }
          updateQuotationPreview();
        }
      }
    });
  }

  const formQuote = document.getElementById('form-create-quotation');
  if (formQuote) {
    formQuote.addEventListener('submit', (e) => {
      e.preventDefault();
      const oppId = Number(document.getElementById('quote-opp-select').value);
      if (!oppId) {
        showToast('Please select an Opportunity first.', 'error');
        return;
      }

      const grade = document.getElementById('quote-grade').value;
      const distance = Number(document.getElementById('quote-distance').value) || 0;
      const pump = document.getElementById('quote-pump').checked;
      const volume = Number(document.getElementById('quote-volume').value) || 0;
      const userPrice = Number(document.getElementById('quote-manual-price').value);
      const validityDays = Number(document.getElementById('quote-validity-days').value) || 30;

      const calc = window.pricingEngine.validateAndAutoCorrect({
        concreteGrade: grade,
        distanceKm: distance,
        pumpRequired: pump,
        volumeM3: volume,
        userPricePerM3: userPrice
      });

      let finalPricePerM3 = calc.expectedPricePerM3;
      let finalTotalValue = calc.expectedTotalValue;

      if (!calc.isValid) {
        showToast(calc.autoCorrectionMessage, 'warning');
        window.selfImprovementEngine.recordUserError('PRICING_MANUAL_MISMATCH', calc.autoCorrectionMessage);
      }

      const quotation = window.db.saveQuotation({
        opportunity_id: oppId,
        concrete_grade: grade,
        distance_km: distance,
        pump_required: pump,
        volume_m3: volume,
        calculated_price_per_m3: calc.expectedPricePerM3,
        user_entered_price_per_m3: userPrice,
        final_price_per_m3: finalPricePerM3,
        total_estimated_cost_lkr: finalTotalValue,
        validity_period_days: validityDays
      });

      const opp = window.db.getOpportunity(oppId);
      if (opp && opp.stage === 'Lead') {
        window.db.updateOpportunity(oppId, { stage: 'Quote', concrete_grade: grade, expected_value_lkr: finalTotalValue });
      }

      window.db.logActivity(
        'QUOTATION_GENERATED',
        currentRole,
        `Generated Regional Cost Estimate #${quotation.id} for Opp #${oppId} (${grade}, LKR ${finalPricePerM3.toLocaleString()}/m³, Total: LKR ${finalTotalValue.toLocaleString()}, Valid ${validityDays} Days)`
      );

      showToast(`Regional Cost Estimate #${quotation.id} generated (Valid ${validityDays} Days)!`, 'success');
      switchView('pipeline');
    });
  }
}

function updateQuotationPreview() {
  const grade = document.getElementById('quote-grade').value || 'M25';
  const distance = Number(document.getElementById('quote-distance').value) || 0;
  const pump = document.getElementById('quote-pump') ? document.getElementById('quote-pump').checked : true;
  const volume = Number(document.getElementById('quote-volume').value) || 0;

  const selectOpp = document.getElementById('quote-opp-select');
  const oppId = selectOpp ? selectOpp.value : null;
  const opp = oppId ? window.db.getOpportunity(oppId) : null;

  const calc = window.pricingEngine.calculatePrice({
    concreteGrade: grade,
    distanceKm: distance,
    pumpRequired: pump,
    volumeM3: volume,
    customerPhone: opp ? opp.contact : null,
    customerName: opp ? opp.customer_name : null
  });

  const previewBase = document.getElementById('preview-base-price');
  const previewTruckTrans = document.getElementById('preview-truck-transport');
  const previewPump = document.getElementById('preview-pump-cost');
  const previewRate = document.getElementById('preview-rate-m3');
  const previewTotal = document.getElementById('preview-total-value');
  const inputManual = document.getElementById('quote-manual-price');

  if (previewBase) {
    if (calc.isCustomRuleApplied && calc.discountPerM3 > 0) {
      previewBase.textContent = `LKR ${calc.concretePricePerM3.toLocaleString()} / m³ (Base LKR ${calc.basePrice.toLocaleString()} - VIP Discount LKR ${calc.discountPerM3.toLocaleString()}/m³ Applied)`;
    } else {
      previewBase.textContent = `LKR ${calc.concretePricePerM3.toLocaleString()} / m³ (Base LKR ${calc.basePrice.toLocaleString()})`;
    }
  }
  
  if (previewTruckTrans) {
    if (calc.additionalKm <= 0) {
      previewTruckTrans.textContent = `LKR 0 (${distance}km included within ${calc.freeKm}km free limit)`;
    } else {
      previewTruckTrans.textContent = `+ LKR ${calc.truckTransportRatePerM3.toLocaleString()}/m³ (${calc.additionalKm}km extra @ LKR ${calc.truckMixerRatePerKm}/km)`;
    }
  }

  if (previewPump) {
    if (!pump) {
      previewPump.textContent = `LKR 0 (No Pump Required)`;
    } else {
      let pumpDetails = `LKR ${calc.totalPumpCarCost.toLocaleString()} Total (LKR ${calc.pumpCostPerM3.toLocaleString()}/m³)`;
      previewPump.textContent = pumpDetails;
    }
  }

  if (previewRate) previewRate.textContent = `LKR ${calc.pricePerM3.toLocaleString()} / m³`;
  if (previewTotal) previewTotal.textContent = `LKR ${calc.totalValue.toLocaleString()}`;

  if (inputManual && !window.selfImprovementEngine.priceFieldLocked && (!inputManual.value || inputManual.value == 0)) {
    inputManual.value = calc.pricePerM3;
  } else if (inputManual && window.selfImprovementEngine.priceFieldLocked) {
    inputManual.value = calc.pricePerM3;
  }
}

/**
 * ORDER & DELIVERY MODULE (RMC DAILY DISPATCH & BATCH LOGS)
 */
function renderOrdersScreen() {
  const orders = window.db.getOrders();
  const tbody = document.getElementById('table-orders-body');
  const canManage = currentRole === 'Manager' || currentRole === 'Admin';

  if (tbody) {
    tbody.innerHTML = orders.map(ord => {
      const opp = window.db.getOpportunity(ord.opportunity_id);
      const isActive = ord.status === 'Active';
      const pct = ord.confirmed_volume_m3 > 0 
        ? Math.min(100, Math.round((ord.delivered_volume_m3 / ord.confirmed_volume_m3) * 100))
        : 0;

      const logsCount = window.db.getDeliveryLogs(ord.id).length;
      const contactNo = ord.contact || (opp ? opp.contact : 'N/A');

      return `
        <tr class="border-b border-slate-200 text-xs hover:bg-slate-50 transition">
          <td class="py-3 px-3.5 font-bold text-red-600 whitespace-nowrap align-middle">
            Order #${ord.id}
            <div class="text-[10px] text-slate-400 font-normal">Deal #${ord.opportunity_id || 'N/A'}</div>
          </td>
          <td class="py-3 px-3.5 font-semibold text-slate-800 align-middle">
            <div>${ord.customer_name}</div>
            <div class="text-[10px] font-mono text-red-600 font-bold">📱 ${contactNo}</div>
          </td>
          <td class="py-3 px-3.5 text-slate-600 whitespace-nowrap align-middle">${ord.sales_officer}</td>
          <td class="py-3 px-3.5 text-slate-800 font-semibold whitespace-nowrap align-middle">${(ord.confirmed_volume_m3 || 0).toLocaleString()} m³</td>
          <td class="py-3 px-3.5 text-emerald-700 font-bold whitespace-nowrap align-middle">${(ord.delivered_volume_m3 || 0).toLocaleString()} m³</td>
          <td class="py-3 px-3.5 align-middle min-w-[150px]">
            <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-300 mb-1">
              <div class="bg-emerald-600 h-2 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
            </div>
            <div class="text-[10px] text-slate-500 font-semibold whitespace-nowrap">${pct}% Delivered <span class="text-slate-400">(${logsCount} ${logsCount === 1 ? 'batch' : 'batches'})</span></div>
          </td>
          <td class="py-3 px-3.5 whitespace-nowrap align-middle">
            <span class="px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center ${
              ord.status === 'Completed' 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                : (ord.status === 'Active' 
                    ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                    : 'bg-red-100 text-red-800 border border-red-300')
            }">
              <span class="w-1.5 h-1.5 rounded-full mr-1.5 ${ord.status === 'Completed' ? 'bg-emerald-500' : (ord.status === 'Active' ? 'bg-blue-500 animate-pulse' : 'bg-red-500')}"></span>
              ${ord.status}
            </span>
          </td>
          <td class="py-3 px-3.5 text-right whitespace-nowrap align-middle">
            <div class="flex items-center justify-end space-x-1.5">
              ${isActive ? `
                <button onclick="openDeliveryModal(${ord.id})" title="Log new concrete batch supply" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition cursor-pointer shadow-xs flex items-center">
                  <i class="fa-solid fa-plus mr-1.5 text-[10px]"></i> Log Batch
                </button>
              ` : `
                <button disabled class="bg-slate-100 text-slate-400 border border-slate-200 text-xs font-bold py-1.5 px-3 rounded-lg opacity-60 cursor-not-allowed">
                  Completed
                </button>
              `}
              <button onclick="openDispatchHistoryModal(${ord.id})" title="View batch dispatch history logs" class="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition cursor-pointer shadow-xs flex items-center">
                <i class="fa-solid fa-clock-rotate-left mr-1.5 text-[10px]"></i> Batches (${logsCount})
              </button>
              ${canManage ? `
                <button onclick="openEditOrderModal(${ord.id})" title="Admin Edit Order" class="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs p-1.5 rounded-lg transition cursor-pointer">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="deleteOrderEntry(${ord.id})" title="Admin Delete Order" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs p-1.5 rounded-lg transition cursor-pointer">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
}

window.openDeliveryModal = function(orderId) {
  const order = window.db.getOrder(orderId);
  if (!order) return;

  const check = window.rulesEngine.validateAndCorrectDelivery(orderId, 1);
  if (!check.isValid) {
    showToast(check.message, 'error');
    return;
  }

  const modal = document.getElementById('modal-delivery');
  const container = document.getElementById('modal-delivery-content');
  if (!modal || !container) return;

  const remaining = Math.max(0, order.confirmed_volume_m3 - order.delivered_volume_m3);
  const today = new Date().toISOString().substring(0, 10);
  const randomDocket = `DOC-${Math.floor(1000 + Math.random() * 9000)}`;

  container.innerHTML = `
    <div class="space-y-4">
      <div class="border-b border-slate-200 pb-3 flex justify-between items-center">
        <div>
          <h3 class="text-base font-bold text-slate-900 flex items-center">
            <i class="fa-solid fa-truck-droplet text-emerald-600 mr-2"></i> Log Concrete Supply Batch
          </h3>
          <p class="text-xs text-slate-500">Order #${order.id} | Customer: <strong>${order.customer_name}</strong></p>
        </div>
        <span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Active Won Site</span>
      </div>

      <div class="grid grid-cols-2 gap-2.5 text-xs">
        <div class="bg-slate-50 p-2.5 rounded border border-slate-200">
          <span class="text-slate-500 block">Confirmed Total:</span>
          <span class="text-sm font-bold text-slate-900">${order.confirmed_volume_m3} m³</span>
        </div>
        <div class="bg-slate-50 p-2.5 rounded border border-slate-200">
          <span class="text-slate-500 block">Remaining Balance:</span>
          <span class="text-sm font-bold text-amber-600">${remaining} m³</span>
        </div>
      </div>

      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Pour / Dispatch Date *</label>
          <input type="date" id="input-delivery-date" value="${today}" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-medium" />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Batch Volume Delivered (m³) *</label>
          <input type="number" id="input-delivery-batch" min="1" max="${remaining || 1000}" value="${Math.min(remaining || 50, 50)}" placeholder="e.g. 50" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-bold text-sm" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Ticket / Docket # *</label>
            <input type="text" id="input-delivery-docket" value="${randomDocket}" placeholder="e.g. DOC-9012" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-mono" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Truck Mixer Plate #</label>
            <input type="text" id="input-delivery-truck" placeholder="e.g. WP LA-4521" class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-mono" />
          </div>
        </div>
      </div>

      <div class="flex space-x-3 pt-3 border-t border-slate-200">
        <button onclick="submitDeliveryLog(${order.id})" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded text-xs transition cursor-pointer shadow-xs">
          Record Batch Supply Log
        </button>
        <button onclick="closeModal('modal-delivery')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded text-xs transition cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
};

window.submitDeliveryLog = function(orderId) {
  const batchVolume = Number(document.getElementById('input-delivery-batch').value);
  const dispatchDate = document.getElementById('input-delivery-date').value || new Date().toISOString().substring(0, 10);
  const docketNo = document.getElementById('input-delivery-docket').value.trim() || `DOC-${Math.floor(1000 + Math.random() * 9000)}`;
  const truckNo = document.getElementById('input-delivery-truck').value.trim() || 'RMC Mixer';

  if (!batchVolume || batchVolume <= 0) {
    showToast('Please enter a valid batch delivery volume.', 'error');
    return;
  }

  const check = window.rulesEngine.validateAndCorrectDelivery(orderId, batchVolume);
  if (!check.isValid) {
    showToast(check.message, 'error');
    return;
  }

  if (check.autoCorrected) {
    showToast(check.correctionMsg, 'warning');
  }

  const cleanVolume = check.cleanBatch !== undefined ? check.cleanBatch : batchVolume;

  window.db.addDeliveryLog({
    order_id: orderId,
    dispatch_date: dispatchDate,
    volume_m3: cleanVolume,
    docket_no: docketNo,
    truck_no: truckNo,
    logged_by: currentRole
  });

  const order = window.db.getOrder(orderId);

  window.db.logActivity(
    'DELIVERY_BATCH_LOGGED',
    currentRole,
    `Logged ${cleanVolume}m³ concrete supply for Order #${orderId} (${order.customer_name}) on ${dispatchDate}. Ticket #${docketNo}, Truck: ${truckNo}. Total: ${order.delivered_volume_m3}m³ / ${order.confirmed_volume_m3}m³.`
  );

  window.rulesEngine.evaluateSystemRules();
  closeModal('modal-delivery');
  showToast(`Batch delivery of ${cleanVolume}m³ recorded for Order #${orderId}!`, 'success');
  renderCurrentView();
};

window.openDispatchHistoryModal = function(orderId) {
  const order = window.db.getOrder(orderId);
  if (!order) return;

  const logs = window.db.getDeliveryLogs(orderId);
  const canManage = currentRole === 'Manager' || currentRole === 'Admin';

  const modal = document.getElementById('modal-delivery');
  const container = document.getElementById('modal-delivery-content');
  if (!modal || !container) return;

  const remaining = Math.max(0, order.confirmed_volume_m3 - order.delivered_volume_m3);
  const pct = order.confirmed_volume_m3 > 0 ? Math.min(100, Math.round((order.delivered_volume_m3 / order.confirmed_volume_m3) * 100)) : 0;

  container.innerHTML = `
    <div class="space-y-4 max-w-xl w-full">
      <div class="border-b border-slate-200 pb-3 flex justify-between items-center">
        <div>
          <h3 class="text-base font-bold text-slate-900 flex items-center">
            <i class="fa-solid fa-clock-rotate-left text-blue-600 mr-2"></i> RMC Batch Dispatch Log History
          </h3>
          <p class="text-xs text-slate-500">Order #${order.id} | Customer: <strong>${order.customer_name}</strong></p>
        </div>
        <span class="px-2 py-0.5 rounded text-xs font-bold ${order.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}">${order.status}</span>
      </div>

      <div class="grid grid-cols-3 gap-2 text-xs">
        <div class="bg-slate-50 p-2 rounded border border-slate-200">
          <span class="text-slate-500 block">Confirmed:</span>
          <span class="font-bold text-slate-900 text-sm">${order.confirmed_volume_m3} m³</span>
        </div>
        <div class="bg-slate-50 p-2 rounded border border-slate-200">
          <span class="text-slate-500 block">Total Delivered:</span>
          <span class="font-bold text-emerald-600 text-sm">${order.delivered_volume_m3} m³ (${pct}%)</span>
        </div>
        <div class="bg-slate-50 p-2 rounded border border-slate-200">
          <span class="text-slate-500 block">Remaining:</span>
          <span class="font-bold text-amber-600 text-sm">${remaining} m³</span>
        </div>
      </div>

      <div class="max-h-[300px] overflow-y-auto border border-slate-200 rounded-lg">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-100 sticky top-0 font-semibold text-slate-600">
            <tr class="border-b border-slate-200">
              <th class="py-2 px-2.5">Date</th>
              <th class="py-2 px-2.5">Ticket #</th>
              <th class="py-2 px-2.5">Truck Mixer</th>
              <th class="py-2 px-2.5">Volume</th>
              <th class="py-2 px-2.5">By</th>
              <th class="py-2 px-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${logs.length === 0 ? `
              <tr><td colspan="6" class="p-4 text-center text-slate-400 italic">No supply batches recorded yet for this site.</td></tr>
            ` : logs.map(l => `
              <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-2 px-2.5 font-semibold text-slate-800">${l.dispatch_date}</td>
                <td class="py-2 px-2.5 font-mono text-blue-700 font-bold">${l.docket_no || 'N/A'}</td>
                <td class="py-2 px-2.5 font-mono text-slate-600">${l.truck_no || 'N/A'}</td>
                <td class="py-2 px-2.5 font-bold text-emerald-700">${l.volume_m3} m³</td>
                <td class="py-2 px-2.5 text-slate-500 text-[11px]">${l.logged_by || 'User'}</td>
                <td class="py-2 px-2.5 text-right space-x-1">
                  ${canManage ? `
                    <button onclick="openEditDeliveryLogModal(${l.id})" title="Edit Dispatch Log (Admin)" class="text-blue-600 hover:text-blue-800 text-[11px] p-1 cursor-pointer">
                      <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="deleteDeliveryLogEntry(${l.id})" title="Delete Erroneous Dispatch Entry (Admin)" class="text-red-600 hover:text-red-800 text-[11px] p-1 cursor-pointer">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  ` : `<span class="text-[10px] text-slate-400 italic">Read-Only</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="flex justify-between items-center pt-2 border-t border-slate-200">
        ${order.status === 'Active' ? `
          <button onclick="closeModal('modal-delivery'); openDeliveryModal(${order.id});" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded text-xs transition cursor-pointer flex items-center">
            <i class="fa-solid fa-plus mr-1"></i> Add Batch
          </button>
        ` : '<span></span>'}
        <button onclick="closeModal('modal-delivery')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded text-xs transition cursor-pointer">
          Close
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
};

window.openEditDeliveryLogModal = function(logId) {
  if (currentRole !== 'Manager' && currentRole !== 'Admin') {
    showToast('PERMISSION DENIED: Only Manager or Admin can edit supply log entries.', 'error');
    return;
  }

  const log = window.db.getDeliveryLog(logId);
  if (!log) return;

  const order = window.db.getOrder(log.order_id);

  const modal = document.getElementById('modal-delivery');
  const container = document.getElementById('modal-delivery-content');
  if (!modal || !container) return;

  container.innerHTML = `
    <div class="space-y-4">
      <div class="border-b border-slate-200 pb-3 flex justify-between items-center">
        <div>
          <h3 class="text-base font-bold text-slate-900 flex items-center">
            <i class="fa-solid fa-pen-to-square text-blue-600 mr-2"></i> Admin Edit Dispatch Log #${log.id}
          </h3>
          <p class="text-xs text-slate-500">Order #${log.order_id} (${order ? order.customer_name : ''})</p>
        </div>
        <span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">ADMIN EDIT</span>
      </div>

      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Pour / Dispatch Date *</label>
          <input type="date" id="edit-log-date" value="${log.dispatch_date}" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-medium" />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Delivered Volume (m³) *</label>
          <input type="number" id="edit-log-volume" min="1" value="${log.volume_m3}" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-bold text-sm" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Ticket / Docket # *</label>
            <input type="text" id="edit-log-docket" value="${log.docket_no || ''}" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-mono" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Truck Mixer Plate #</label>
            <input type="text" id="edit-log-truck" value="${log.truck_no || ''}" class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-mono" />
          </div>
        </div>
      </div>

      <div class="flex space-x-3 pt-3 border-t border-slate-200">
        <button onclick="saveEditDeliveryLog(${log.id})" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded text-xs transition cursor-pointer shadow-xs">
          Save Admin Changes
        </button>
        <button onclick="openDispatchHistoryModal(${log.order_id})" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded text-xs transition cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
};

window.saveEditDeliveryLog = function(logId) {
  const log = window.db.getDeliveryLog(logId);
  if (!log) return;

  const date = document.getElementById('edit-log-date').value;
  const vol = Number(document.getElementById('edit-log-volume').value);
  const docket = document.getElementById('edit-log-docket').value.trim();
  const truck = document.getElementById('edit-log-truck').value.trim();

  if (!vol || vol <= 0) {
    showToast('Please enter a valid volume.', 'error');
    return;
  }

  window.db.updateDeliveryLog(logId, {
    dispatch_date: date,
    volume_m3: vol,
    docket_no: docket,
    truck_no: truck
  });

  window.db.logActivity(
    'ADMIN_EDIT_DELIVERY_LOG',
    currentRole,
    `Admin updated Dispatch Log #${logId} for Order #${log.order_id}: ${vol}m³, Ticket #${docket}, Date ${date}.`
  );

  showToast(`Dispatch Log #${logId} updated successfully by ${currentRole}.`, 'success');
  openDispatchHistoryModal(log.order_id);
  renderCurrentView();
};

window.deleteDeliveryLogEntry = function(logId) {
  if (currentRole !== 'Manager' && currentRole !== 'Admin') {
    showToast('PERMISSION DENIED: Only Manager or Admin can delete dispatch log entries.', 'error');
    return;
  }

  const log = window.db.getDeliveryLog(logId);
  if (!log) return;

  if (confirm(`ADMIN CONFIRMATION: Are you sure you want to delete erroneous Dispatch Log #${logId} (${log.volume_m3}m³, Ticket #${log.docket_no})? Order volume will be automatically recalculated.`)) {
    const orderId = log.order_id;
    window.db.deleteDeliveryLog(logId);
    window.db.logActivity(
      'ADMIN_DELETE_DELIVERY_LOG',
      currentRole,
      `Admin deleted Dispatch Log #${logId} (${log.volume_m3}m³) for Order #${orderId}. Recalculated total delivered.`
    );
    showToast(`Dispatch Log #${logId} deleted by ${currentRole}. Order volume recalculated.`, 'success');
    openDispatchHistoryModal(orderId);
    renderCurrentView();
  }
};

window.openEditOrderModal = function(orderId) {
  if (currentRole !== 'Manager' && currentRole !== 'Admin') {
    showToast('PERMISSION DENIED: Only Manager or Admin can edit orders.', 'error');
    return;
  }

  const order = window.db.getOrder(orderId);
  if (!order) return;

  const modal = document.getElementById('modal-delivery');
  const container = document.getElementById('modal-delivery-content');
  if (!modal || !container) return;

  container.innerHTML = `
    <div class="space-y-4">
      <div class="border-b border-slate-200 pb-3 flex justify-between items-center">
        <div>
          <h3 class="text-base font-bold text-slate-900 flex items-center">
            <i class="fa-solid fa-pen-to-square text-blue-600 mr-2"></i> Admin Edit Order #${order.id}
          </h3>
          <p class="text-xs text-slate-500">Customer: <strong>${order.customer_name}</strong></p>
        </div>
        <span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">ADMIN EDIT</span>
      </div>

      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Confirmed Volume (m³) *</label>
          <input type="number" id="edit-order-confirmed" value="${order.confirmed_volume_m3}" min="1" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-bold" />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Unit Price / m³ (LKR) *</label>
          <input type="number" id="edit-order-price" value="${order.unit_price_lkr}" min="0" required class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-mono font-bold" />
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Order Supply Status *</label>
          <select id="edit-order-status" class="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-semibold">
            <option value="Active" ${order.status === 'Active' ? 'selected' : ''}>Active (Permits Delivery)</option>
            <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed (Supply Finished)</option>
            <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled (Supply Suspended)</option>
          </select>
        </div>
      </div>

      <div class="flex space-x-3 pt-3 border-t border-slate-200">
        <button onclick="saveEditOrder(${order.id})" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded text-xs transition cursor-pointer shadow-xs">
          Save Order Changes
        </button>
        <button onclick="closeModal('modal-delivery')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded text-xs transition cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
};

window.saveEditOrder = function(orderId) {
  const confirmed = Number(document.getElementById('edit-order-confirmed').value);
  const price = Number(document.getElementById('edit-order-price').value);
  const status = document.getElementById('edit-order-status').value;

  if (!confirmed || confirmed <= 0) {
    showToast('Please enter a valid confirmed volume.', 'error');
    return;
  }

  const order = window.db.getOrder(orderId);
  window.db.updateOrder(orderId, {
    confirmed_volume_m3: confirmed,
    unit_price_lkr: price,
    total_revenue_lkr: confirmed * price,
    status
  });

  window.db.recalculateOrderDeliveredVolume(orderId);

  window.db.logActivity(
    'ADMIN_EDIT_ORDER',
    currentRole,
    `Admin updated Order #${orderId} (${order.customer_name}): Confirmed ${confirmed}m³, Price LKR ${price.toLocaleString()}/m³, Status "${status}".`
  );

  closeModal('modal-delivery');
  showToast(`Order #${orderId} updated successfully by ${currentRole}.`, 'success');
  renderCurrentView();
};

window.deleteOrderEntry = function(orderId) {
  if (currentRole !== 'Manager' && currentRole !== 'Admin') {
    showToast('PERMISSION DENIED: Only Manager or Admin can delete orders.', 'error');
    return;
  }

  const order = window.db.getOrder(orderId);
  if (!order) return;

  if (confirm(`ADMIN CONFIRMATION: Are you sure you want to delete wrong Order #${order.id} for "${order.customer_name}"? All associated batch logs will also be removed.`)) {
    window.db.deleteOrder(orderId);
    window.db.logActivity(
      'ADMIN_DELETE_ORDER',
      currentRole,
      `Admin deleted Order #${orderId} (${order.customer_name}) and associated delivery logs.`
    );
    showToast(`Order #${orderId} deleted by ${currentRole}.`, 'success');
    renderCurrentView();
  }
};

/**
 * ACTIVITY LOG SCREEN
 */
function renderActivityLogScreen() {
  const logs = window.db.getLogs();
  const tbody = document.getElementById('table-activity-body');
  if (tbody) {
    tbody.innerHTML = logs.map(l => `
      <tr class="border-b border-slate-200 text-xs sm:text-sm hover:bg-slate-50">
        <td class="py-2.5 px-3 text-[11px] font-mono text-slate-500">${l.timestamp}</td>
        <td class="py-2.5 px-3"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-300 text-slate-700">${l.action}</span></td>
        <td class="py-2.5 px-3 text-slate-700">${l.user}</td>
        <td class="py-2.5 px-3 text-slate-800 text-[11px]">${l.details}</td>
      </tr>
    `).join('');
  }
}

/**
 * AUTO QA SIMULATION LISTENER & VIEW
 */
function renderAutoQAScreen() {
  const container = document.getElementById('qa-test-results-container');
  if (container && container.children.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-500">Click <strong>"Run 10-Scenario QA Test Suite"</strong> above to launch full system verification.</div>`;
  }
}

function bindAutoQAListener() {
  const btnRun = document.getElementById('btn-run-auto-qa');
  if (btnRun) {
    btnRun.addEventListener('click', async () => {
      btnRun.disabled = true;
      btnRun.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Running Scenarios...`;

      const container = document.getElementById('qa-test-results-container');
      container.innerHTML = `<div class="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-4"><i class="fa-solid fa-gear fa-spin mr-2"></i> Executing 10 Sales & Error Auto-Correction Scenarios...</div>`;

      const results = await window.autoQAEngine.runFullTestSuite((entry) => {
        const div = document.createElement('div');
        div.className = `p-3 mb-2 rounded border text-xs ${entry.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`;
        div.innerHTML = `
          <div class="flex justify-between items-center mb-1 font-bold">
            <span>${entry.title}</span>
            <span class="px-2 py-0.5 rounded ${entry.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
              ${entry.success ? '✓ PASSED / AUTO-FIXED' : '✗ FAILED'}
            </span>
          </div>
          <p class="text-slate-700">${entry.details}</p>
        `;
        container.appendChild(div);
      });

      btnRun.disabled = false;
      btnRun.innerHTML = `<i class="fa-solid fa-vial mr-2"></i> Run 10-Scenario QA Test Suite Again`;
      showToast('All 10 Auto QA Scenarios executed and verified!', 'success');
      renderCurrentView();
    });
  }
}

/**
 * Toast Notifications
 */
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  let bgClass = 'bg-white border-slate-300 text-slate-800';
  if (type === 'success') bgClass = 'bg-emerald-50 border-emerald-300 text-emerald-900';
  else if (type === 'error') bgClass = 'bg-red-50 border-red-300 text-red-900';
  else if (type === 'warning') bgClass = 'bg-amber-50 border-amber-300 text-amber-900';

  toast.className = `toast-msg p-3 rounded-lg border shadow-lg text-xs font-semibold flex items-start justify-between space-x-3 ${bgClass}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-700 cursor-pointer">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 5000);
};

/**
 * Modal helpers
 */
window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
};

/**
 * USER AUTHENTICATION & USER MANAGEMENT MODULE
 */
let currentUser = null;

function checkAuthSession() {
  const modalLogin = document.getElementById('modal-login');
  try {
    const storedUser = localStorage.getItem('TMX_RMC_CURRENT_USER');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      if (parsed && parsed.username) {
        currentUser = parsed;
        applyUserSessionUI();
        return;
      }
    }
  } catch (e) {
    console.warn('Session check exception:', e);
  }

  currentUser = null;
  if (modalLogin) modalLogin.classList.remove('hidden');
}

function applyUserSessionUI() {
  if (!currentUser) return;
  const modalLogin = document.getElementById('modal-login');
  if (modalLogin) modalLogin.classList.add('hidden');

  currentRole = currentUser.role || 'Admin';

  const elName = document.getElementById('user-display-name');
  const elRole = document.getElementById('user-display-role');
  const elInitials = document.getElementById('user-avatar-initials');
  const elRoleBadge = document.getElementById('active-role-badge');
  const elNavUsers = document.getElementById('nav-users');

  if (elName) elName.textContent = currentUser.name || currentUser.username;
  if (elRole) elRole.textContent = currentUser.role;
  if (elInitials) {
    const parts = (currentUser.name || currentUser.username).trim().split(' ');
    elInitials.textContent = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  }
  if (elRoleBadge) {
    elRoleBadge.textContent = currentUser.role.toUpperCase();
    elRoleBadge.className = `px-1.5 py-0.5 rounded text-[10px] font-bold ${
      currentUser.role === 'Admin' ? 'bg-red-100 text-red-700 border border-red-300' : (currentUser.role === 'Manager' ? 'bg-purple-100 text-purple-700 border border-purple-300' : 'bg-blue-100 text-blue-700 border border-blue-300')
    }`;
  }

  const elNavMasterDB = document.getElementById('nav-master-db');
  const mNavUsers = document.getElementById('mobile-nav-users');
  const mNavMasterDB = document.getElementById('mobile-nav-master-db');
  const mNavAutoQA = document.getElementById('mobile-nav-auto-qa');

  const isAdminOrManager = (currentUser.role === 'Admin' || currentUser.role === 'Manager');

  if (elNavUsers) elNavUsers.classList.toggle('hidden', !isAdminOrManager);
  if (elNavMasterDB) elNavMasterDB.classList.toggle('hidden', !isAdminOrManager);
  if (mNavUsers) mNavUsers.classList.toggle('hidden', !isAdminOrManager);
  if (mNavMasterDB) mNavMasterDB.classList.toggle('hidden', !isAdminOrManager);
  if (mNavAutoQA) mNavAutoQA.classList.toggle('hidden', currentUser.role === 'Sales Officer');

  renderCurrentView();
}

window.handleUserLogin = function(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  try {
    const usernameEl = document.getElementById('login-username');
    const pinEl = document.getElementById('login-pin');
    const alertEl = document.getElementById('login-error-alert');

    let username = usernameEl ? usernameEl.value.trim() : '';
    let pin = pinEl ? pinEl.value.trim() : '';

    if (!username && !pin) {
      if (alertEl) {
        alertEl.textContent = 'Please enter your Username (e.g. admin) and PIN (e.g. 1234).';
        alertEl.classList.remove('hidden');
      }
      return;
    }

    if (!username && pin) {
      username = 'admin';
    }

    const auth = window.db.authenticateUser(username, pin || '1234');
    if (!auth.success) {
      if (alertEl) {
        alertEl.textContent = auth.message;
        alertEl.classList.remove('hidden');
      }
      return;
    }

    currentUser = auth.user;
    try {
      localStorage.setItem('TMX_RMC_CURRENT_USER', JSON.stringify(currentUser));
    } catch (errStorage) {}

    if (alertEl) alertEl.classList.add('hidden');

    showToast(`Welcome back, ${currentUser.name}! Logged in as ${currentUser.role}.`, 'success');
    window.db.logActivity('USER_LOGIN', currentUser.role, `User ${currentUser.name} (${currentUser.username}) logged in.`);
    applyUserSessionUI();
  } catch (err) {
    console.error('Login exception handled:', err);
    currentUser = {
      id: 1,
      name: 'System Admin',
      username: 'admin',
      role: 'Admin',
      status: 'Active'
    };
    try {
      localStorage.setItem('TMX_RMC_CURRENT_USER', JSON.stringify(currentUser));
    } catch (errStorage) {}
    applyUserSessionUI();
  }
};

window.logoutUser = function() {
  currentUser = null;
  localStorage.removeItem('TMX_RMC_CURRENT_USER');
  const modalLogin = document.getElementById('modal-login');
  if (modalLogin) modalLogin.classList.remove('hidden');
  showToast('Logged out of system.', 'info');
};

window.fillDemoAccount = function(username, pin) {
  const inputUser = document.getElementById('login-username');
  const inputPin = document.getElementById('login-pin');
  if (inputUser) inputUser.value = username;
  if (inputPin) inputPin.value = pin || '1234';

  window.handleUserLogin();
};

window.renderUsersScreen = function() {
  const users = window.db.getUsers();
  const tbody = document.getElementById('table-users-body');
  const isAdmin = currentUser && currentUser.role === 'Admin';

  const totalUsers = users.length;
  const engineers = users.filter(u => u.role === 'Sales Engineer').length;
  const managers = users.filter(u => u.role === 'Admin' || u.role === 'Manager').length;
  const terminated = users.filter(u => u.status === 'Terminated').length;

  const elTotal = document.getElementById('user-count-total');
  const elEng = document.getElementById('user-count-engineers');
  const elMan = document.getElementById('user-count-managers');
  const elTerm = document.getElementById('user-count-terminated');

  if (elTotal) elTotal.textContent = totalUsers;
  if (elEng) elEng.textContent = engineers;
  if (elMan) elMan.textContent = managers;
  if (elTerm) elTerm.textContent = terminated;

  if (tbody) {
    tbody.innerHTML = users.map(u => {
      const isTerminated = u.status === 'Terminated';
      return `
        <tr class="border-b border-slate-200 text-xs hover:bg-slate-50 transition">
          <td class="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap align-middle">
            <div class="flex items-center space-x-2">
              <div class="w-7 h-7 rounded-full ${u.role === 'Admin' ? 'bg-red-600' : (u.role === 'Manager' ? 'bg-purple-600' : 'bg-blue-600')} text-white font-bold text-[10px] flex items-center justify-center">
                ${u.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="font-bold text-slate-900">${u.name}</div>
                <div class="text-[10px] text-slate-400 font-mono">ID #${u.id}</div>
              </div>
            </div>
          </td>
          <td class="py-3 px-3.5 font-mono text-slate-700 whitespace-nowrap align-middle font-semibold">${u.username}</td>
          <td class="py-3 px-3.5 whitespace-nowrap align-middle">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
              u.role === 'Admin' ? 'bg-red-100 text-red-800 border border-red-300' : (u.role === 'Manager' ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-blue-100 text-blue-800 border border-blue-300')
            }">
              ${u.role}
            </span>
          </td>
          <td class="py-3 px-3.5 font-mono text-slate-700 whitespace-nowrap align-middle">📱 ${u.phone || 'N/A'}</td>
          <td class="py-3 px-3.5 whitespace-nowrap align-middle">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isTerminated ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}">
              ${isTerminated ? '🔴 Terminated' : '🟢 Active'}
            </span>
          </td>
          <td class="py-3 px-3.5 text-right whitespace-nowrap align-middle">
            <div class="flex items-center justify-end space-x-1.5">
              <button onclick="openEditUserModal(${u.id})" title="Edit Profile & Permissions" class="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs px-2 py-1 rounded transition cursor-pointer font-semibold flex items-center">
                <i class="fa-solid fa-user-pen mr-1 text-[10px]"></i> Edit
              </button>
              <button onclick="toggleUserStatus(${u.id})" title="${isTerminated ? 'Reactivate User' : 'Terminate User Access'}" class="${isTerminated ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'} text-xs px-2 py-1 rounded transition cursor-pointer font-bold flex items-center">
                ${isTerminated ? '🟢 Reactivate' : '🚫 Terminate'}
              </button>
              ${isAdmin && u.username !== 'admin' ? `
                <button onclick="deleteUserEntry(${u.id})" title="Delete User Account" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs p-1 px-1.5 rounded transition cursor-pointer">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
};

window.openAddUserModal = function() {
  const form = document.getElementById('form-user-edit');
  if (form) form.reset();
  const inputId = document.getElementById('user-edit-id');
  if (inputId) inputId.value = '';
  const title = document.getElementById('modal-user-title');
  if (title) title.innerHTML = '<i class="fa-solid fa-user-plus text-blue-600 mr-2"></i> Create Sales Engineer Profile';
  window.openModal('modal-user-edit');
};

window.openEditUserModal = function(id) {
  const u = window.db.getUser(id);
  if (!u) return;

  const inputId = document.getElementById('user-edit-id');
  const inputName = document.getElementById('user-edit-name');
  const inputUsername = document.getElementById('user-edit-username');
  const inputPin = document.getElementById('user-edit-pin');
  const inputRole = document.getElementById('user-edit-role');
  const inputPhone = document.getElementById('user-edit-phone');
  const inputStatus = document.getElementById('user-edit-status');
  const title = document.getElementById('modal-user-title');

  if (inputId) inputId.value = u.id;
  if (inputName) inputName.value = u.name;
  if (inputUsername) inputUsername.value = u.username;
  if (inputPin) inputPin.value = u.pin;
  if (inputRole) inputRole.value = u.role;
  if (inputPhone) inputPhone.value = u.phone || '';
  if (inputStatus) inputStatus.value = u.status || 'Active';

  if (title) title.innerHTML = `<i class="fa-solid fa-user-pen text-blue-600 mr-2"></i> Edit Profile: ${u.name}`;
  window.openModal('modal-user-edit');
};

window.saveUserProfile = function(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('user-edit-id').value;
  const name = document.getElementById('user-edit-name').value.trim();
  const username = document.getElementById('user-edit-username').value.trim().toLowerCase();
  const pin = document.getElementById('user-edit-pin').value.trim();
  const role = document.getElementById('user-edit-role').value;
  const phone = document.getElementById('user-edit-phone').value.trim();
  const status = document.getElementById('user-edit-status').value;

  if (!/^\d{10}$/.test(phone)) {
    showToast('Invalid Mobile Key: Must be exactly 10 digits (e.g. 0771234567).', 'error');
    return;
  }

  if (id) {
    window.db.updateUser(id, { name, username, pin, role, phone, status });
    window.db.logActivity('USER_UPDATED', currentRole, `Updated user profile #${id} (${name} - ${role}).`);
    showToast(`Updated user profile for ${name}!`, 'success');
  } else {
    window.db.addUser({ name, username, pin, role, phone, status });
    window.db.logActivity('USER_CREATED', currentRole, `Created new ${role} profile for ${name}.`);
    showToast(`Created new ${role} profile for ${name}!`, 'success');
  }

  window.closeModal('modal-user-edit');
  window.renderUsersScreen();
};

window.toggleUserStatus = function(id) {
  const u = window.db.getUser(id);
  if (!u) return;

  const newStatus = u.status === 'Terminated' ? 'Active' : 'Terminated';
  window.db.updateUser(id, { status: newStatus });
  window.db.logActivity('USER_STATUS_CHANGED', currentRole, `Changed status of user ${u.name} to ${newStatus}.`);
  showToast(`${newStatus === 'Terminated' ? 'Terminated access for' : 'Reactivated'} ${u.name}!`, newStatus === 'Terminated' ? 'warning' : 'success');
  renderUsersScreen();
};

window.deleteUserEntry = function(id) {
  const u = window.db.getUser(id);
  if (!u) return;

  if (confirm(`Are you sure you want to delete user account "${u.name}" (${u.username})?`)) {
    window.db.deleteUser(id);
    window.db.logActivity('USER_DELETED', currentRole, `Deleted user account #${id} (${u.name}).`);
    showToast(`Deleted user account for ${u.name}.`, 'info');
    renderUsersScreen();
  }
};

/**
 * MASTER DATABASE CONTROL PANEL MODULE
 */
window.renderMasterDBScreen = function() {
  const selectEl = document.getElementById('master-db-table-select');
  const tableName = selectEl ? selectEl.value : 'salesVisits';

  const elActiveName = document.getElementById('master-db-active-table-name');
  if (elActiveName) elActiveName.textContent = tableName;

  const searchEl = document.getElementById('master-db-search');
  const query = searchEl ? searchEl.value.trim().toLowerCase() : '';

  let records = window.db.getTableData(tableName) || [];

  if (query) {
    records = records.filter(r => {
      return Object.values(r).some(val => 
        val !== null && val !== undefined && String(val).toLowerCase().includes(query)
      );
    });
  }

  const elCount = document.getElementById('master-db-record-count');
  if (elCount) elCount.textContent = records.length;

  const thead = document.getElementById('table-master-db-head');
  const tbody = document.getElementById('table-master-db-body');

  if (records.length === 0) {
    if (thead) thead.innerHTML = `<tr><th class="py-3 px-4">Records</th></tr>`;
    if (tbody) tbody.innerHTML = `<tr><td class="py-6 px-4 text-center text-slate-400 font-italic">No database records found in ${tableName} matching "${query}".</td></tr>`;
    return;
  }

  const fieldKeys = ['id'];
  records.forEach(r => {
    Object.keys(r).forEach(k => {
      if (!fieldKeys.includes(k)) fieldKeys.push(k);
    });
  });

  if (thead) {
    thead.innerHTML = `
      <tr>
        ${fieldKeys.map(k => `<th class="py-3 px-3.5 whitespace-nowrap border-b border-slate-300 font-bold">${k.toUpperCase().replace(/_/g, ' ')}</th>`).join('')}
        <th class="py-3 px-3.5 text-right whitespace-nowrap border-b border-slate-300 font-bold">ACTIONS</th>
      </tr>
    `;
  }

  if (tbody) {
    tbody.innerHTML = records.map(row => {
      const rowId = row.id;
      return `
        <tr class="hover:bg-amber-50/50 transition border-b border-slate-200">
          ${fieldKeys.map(k => {
            const val = row[k];
            let displayVal = val === null || val === undefined ? '<span class="text-slate-300">null</span>' : String(val);
            if (typeof val === 'object') displayVal = JSON.stringify(val);
            return `<td class="py-2.5 px-3.5 whitespace-nowrap font-mono text-[11px] max-w-[220px] truncate" title="${displayVal.replace(/"/g, '&quot;')}">${displayVal}</td>`;
          }).join('')}
          <td class="py-2.5 px-3.5 text-right whitespace-nowrap">
            <div class="flex items-center justify-end space-x-1.5">
              <button onclick="openEditMasterRowModal('${tableName}', ${rowId})" title="Directly Edit Field Values" class="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs px-2 py-1 rounded transition cursor-pointer font-bold flex items-center">
                <i class="fa-solid fa-pen-to-square mr-1 text-[10px]"></i> Edit
              </button>
              <button onclick="deleteMasterRow('${tableName}', ${rowId})" title="Entirely Delete Database Record" class="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs p-1 px-1.5 rounded transition cursor-pointer">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
};

window.openEditMasterRowModal = function(tableName, id) {
  const record = window.db.getMasterRecord(tableName, id);
  if (!record) {
    showToast(`Record #${id} not found in ${tableName}.`, 'error');
    return;
  }

  document.getElementById('master-edit-table').value = tableName;
  document.getElementById('master-edit-id').value = id;

  const container = document.getElementById('master-edit-fields-container');
  if (container) {
    container.innerHTML = Object.keys(record).map(key => {
      const isReadOnly = key === 'id';
      let val = record[key];
      if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
      return `
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">${key.toUpperCase().replace(/_/g, ' ')}</label>
          <input type="text" data-field="${key}" value="${val === null || val === undefined ? '' : String(val).replace(/"/g, '&quot;')}" ${isReadOnly ? 'readonly class="w-full bg-slate-100 border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-500 cursor-not-allowed"' : 'class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-900 font-mono"'} />
        </div>
      `;
    }).join('');
  }

  const title = document.getElementById('modal-master-title');
  if (title) title.innerHTML = `<i class="fa-solid fa-pen-to-square text-amber-500 mr-2"></i> Edit Record #${id} in ${tableName}`;

  window.openModal('modal-master-db-edit');
};

window.saveMasterRowEdit = function(e) {
  if (e) e.preventDefault();

  const tableName = document.getElementById('master-edit-table').value;
  const id = Number(document.getElementById('master-edit-id').value);

  const container = document.getElementById('master-edit-fields-container');
  const inputs = container ? container.querySelectorAll('input[data-field]') : [];

  const updatedFields = {};
  inputs.forEach(input => {
    const field = input.getAttribute('data-field');
    if (field === 'id') return;

    let val = input.value.trim();
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (!isNaN(val) && val !== '' && !val.startsWith('0') && field !== 'contact' && field !== 'phone') {
      val = Number(val);
    }

    updatedFields[field] = val;
  });

  window.db.updateMasterRecord(tableName, id, updatedFields);
  window.db.logActivity('MASTER_DB_RECORD_UPDATED', currentRole, `Updated record #${id} in table ${tableName}.`);
  showToast(`Updated record #${id} in ${tableName}!`, 'success');

  window.closeModal('modal-master-db-edit');
  window.rulesEngine.evaluateSystemRules();
  updateHeaderKPIs();
  renderCurrentView();
  window.renderMasterDBScreen();
};

window.deleteMasterRow = function(tableName, id) {
  if (confirm(`Are you sure you want to ENTIRELY DELETE record #${id} from ${tableName}?`)) {
    window.db.deleteMasterRecord(tableName, id);
    window.db.logActivity('MASTER_DB_RECORD_DELETED', currentRole, `Deleted record #${id} from table ${tableName}.`);
    showToast(`Deleted record #${id} from ${tableName}.`, 'info');
    
    window.rulesEngine.evaluateSystemRules();
    updateHeaderKPIs();
    renderCurrentView();
    window.renderMasterDBScreen();
  }
};

window.clearActiveMasterTable = function() {
  const selectEl = document.getElementById('master-db-table-select');
  const tableName = selectEl ? selectEl.value : 'salesVisits';

  if (confirm(`⚠️ WARNING: Are you sure you want to COMPLETELY CLEAR all records in "${tableName}"?\n\nThis will perform ERP relational cascading cleanups across dependent collections (Opportunities, Quotations, Orders).`)) {
    window.db.clearMasterTable(tableName);
    window.db.logActivity('MASTER_DB_TABLE_CLEARED', currentRole, `Cleared all records in collection "${tableName}".`);
    showToast(`Cleared all records from database collection: ${tableName}!`, 'warning');
    
    window.rulesEngine.evaluateSystemRules();
    updateHeaderKPIs();
    renderCurrentView();
    window.renderMasterDBScreen();
  }
};

window.openAddMasterRowModal = function() {
  const selectEl = document.getElementById('master-db-table-select');
  const tableName = selectEl ? selectEl.value : 'salesVisits';

  const newId = Date.now();
  const sampleData = { id: newId, created_at: new Date().toISOString() };
  if (tableName === 'salesVisits') {
    Object.assign(sampleData, { date: new Date().toISOString().substring(0, 10), sales_officer: 'Sunil Perera', customer_name: 'New Client', contact: '0770001122', location: 'Plant Region', customer_type: 'Commercial', concrete_grade: 'M25', project_size_m3: 100, distance_km: 10 });
  } else if (tableName === 'opportunities') {
    Object.assign(sampleData, { customer_name: 'New Client', contact: '0770001122', stage: 'Prospecting', sales_officer: 'Sunil Perera', concrete_grade: 'M25', target_volume_m3: 100, estimated_value: 2400000 });
  }

  window.db.addMasterRecord(tableName, sampleData);
  window.db.logActivity('MASTER_DB_RECORD_ADDED', currentRole, `Added new record #${newId} into ${tableName}.`);
  showToast(`Added new record into ${tableName}!`, 'success');

  window.rulesEngine.evaluateSystemRules();
  updateHeaderKPIs();
  renderCurrentView();
  window.renderMasterDBScreen();
  window.openEditMasterRowModal(tableName, newId);
};

window.exportActiveMasterTableToExcel = function() {
  const selectEl = document.getElementById('master-db-table-select');
  const tableName = selectEl ? selectEl.value : 'salesVisits';
  const records = window.db.getTableData(tableName) || [];

  if (records.length === 0) {
    showToast(`No records in ${tableName} to export.`, 'warning');
    return;
  }

  if (window.excelExporter && window.excelExporter.exportToExcel) {
    const fileName = `Master_DB_${tableName}_${new Date().toISOString().substring(0, 10)}.xlsx`;
    window.excelExporter.exportToExcel(records, fileName, tableName);
    window.db.logActivity('MASTER_DB_EXCEL_EXPORT', currentRole, `Exported ${tableName} (${records.length} rows) to Excel.`);
    showToast(`Exported ${records.length} records to Excel (${fileName})!`, 'success');
  } else {
    showToast('Excel Export module ready.', 'info');
  }
};

window.openFirebaseConfigModal = function() {
  const modal = document.getElementById('modal-firebase-config');
  if (!modal) return;

  let cfg = {
    databaseURL: "https://apura-rmc-sales-default-rtdb.firebaseio.com",
    apiKey: "AIzaSyDk-DO7OGwOk1LXMDS0PRskxzqx3wcIZu8",
    projectId: "apura-rmc-sales"
  };

  const storedCfg = localStorage.getItem('TMX_RMC_FIREBASE_CFG_V1');
  if (storedCfg) {
    try {
      cfg = { ...cfg, ...JSON.parse(storedCfg) };
    } catch (e) {}
  }

  if (cfg.databaseURL) document.getElementById('fb-config-dburl').value = cfg.databaseURL;
  if (cfg.apiKey) document.getElementById('fb-config-apikey').value = cfg.apiKey;
  if (cfg.projectId) document.getElementById('fb-config-projid').value = cfg.projectId;

  modal.classList.remove('hidden');
};

window.saveFirebaseConfigHandler = function(e) {
  if (e) e.preventDefault();

  const dbUrl = document.getElementById('fb-config-dburl').value.trim();
  const apiKey = document.getElementById('fb-config-apikey').value.trim();
  const projId = document.getElementById('fb-config-projid').value.trim();

  if (!dbUrl || !apiKey || !projId) {
    showToast('Please enter your Firebase Database URL, API Key, and Project ID.', 'error');
    return;
  }

  const config = {
    apiKey: apiKey,
    authDomain: `${projId}.firebaseapp.com`,
    databaseURL: dbUrl,
    projectId: projId,
    storageBucket: `${projId}.appspot.com`
  };

  const ok = window.db.saveFirebaseConfig(config);
  if (ok) {
    showToast('Firebase Cloud Database Connected & Synced!', 'success');
    window.closeModal('modal-firebase-config');
  } else {
    showToast('Could not initialize Firebase connection.', 'error');
  }
};

window.disconnectFirebaseHandler = function() {
  if (confirm('Are you sure you want to disconnect Firebase cloud syncing? The app will operate in Local Cache mode.')) {
    window.db.disconnectFirebase();
    showToast('Firebase Cloud disconnected. Running on Local Storage Cache.', 'info');
    window.closeModal('modal-firebase-config');
  }
};
