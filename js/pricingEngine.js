/**
 * Pricing Engine for Ready Mix Concrete (RMC)
 * Implements exact User-Defined Formulas:
 * 1. Concrete Charge Total = Volume * (Base Price + (max(0, Distance - Free KM) * Truck Mixer Transport Rate))
 * 2. Pump Car Cost = Flat Rate + (max(0, Distance - Free KM) * Pump Car Transport Rate) + (max(0, Volume - Flat Rate m³) * Additional Pumping Charge)
 */

class PricingEngine {
  /**
   * Get pricing configuration from DB
   */
  getPricingConfig() {
    if (window.db && typeof window.db.getPricingConfig === 'function') {
      return window.db.getPricingConfig();
    }
    return {
      free_transport_km: 15,
      truck_mixer_transport_rate_per_km_lkr: 120,
      pump_car_transport_rate_per_km_lkr: 550,
      pump_flat_fee_lkr: 60000,
      pump_base_volume_m3: 30,
      pump_extra_rate_per_m3_lkr: 2000,
      validity_period_days: 2
    };
  }

  /**
   * Get base price for a concrete grade dynamically from DB
   */
  getBasePrice(grade) {
    if (window.db && typeof window.db.getBasePriceForGrade === 'function') {
      return window.db.getBasePriceForGrade(grade);
    }
    const defaults = { M20: 24000, M25: 26000, M30: 28500 };
    return defaults[grade] || 26000;
  }

  /**
   * Calculate precise price breakdown and contract values based on exact user formulas.
   */
  calculatePrice({ concreteGrade, distanceKm, pumpRequired, volumeM3, customerPhone, customerName }) {
    const config = this.getPricingConfig();

    let custRule = null;
    if (window.db) {
      if (customerPhone && typeof window.db.getCustomerPricingRuleByPhone === 'function') {
        custRule = window.db.getCustomerPricingRuleByPhone(customerPhone);
      }
      if (!custRule && customerName && typeof window.db.getCustomerPricingRuleByName === 'function') {
        custRule = window.db.getCustomerPricingRuleByName(customerName);
      }
    }

    const freeKm = (custRule && custRule.free_transport_km !== undefined) ? Number(custRule.free_transport_km) : (Number(config.free_transport_km) || 15);
    const truckMixerRatePerKm = (custRule && custRule.truck_mixer_rate_per_km_lkr !== undefined) ? Number(custRule.truck_mixer_rate_per_km_lkr) : (Number(config.truck_mixer_transport_rate_per_km_lkr) || 120);
    const pumpCarRatePerKm = Number(config.pump_car_transport_rate_per_km_lkr) !== undefined ? Number(config.pump_car_transport_rate_per_km_lkr) : 550;
    
    const pumpFlatFee = (custRule && custRule.pump_flat_fee_lkr !== undefined) ? Number(custRule.pump_flat_fee_lkr) : (Number(config.pump_flat_fee_lkr) || 60000);
    const pumpBaseVol = Number(config.pump_base_volume_m3) !== undefined ? Number(config.pump_base_volume_m3) : 30;
    const pumpExtraRate = (custRule && custRule.pump_extra_rate_per_m3_lkr !== undefined) ? Number(custRule.pump_extra_rate_per_m3_lkr) : (Number(config.pump_extra_rate_per_m3_lkr) || 2000);

    const discountPerM3 = (custRule && custRule.discount_per_m3_lkr) ? Number(custRule.discount_per_m3_lkr) : 0;
    const rawBasePrice = this.getBasePrice(concreteGrade);
    const basePrice = Math.max(0, rawBasePrice - discountPerM3);

    const dist = Math.max(0, Number(distanceKm) || 0);
    const vol = Math.max(0, Number(volumeM3) || 0);

    // 1. Additional Distance beyond Free Transport Limit
    const additionalKm = Math.max(0, dist - freeKm);

    // 2. Concrete Supply Charge Formula:
    const truckTransportRatePerM3 = additionalKm * truckMixerRatePerKm;
    const concretePricePerM3 = basePrice + truckTransportRatePerM3;
    const totalConcreteCost = vol * concretePricePerM3;

    // 3. Pump Car Cost Formula:
    let pumpTransportCost = 0;
    let extraPumpM3 = 0;
    let extraPumpCost = 0;
    let totalPumpCarCost = 0;
    let pumpCostPerM3 = 0;

    if (pumpRequired && vol > 0) {
      pumpTransportCost = additionalKm * pumpCarRatePerKm;
      extraPumpM3 = Math.max(0, vol - pumpBaseVol);
      extraPumpCost = extraPumpM3 * pumpExtraRate;
      totalPumpCarCost = pumpFlatFee + pumpTransportCost + extraPumpCost;
      pumpCostPerM3 = Math.round(totalPumpCarCost / vol);
    }

    // 4. Combined Rate & Total Estimate
    const pricePerM3 = concretePricePerM3 + pumpCostPerM3;
    const totalValue = totalConcreteCost + totalPumpCarCost;

    return {
      basePrice,
      rawBasePrice,
      discountPerM3,
      custRule,
      isCustomRuleApplied: !!custRule,
      freeKm,
      additionalKm,
      truckMixerRatePerKm,
      truckTransportRatePerM3,
      concretePricePerM3,
      totalConcreteCost,
      
      pumpCarRatePerKm,
      pumpFlatFee,
      pumpBaseVol,
      pumpTransportCost,
      extraPumpM3,
      extraPumpCost,
      pumpExtraRate,
      totalPumpCarCost,
      pumpCostPerM3,

      pricePerM3,
      totalValue,
      formula: `Concrete: LKR ${basePrice.toLocaleString()} + LKR ${truckTransportRatePerM3.toLocaleString()} (${additionalKm}km @ LKR ${truckMixerRatePerKm}/km). Pump: LKR ${pumpFlatFee.toLocaleString()} flat + LKR ${pumpTransportCost.toLocaleString()} trans (${additionalKm}km @ LKR ${pumpCarRatePerKm}/km) + LKR ${extraPumpCost.toLocaleString()} (${extraPumpM3}m³ @ LKR ${pumpExtraRate})`
    };
  }

  /**
   * Validates if a custom or user-entered price matches the official formula.
   */
  validateAndAutoCorrect({ concreteGrade, distanceKm, pumpRequired, volumeM3, userPricePerM3 }) {
    const correctCalc = this.calculatePrice({ concreteGrade, distanceKm, pumpRequired, volumeM3 });
    const diff = Math.abs((Number(userPricePerM3) || 0) - correctCalc.pricePerM3);

    const isMatch = diff < 2; // margin of 2 for rounding
    return {
      isValid: isMatch,
      expectedPricePerM3: correctCalc.pricePerM3,
      expectedTotalValue: correctCalc.totalValue,
      correctedCalc: correctCalc,
      discrepancy: diff,
      autoCorrectionMessage: !isMatch 
        ? `PRICING ERROR DETECTED: Entered price LKR ${userPricePerM3}/m³ deviates from formula rule. Auto-recalculated to LKR ${correctCalc.pricePerM3.toLocaleString()}/m³.` 
        : null
    };
  }
}

window.pricingEngine = new PricingEngine();
