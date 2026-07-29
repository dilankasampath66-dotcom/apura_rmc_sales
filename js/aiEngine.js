/**
 * AI Recommendation Engine
 * Analyzes customer profiles, project sizes, stage timeline, and pricing strategy
 * to calculate closure probability and generate tactical sales recommendations.
 */

class AIEngine {
  /**
   * Analyze an opportunity and produce smart actionable AI insights
   */
  analyzeOpportunity(opp, quotation) {
    if (!opp) return null;

    let baseProb = opp.probability || 50;

    // 1. Customer Type factor
    const visit = window.db.getVisits().find(v => v.id === opp.visit_id);
    const customerType = visit ? visit.customer_type : 'Commercial';
    const projectSize = opp.expected_volume_m3 || 100;

    if (customerType === 'Infrastructure') baseProb += 10;
    if (customerType === 'Commercial') baseProb += 5;

    // 2. Project size weight
    if (projectSize > 500) baseProb += 5; // Large strategic deal

    // 3. Time in pipeline
    const daysInStage = opp.updated_at 
      ? Math.max(0, Math.floor((new Date() - new Date(opp.updated_at)) / (1000 * 3600 * 24)))
      : 1;
    
    if (daysInStage > 5) baseProb -= 15;
    else if (daysInStage <= 2) baseProb += 5;

    // 4. Pricing competitiveness
    let priceAdj = 0;
    let priceCompetitivenessScore = 0;
    if (quotation) {
      if (quotation.price_per_m3 > 30000) {
        priceAdj = -500; // Suggest small discount for premium pricing
        priceCompetitivenessScore = -5;
      } else if (quotation.price_per_m3 < 26000) {
        priceAdj = 250; // Competitively priced
        priceCompetitivenessScore = +10;
      }
    }

    const calculatedProb = Math.min(95, Math.max(15, baseProb + priceCompetitivenessScore));

    // Generate Next Action & Advice
    let action = '';
    let recommendation = '';

    if (calculatedProb >= 75) {
      action = 'Close Deal Immediately';
      const adjText = priceAdj < 0 ? `Reduce price by LKR ${Math.abs(priceAdj)}/m³ and ` : '';
      recommendation = `High chance (${calculatedProb}%) to close. ${adjText}follow up within 24 hours to secure purchase order.`;
    } else if (calculatedProb >= 50) {
      action = 'Offer Value Addition';
      recommendation = `Moderate closure probability (${calculatedProb}%). Offer free pump setup consultation or flexible batch delivery schedules.`;
    } else {
      action = 'Re-evaluate Pricing / Re-engage';
      recommendation = `Low closure probability (${calculatedProb}%). Schedule an in-person site meeting with plant manager to address competitor quotes.`;
    }

    return {
      opportunityId: opp.id,
      customerName: opp.customer_name,
      customerType,
      projectSize,
      daysInStage,
      calculatedProb,
      suggestedAction: action,
      recommendedPriceAdjLKR: priceAdj,
      recommendationText: recommendation
    };
  }

  /**
   * Generates real-time AI banner recommendations for all active deals
   */
  generatePipelineSummary() {
    const opps = window.db.getOpportunities().filter(o => o.stage !== 'Won' && o.stage !== 'Lost');
    const analyses = opps.map(opp => {
      const q = window.db.getQuotationByOpp(opp.id);
      return this.analyzeOpportunity(opp, q);
    });

    const highWinDeals = analyses.filter(a => a.calculatedProb >= 70);
    const staleDeals = analyses.filter(a => a.daysInStage >= 3);

    return {
      totalActiveDeals: opps.length,
      highWinDealsCount: highWinDeals.length,
      staleDealsCount: staleDeals.length,
      topInsights: analyses.slice(0, 3)
    };
  }
}

window.aiEngine = new AIEngine();
