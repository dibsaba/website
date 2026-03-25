/**
 * @fileoverview GuardrailEngine - Enforces clinical constraints using Minimal Cutsets.
 */
export default class GuardrailEngine {
    constructor(rulesData, schemaData) {
        this.functionRules = rulesData.Function_Based_Guardrails ||[];
        this.contradictionRules = rulesData.Contradiction_Guardrails ||[];
        this.exclusiveChoices = rulesData.Exclusive_Choices || [];
        this.sessionLimits = rulesData.Session_Limits ||[];
        this.locationSettings = rulesData.Location_Settings || null;
        this.fieldLimits = rulesData.Field_Limits || { default_max: 4 }; 
        
        // The unified compiler handles all rules, allowing the DSL everywhere
        this.compileAllCutsets(rulesData.Invalid_Combinations || {}, schemaData);
    }
    
    // Compiles ALL custom semantic categories into a single, flat Global array
    compileAllCutsets(invalidCombosDict, schemaData) {
        this.invalidCombinations = { Global:[] };
        if (!invalidCombosDict) return;
        
        // 1. Build category map for 'CAT:' tags
        const categoryMap = {};
				if (schemaData) {
						for (const key in schemaData) {
								const field = schemaData[key];
								if (typeof field === 'object' && !Array.isArray(field)) {
										let topLevelItems = []; // <--- NEW
										for (const cat in field) {
												categoryMap[`CAT:${cat}`] = field[cat];
												topLevelItems.push(...field[cat]); // <--- NEW
										}
										// Add the parent object itself (e.g., CAT:Caregiver_Response)
										categoryMap[`CAT:${key}`] = topLevelItems; // <--- NEW
								}
						}
				}

        // Helper: Resolves strings, CAT: tags, or nested arrays into flat arrays
        const resolveToSet = (item) => {
						if (Array.isArray(item)) {
								return item.flatMap(resolveToSet);
						} else if (typeof item === 'string' && item.startsWith('CAT:')) {
								const parts = item.split(':');
								const catName = parts[parts.length - 1]; 
								
								// FIXED: Fallback to the literal string so the rule isn't mathematically wiped out 
								// if it points to a standard dropdown value instead of a dictionary category.
								return categoryMap[`CAT:${catName}`] || [catName]; 
						} else {
								return [item];
						}
				};

        // Cartesian product generator
        const cartesian = (arrays) => {
            return arrays.reduce((a, b) => 
                a.flatMap(d => b.map(e => [...d, e])),
                [[]]
            );
        };

        // 2. Iterate through EVERY semantic grouping in the JSON
        for (const groupKey in invalidCombosDict) {
            const ruleArray = invalidCombosDict[groupKey];
            if (!Array.isArray(ruleArray)) continue;

            ruleArray.forEach(rule => {
                const sets = rule.map(resolveToSet);
                const products = cartesian(sets);
                products.forEach(p => {
                    this.invalidCombinations.Global.push(p);
                });
            });
        }
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
    
    getAvailableTransitions(currentLocation, currentSetting) {
        const allowed = this.getAllowedSettings(currentLocation);
        if (!allowed) return[]; // Fallback if location isn't set yet
        
        // The Guardrail: Return all allowed settings EXCEPT the one they are currently in
        return allowed.filter(setting => setting !== currentSetting);
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