/**
 * @fileoverview GuardrailEngine - Enforces clinical constraints using Minimal Cutsets.
 */
export default class GuardrailEngine {
    constructor(rulesData) {
        this.functionRules = rulesData.Function_Based_Guardrails ||[];
        this.contradictionRules = rulesData.Contradiction_Guardrails ||[];
        this.exclusiveChoices = rulesData.Exclusive_Choices ||[];
        this.invalidCombinations = rulesData.Invalid_Combinations || {};
        this.sessionLimits = rulesData.Session_Limits ||[];
        this.locationSettings = rulesData.Location_Settings || null;
        this.fieldLimits = rulesData.Field_Limits || { default_max: 4 }; 
    }

    getRulesForAntecedent(antecedent) {
        return this.functionRules.find(r => r.antecedent === antecedent) || { whitelisted_interventions: [], blacklisted_interventions:[] };
    }

    isExclusiveChoice(val) {
        return this.exclusiveChoices.includes(val);
    }

    getContradictionActions(triggerCategory, triggerValue) {
        return this.contradictionRules.filter(r => r.trigger_category === triggerCategory && r.trigger_value === triggerValue);
    }

    getAllowedSettings(location) {
        if (!this.locationSettings || !this.locationSettings[location]) return null;
        return this.locationSettings[location];
    }
    
    getMaxSelections(fieldId) {
        // If a specific limit exists for this field, return it. Otherwise, return the default.
        if (this.fieldLimits[fieldId] !== undefined) {
            return this.fieldLimits[fieldId];
        }
        return this.fieldLimits.default_max || 4;
    }

    // --- MATHEMATICAL CUTSET VALIDATION ---
    // Returns {valid: boolean, cutset:[]} if the selected subset contains an invalid subset F
    validateSubset(fieldId, selectedSubset) {
        if (!this.invalidCombinations[fieldId]) return { valid: true };
        
        const cutsets = this.invalidCombinations[fieldId];
        for (let cutset of cutsets) {
            // Check if the selected array contains every element of this specific invalid cutset
            const containsAll = cutset.every(item => selectedSubset.includes(item));
            if (containsAll) {
                return { valid: false, cutset: cutset };
            }
        }
        return { valid: true };
    }

    // --- SESSION RATIO AUDITOR ---
    auditSession(timeline) {
        const warnings =[];
        this.sessionLimits.forEach(limit => {
            const relevantEvents = timeline.filter(t => t.type === limit.event_type);
            if (relevantEvents.length > 0) {
                const matchCount = relevantEvents.filter(e => {
                    const val = e.data[limit.field];
                    return Array.isArray(val) ? val.includes(limit.value) : val === limit.value;
                }).length;
                
                if ((matchCount / relevantEvents.length) > limit.max_ratio) {
                    warnings.push(limit.warning_message);
                }
            }
        });
        return warnings;
    }
}