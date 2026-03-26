/**
 * @fileoverview GuardrailEngine - Enforces clinical constraints using ACCL (ABA Clinical Constraint Logic).
 */
export default class GuardrailEngine {
    constructor(rulesData, schemaData) {
        this.sets = rulesData.Sets || {};
        this.rules = rulesData.ACCL_Rules ||[];
        this.domainOverrides = rulesData.Domain_Overrides ||[];
        this.fieldLimits = rulesData.Field_Limits || { default_max: 4 };
        this.locationSettings = rulesData.Location_Settings || null;
        
        // Preserve legacy overrides so index.html works without modification
        this.exclusiveChoices = rulesData.Exclusive_Choices ||[
            "Caregiver unavailable", "None", "None reported", "displaying an absence of maladaptive behavior"
        ];
        
        // Convert Domain Overrides into the format the UI expects for whitelist filtering
        this.functionRules = this.domainOverrides.map(override => ({
            antecedent: override.triggerValue,
            whitelisted_interventions: override.allowed,
            blacklisted_interventions:[] 
        }));
    }

    // DSL HELPER: Checks if the state intersects with an ACCL definition (Set name or raw string)
    hasIntersection(conditionArray, state) {
        for (const item of conditionArray) {
            if (this.sets[item]) {
                // If it's a Set, check if any member of the Set is in the current state
                if (this.sets[item].some(val => state.includes(val))) return true;
            } else {
                // If it's a raw string, check if it's in the current state
                if (state.includes(item)) return true;
            }
        }
        return false;
    }

    // THE CORE ENGINE: Replaces the Cartesian Product "validateSubset"
    validateSubset(fieldId, selectedSubset) {
        // Evaluate the proposed state against the ACCL Logic
        for (const rule of this.rules) {
            const hasLeft = this.hasIntersection(rule.left, selectedSubset);
            
            // For EXCLUDES and MUTEX operators, if both sides exist, the state is invalid
            if (rule.op === 'EXCLUDES' || rule.op === 'MUTEX') {
                const hasRight = this.hasIntersection(rule.right, selectedSubset);
                if (hasLeft && hasRight) {
                    return { valid: false, ruleFailed: rule };
                }
            }
        }
        return { valid: true };
    }

    getRulesForAntecedent(antecedent) {
        return this.functionRules.find(r => r.antecedent === antecedent) || { whitelisted_interventions: [], blacklisted_interventions:[] };
    }

    isExclusiveChoice(val) {
        return this.exclusiveChoices.includes(val);
    }

    getContradictionActions(triggerCategory, triggerValue) {
        // UI lockouts for when "None" is selected
        if (triggerCategory === "Target_Behaviors" && triggerValue === "None") {
            return[
                { target_category: "Intensity", action: "disable_all" },
                { target_category: "Antecedents", action: "disable_all" },
                { target_category: "Interventions", action: "disable_all" },
                { target_category: "Deescalation_Time", action: "disable_all" }
            ];
        }
        return[];
    }

    getAllowedSettings(location) {
        if (!this.locationSettings || !this.locationSettings[location]) return null;
        return this.locationSettings[location];
    }
    
    getAvailableTransitions(currentLocation, currentSetting) {
        const allowed = this.getAllowedSettings(currentLocation);
        if (!allowed) return[]; 
        return allowed.filter(setting => setting !== currentSetting);
    }
    
    getMaxSelections(fieldId) {
        if (this.fieldLimits[fieldId] !== undefined) {
            return this.fieldLimits[fieldId];
        }
        return this.fieldLimits.default_max || 4;
    }

    auditSession(timeline) {
        return[]; // Audits are inherently handled live by the ACCL engine now.
    }
}