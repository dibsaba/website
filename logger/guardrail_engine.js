/**
 * @fileoverview GuardrailEngine - Enforces clinical constraints based on configuration data.
 */
export default class GuardrailEngine {
    constructor(rulesData) {
        this.functionRules = rulesData.Function_Based_Guardrails ||[];
        this.contradictionRules = rulesData.Contradiction_Guardrails || [];
        this.exclusiveChoices = rulesData.Exclusive_Choices ||[];
        this.mutuallyExclusiveGroups = rulesData.Mutually_Exclusive_Groups ||[];
        this.fieldLimits = rulesData.Field_Limits || { default_max: 4 };
        this.locationSettings = rulesData.Location_Settings || null;
    }

    getRulesForAntecedent(antecedent) {
        return this.functionRules.find(r => r.antecedent === antecedent) || {
            whitelisted_interventions: [],
            blacklisted_interventions:[]
        };
    }

    isExclusiveChoice(val) {
        return this.exclusiveChoices.includes(val);
    }

    getMutuallyExclusivePeers(val) {
        const group = this.mutuallyExclusiveGroups.find(g => g.includes(val));
        if (group) return group.filter(item => item !== val);
        return[];
    }

    getMaxSelections(fieldId) {
        return this.fieldLimits[fieldId] || this.fieldLimits.default_max || 4;
    }

    getContradictionActions(triggerCategory, triggerValue) {
        return this.contradictionRules.filter(r => 
            r.trigger_category === triggerCategory && r.trigger_value === triggerValue
        );
    }

    getAllowedSettings(location) {
        if (!this.locationSettings || !this.locationSettings[location]) return null;
        return this.locationSettings[location];
    }
}