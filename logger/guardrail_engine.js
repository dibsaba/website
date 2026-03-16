/**
 * @fileoverview GuardrailEngine - Enforces clinical constraints based on function.
 */
export default class GuardrailEngine {
    constructor(rulesData) {
        this.rules = rulesData.Function_Based_Guardrails ||[];
    }

    // Returns the strict whitelist and blacklist for a given antecedent
    getRulesForAntecedent(antecedent) {
        return this.rules.find(r => r.antecedent === antecedent) || {
            whitelisted_interventions: [],
            blacklisted_interventions:[]
        };
    }

    // Validates if an array of selected interventions contains a blacklisted item
    validateInterventions(antecedent, selectedInterventions) {
        const rules = this.getRulesForAntecedent(antecedent);
        const violations = selectedInterventions.filter(i => rules.blacklisted_interventions.includes(i));
        return {
            isValid: violations.length === 0,
            violations: violations
        };
    }
}