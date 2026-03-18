/**
 * @fileoverview GuardrailEngine - Enforces clinical constraints based on configuration data.
 */
export default class GuardrailEngine {
    constructor(rulesData) {
        this.functionRules = rulesData.Function_Based_Guardrails ||[];
        this.contradictionRules = rulesData.Contradiction_Guardrails ||[];
        this.exclusiveChoices = rulesData.Exclusive_Choices ||[];
        this.mutuallyExclusiveGroups = rulesData.Mutually_Exclusive_Groups ||[];
        this.fieldLimits = rulesData.Field_Limits || { default_max: 4 };
    }

    // 1. Function-Based Guardrails
    getRulesForAntecedent(antecedent) {
        return this.functionRules.find(r => r.antecedent === antecedent) || {
            whitelisted_interventions: [],
            blacklisted_interventions:[]
        };
    }

    // 2. Is this option mutually exclusive to everything else? (e.g., "None")
    isExclusiveChoice(val) {
        return this.exclusiveChoices.includes(val);
    }

    // 3. Are there other specific options this conflicts with? (e.g., DRA vs DRO)
    getMutuallyExclusivePeers(val) {
        const group = this.mutuallyExclusiveGroups.find(g => g.includes(val));
        if (group) return group.filter(item => item !== val);
        return[];
    }

    // 4. What is the max allowed checkboxes for this specific field?
    getMaxSelections(fieldId) {
        return this.fieldLimits[fieldId] || this.fieldLimits.default_max || 4;
    }

    // 5. What fields should be disabled based on a dropdown selection? (e.g., Behavior: None)
    getContradictionActions(triggerCategory, triggerValue) {
        return this.contradictionRules.filter(r => 
            r.trigger_category === triggerCategory && r.trigger_value === triggerValue
        );
    }
}