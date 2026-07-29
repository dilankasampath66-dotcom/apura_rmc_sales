/**
 * Self-Improvement Mode Engine
 * Monitors user error logs, tracks user friction patterns, and automatically simplifies forms
 * (e.g. auto-locking manual price fields when manual errors occur repeatedly).
 */

class SelfImprovementEngine {
  constructor() {
    this.pricingErrorCount = 0;
    this.priceFieldLocked = false;
    this.simplifiedVisitsForm = false;
    this.suggestions = [];
  }

  /**
   * Log a user error event and evaluate improvement thresholds
   */
  recordUserError(errorType, details) {
    if (errorType === 'PRICING_MANUAL_MISMATCH') {
      this.pricingErrorCount++;
      if (this.pricingErrorCount >= 2 && !this.priceFieldLocked) {
        this.priceFieldLocked = true;
        this.suggestions.push({
          id: Date.now(),
          type: 'AUTO_LOCK_PRICE',
          title: 'Auto-Lock Price Field Activated',
          description: `Users attempted manual price overrides with formula errors ${this.pricingErrorCount} times. Price field is now auto-locked & calculated to guarantee 100% pricing accuracy.`
        });
        window.db.logActivity(
          'SELF_IMPROVEMENT_TRIGGERED',
          'SelfImprovementEngine',
          'Auto-locked Quotation price field due to repeated manual pricing mismatch errors.'
        );
      }
    }
  }

  /**
   * Toggle auto-lock feature explicitly
   */
  setPriceLock(locked) {
    this.priceFieldLocked = locked;
    window.db.logActivity(
      'SELF_IMPROVEMENT_TOGGLE',
      'User',
      `Manual Price Field Auto-Lock toggled to ${locked ? 'ENABLED' : 'DISABLED'}`
    );
  }

  getActiveSuggestions() {
    return this.suggestions;
  }
}

window.selfImprovementEngine = new SelfImprovementEngine();
