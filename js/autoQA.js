/**
 * Automated QA & Test Simulation Suite (Auto QA Engine)
 * Runs 10 comprehensive sales scenarios end-to-end to validate:
 * - Pricing accuracy
 * - Workflow correctness
 * - Error detection & auto-correction
 * - Dashboard KPI recalculation
 */

class AutoQAEngine {
  constructor(db, pricingEngine, rulesEngine, selfImprovement) {
    this.db = db;
    this.pricingEngine = pricingEngine;
    this.rulesEngine = rulesEngine;
    this.selfImprovement = selfImprovement;
  }

  async runFullTestSuite(logCallback) {
    const results = [];
    const log = (step, title, success, details) => {
      const entry = { step, title, success, details, timestamp: new Date().toLocaleTimeString() };
      results.push(entry);
      if (logCallback) logCallback(entry);
    };

    log(1, 'Scenario 1: Site Visit & Lead Creation', true, 'Simulating site visit entry for "Sanken Overseas" (250m³)...');
    const visit = this.db.addVisit({
      date: new Date().toISOString().substring(0, 10),
      sales_officer: 'Sunil Perera',
      customer_name: 'Sanken Overseas',
      location: 'Battaramulla',
      contact: '+94 77 999 1122',
      notes: 'QA Test Visit - Commercial Tower Foundation',
      customer_type: 'Commercial',
      project_size_m3: 250
    });

    const lead = this.db.addOpportunity({
      visit_id: visit.id,
      customer_name: 'Sanken Overseas',
      sales_officer: 'Sunil Perera',
      stage: 'Lead',
      expected_volume_m3: 250,
      expected_value_lkr: 250 * 26000,
      probability: 30
    });
    log(1, 'Scenario 1: Result', !!lead.id, `Lead #${lead.id} created successfully for ${visit.customer_name}.`);

    // Scenario 2: Pricing Formula Calculation (M20 grade)
    log(2, 'Scenario 2: Pricing Formula Verification', true, 'Testing M20 grade formula (24,000 + 10km extra*120 + pump)...');
    const calcM20 = this.pricingEngine.calculatePrice({
      concreteGrade: 'M20',
      distanceKm: 25,
      pumpRequired: true,
      volumeM3: 100
    });
    const expectedRate = calcM20.basePrice + calcM20.truckTransportRatePerM3 + calcM20.pumpCostPerM3;
    const isPriceCorrect = calcM20.pricePerM3 === expectedRate && calcM20.basePrice === 24000;
    log(2, 'Scenario 2: Result', isPriceCorrect, `Formula calculated LKR ${calcM20.pricePerM3}/m³. Expected LKR ${expectedRate}/m³. Match = ${isPriceCorrect}.`);

    // Scenario 3: Pricing Error Auto-Correction
    log(3, 'Scenario 3: Pricing Error Auto-Correction Test', true, 'Injecting invalid price (LKR 20,000) on M30 grade quote...');
    const validation = this.pricingEngine.validateAndAutoCorrect({
      concreteGrade: 'M30',
      distanceKm: 30,
      pumpRequired: false,
      volumeM3: 200,
      userPricePerM3: 20000 // Wrong (Base M30 is 28,500 + 1,800 = 30,300)
    });
    const autoFixed = !validation.isValid && validation.expectedPricePerM3 === 30300;
    if (autoFixed) {
      this.selfImprovement.recordUserError('PRICING_MANUAL_MISMATCH', validation.autoCorrectionMessage);
    }
    log(3, 'Scenario 3: Result', autoFixed, `Pricing check detected discrepancy of LKR ${validation.discrepancy}. Auto-corrected price to LKR ${validation.expectedPricePerM3}/m³.`);

    // Scenario 4: Stage Skip Violation Prevention
    log(4, 'Scenario 4: Stage Skip Blocking', true, 'Attempting illegal direct transition from "Lead" to "Won"...');
    const stageCheck = this.rulesEngine.validateStageTransition('Lead', 'Won');
    const isBlocked = !stageCheck.isValid;
    log(4, 'Scenario 4: Result', isBlocked, `System blocked stage skip: "${stageCheck.message}"`);

    // Scenario 5: Invalid Volume Rejection
    log(5, 'Scenario 5: Negative Volume Rejection', true, 'Submitting volume of -150 m³...');
    const volCheck = this.rulesEngine.validateVolume(-150);
    log(5, 'Scenario 5: Result', !volCheck.isValid, `System rejected invalid volume: "${volCheck.message}"`);

    // Scenario 6: High Probability Negotiation Automation
    log(6, 'Scenario 6: High Prob Manager Notification', true, 'Setting Negotiation stage probability to 85%...');
    const oppNegotiation = this.db.addOpportunity({
      visit_id: visit.id,
      customer_name: 'Sierra Construction',
      sales_officer: 'Kamal Silva',
      stage: 'Negotiation',
      expected_volume_m3: 300,
      expected_value_lkr: 9000000,
      probability: 85
    });
    const rulesOutput = this.rulesEngine.evaluateSystemRules();
    const managerNotified = rulesOutput.some(n => n.code === 'HIGH_PROBABILITY');
    log(6, 'Scenario 6: Result', managerNotified, `Manager Notification Triggered: Probability > 70% in Negotiation.`);

    // Scenario 7: Auto Order Generation on WON
    log(7, 'Scenario 7: Auto Supply Order Creation', true, 'Transitioning Opportunity to "Won"...');
    this.db.updateOpportunity(lead.id, { stage: 'Won' });
    const autoOrder = this.rulesEngine.handleStageChangeToWon(lead.id);
    const orderCreated = !!autoOrder && autoOrder.confirmed_volume_m3 === 250;
    log(7, 'Scenario 7: Result', orderCreated, `Supply Order #${autoOrder ? autoOrder.id : 'N/A'} automatically generated upon WON transition.`);

    // Scenario 8: Oversupply Delivery Clamp
    log(8, 'Scenario 8: Delivery Oversupply Auto-Clamp', true, 'Attempting to deliver 350 m³ for a 250 m³ confirmed order...');
    const deliveryCheck = this.rulesEngine.validateAndCorrectDelivery(autoOrder.id, 350);
    const clamped = deliveryCheck.autoCorrected && deliveryCheck.cleanTotal === 250;
    if (clamped) {
      this.db.addDeliveryLog({
        order_id: autoOrder.id,
        dispatch_date: new Date().toISOString().substring(0, 10),
        volume_m3: deliveryCheck.cleanBatch !== undefined ? deliveryCheck.cleanBatch : 250,
        docket_no: 'QA-DOC-88',
        truck_no: 'QA-TRUCK-01',
        logged_by: 'QA Engine'
      });
    }
    log(8, 'Scenario 8: Result', clamped, deliveryCheck.correctionMsg);

    // Scenario 9: Auto Order Completion Rule
    log(9, 'Scenario 9: Auto Order Completion Rule', true, 'Checking order status when delivered volume equals confirmed volume...');
    this.rulesEngine.evaluateSystemRules();
    const updatedOrder = this.db.getOrder(autoOrder.id);
    const isCompleted = updatedOrder.status === 'Completed';
    log(9, 'Scenario 9: Result', isCompleted, `Order #${updatedOrder.id} status auto-updated to "${updatedOrder.status}".`);

    // Scenario 10: Duplicate Site Visit Detection
    log(10, 'Scenario 10: Duplicate Visit Detection', true, 'Entering duplicate visit for "Sanken Overseas" on same date...');
    const dupCheck = this.rulesEngine.checkDuplicateVisit('Sanken Overseas', visit.date);
    log(10, 'Scenario 10: Result', dupCheck.isDuplicate, dupCheck.message);

    return results;
  }
}

window.autoQAEngine = new AutoQAEngine(window.db, window.pricingEngine, window.rulesEngine, window.selfImprovementEngine);
