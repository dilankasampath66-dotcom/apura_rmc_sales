/**
 * Business Rules & Error Auto-Correction Engine
 * Validates data integrity, enforces workflow rules, and auto-corrects anomalies.
 */

class RulesEngine {
  constructor(db, pricingEngine) {
    this.db = db;
    this.pricingEngine = pricingEngine;
  }

  /**
   * Run automated workflow check across all database records
   */
  evaluateSystemRules() {
    const notifications = [];
    const opportunities = this.db.getOpportunities();
    const orders = this.db.getOrders();
    const now = new Date();

    opportunities.forEach(opp => {
      // RULE 1: IF stage = "Quotation" AND no update in 3 days -> Send reminder
      if (opp.stage === 'Quote' && opp.updated_at) {
        const lastUpdate = new Date(opp.updated_at);
        const daysDiff = (now - lastUpdate) / (1000 * 3600 * 24);
        if (daysDiff >= 3) {
          notifications.push({
            type: 'WARNING',
            code: 'STALE_QUOTE',
            oppId: opp.id,
            message: `AUTOMATION RULE 1: Quote for "${opp.customer_name}" has had no update for ${Math.floor(daysDiff)} days. Follow-up reminder sent to ${opp.sales_officer}.`
          });
        }
      }

      // RULE 2: IF stage = "Negotiation" AND probability > 70% -> Notify manager
      if (opp.stage === 'Negotiation' && opp.probability > 70) {
        notifications.push({
          type: 'INFO',
          code: 'HIGH_PROBABILITY',
          oppId: opp.id,
          message: `AUTOMATION RULE 2: High probability negotiation (${opp.probability}%) for "${opp.customer_name}" (LKR ${opp.expected_value_lkr.toLocaleString()}). Manager approval requested.`
        });
      }
    });

    // RULE 4: IF delivered volume = confirmed volume -> Mark Order as Completed
    orders.forEach(order => {
      if (order.status !== 'Completed' && order.delivered_volume_m3 >= order.confirmed_volume_m3) {
        order.status = 'Completed';
        this.db.updateOrder(order.id, { status: 'Completed' });
        this.db.logActivity('AUTO_COMPLETE_ORDER', 'RulesEngine', `Order #${order.id} marked as Completed (Delivered: ${order.delivered_volume_m3}m³ / Confirmed: ${order.confirmed_volume_m3}m³).`);
        notifications.push({
          type: 'SUCCESS',
          code: 'ORDER_COMPLETED',
          orderId: order.id,
          message: `AUTOMATION RULE 4: Order #${order.id} (${order.customer_name}) auto-marked as COMPLETED.`
        });
      }
    });

    return notifications;
  }

  /**
   * CHECK 1: Missing Data Validation
   */
  validateRequiredFields(formData, requiredFields) {
    const missing = [];
    requiredFields.forEach(field => {
      if (formData[field] === undefined || formData[field] === null || String(formData[field]).trim() === '') {
        missing.push(field);
      }
    });
    if (missing.length > 0) {
      return {
        isValid: false,
        missingFields: missing,
        message: `VALIDATION CHECK 1 ERROR: Missing required fields (${missing.join(', ')}). Please complete form.`
      };
    }
    return { isValid: true };
  }

  /**
   * Telephone Number Validation: Must contain exactly 10 digits
   */
  validatePhoneNumber(contact) {
    if (!contact) return { isValid: false, message: 'Contact phone number is required.' };
    const cleanDigits = String(contact).replace(/[\s\-\+\(\)]/g, '');
    if (!/^\d{10}$/.test(cleanDigits)) {
      return {
        isValid: false,
        message: `VALIDATION ERROR: Phone number must contain exactly 10 digits (e.g. 0771234567). (Entered: "${contact}")`
      };
    }
    return { isValid: true, cleanContact: cleanDigits };
  }

  /**
   * CHECK 2: Invalid Volume Validation
   */
  validateVolume(volume) {
    const num = Number(volume);
    if (isNaN(num) || num <= 0) {
      return {
        isValid: false,
        message: `VALIDATION CHECK 2 ERROR: Concrete volume must be greater than 0 m³. (Entered: ${volume})`
      };
    }
    return { isValid: true, cleanVolume: num };
  }

  /**
   * CHECK 4: Stage Skipping Prevention
   * Valid workflow sequence: Lead -> Quote -> Negotiation -> Won/Lost
   */
  validateStageTransition(currentStage, targetStage) {
    const stageOrder = ['Lead', 'Quote', 'Negotiation', 'Won', 'Lost'];
    const currentIndex = stageOrder.indexOf(currentStage);
    const targetIndex = stageOrder.indexOf(targetStage);

    if (targetStage === 'Lost') return { isValid: true }; // Can move to Lost anytime

    if (targetIndex > currentIndex + 1) {
      return {
        isValid: false,
        message: `VALIDATION CHECK 4 ERROR: Workflow violation. Cannot skip directly from "${currentStage}" to "${targetStage}". Please follow stage order: Lead -> Quote -> Negotiation -> Won.`
      };
    }
    return { isValid: true };
  }

  /**
   * CHECK 5: Duplicate Record Check
   */
  checkDuplicateVisit(customerName, visitDate) {
    const visits = this.db.getVisits();
    const duplicate = visits.find(v => 
      v.customer_name.trim().toLowerCase() === customerName.trim().toLowerCase() && 
      v.date === visitDate
    );
    if (duplicate) {
      return {
        isDuplicate: true,
        message: `DUPLICATE WARNING: A visit for "${customerName}" on date ${visitDate} already exists (Visit #${duplicate.id}).`
      };
    }
    return { isDuplicate: false };
  }

  /**
   * CHECK 6: Logical Error - Oversupply Delivery Correction
   * Restricts concrete supply strictly to Active Won sites.
   */
  validateAndCorrectDelivery(orderId, newDeliveryChunk) {
    const order = this.db.getOrder(orderId);
    if (!order) return { isValid: false, message: 'Order not found' };

    if (order.status !== 'Active') {
      return {
        isValid: false,
        message: `RESTRICTED SUPPLY: Order #${orderId} status is "${order.status}". Concrete supply can ONLY be logged for Active sites.`
      };
    }

    const opp = this.db.getOpportunity(order.opportunity_id);
    if (opp && opp.stage !== 'Won') {
      opp.stage = 'Won';
      opp.updated_at = new Date().toISOString();
      this.db.save();
    }

    const proposedTotal = order.delivered_volume_m3 + Number(newDeliveryChunk);
    let autoCorrected = false;
    let cleanBatch = Number(newDeliveryChunk);
    let cleanTotal = proposedTotal;
    let correctionMsg = null;

    if (proposedTotal > order.confirmed_volume_m3) {
      autoCorrected = true;
      cleanTotal = order.confirmed_volume_m3;
      cleanBatch = Math.max(0, order.confirmed_volume_m3 - order.delivered_volume_m3);
      const overflow = proposedTotal - order.confirmed_volume_m3;
      correctionMsg = `AUTO-CORRECTION EXECUTED: Logged batch (${newDeliveryChunk}m³) exceeds remaining order limit (${order.confirmed_volume_m3 - order.delivered_volume_m3}m³). Auto-clamped batch delivery to maximum allowed ${cleanBatch}m³ (trimmed +${overflow}m³).`;
    }

    return {
      isValid: true,
      autoCorrected,
      cleanBatch,
      cleanTotal,
      correctionMsg
    };
  }

  /**
   * RULE 3: Stage Won -> Auto Create Order
   */
  handleStageChangeToWon(opportunityId) {
    const opp = this.db.getOpportunity(opportunityId);
    if (!opp) return null;

    let existingOrder = this.db.getOrderByOpp(opportunityId);
    if (existingOrder) return existingOrder;

    const quote = this.db.getQuotationByOpp(opportunityId);
    const unitPrice = quote ? quote.price_per_m3 : (opp.expected_value_lkr / opp.expected_volume_m3);
    const totalRev = opp.expected_volume_m3 * unitPrice;

    const newOrder = this.db.addOrder({
      opportunity_id: opp.id,
      customer_name: opp.customer_name,
      sales_officer: opp.sales_officer,
      confirmed_volume_m3: opp.expected_volume_m3,
      delivered_volume_m3: 0,
      unit_price_lkr: unitPrice,
      total_revenue_lkr: totalRev,
      status: 'Active'
    });

    this.db.logActivity(
      'AUTO_CREATE_ORDER',
      'System Rules Engine',
      `AUTOMATION RULE 3: Auto-created Order #${newOrder.id} for "${opp.customer_name}" (${opp.expected_volume_m3}m³ @ LKR ${unitPrice.toLocaleString()}/m³)`
    );

    return newOrder;
  }
}

window.rulesEngine = new RulesEngine(window.db, window.pricingEngine);
