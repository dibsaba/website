/**
 * @fileoverview GuardrailEngine - Enforces clinical constraints using Ontological Inheritance and Compound Logic.
 */
export default class GuardrailEngine {
		// Asynchronous builder that parses the Manifest and merges all the rule files
    static async build(manifestUrl, schemaData) {
        // 1. Fetch the manifest
        const cb = "?v=" + new Date().getTime(); // Cache buster
        const manifestRes = await fetch(manifestUrl + cb);
        const manifest = await manifestRes.json();
        
        // 2. Fetch the Ontology
        const ontologyRes = await fetch(manifest.ontology + cb);
        const ontologyData = await ontologyRes.json();
        
        // 3. Fetch all Rule Sources in parallel
        const rulePromises = manifest.rule_sources.map(src => fetch(src + cb).then(res => res.json()));
        const ruleFiles = await Promise.all(rulePromises);
        
        // 4. Merge all rules into a single array
        let combinedRules =[];
        ruleFiles.forEach(file => {
            // Extract the "rule" object from the citation wrappers
            const rules = file.map(entry => entry.rule);
            combinedRules = combinedRules.concat(rules);
        });

        // 5. Fetch Legacy configs (Field Limits, Domain Overrides, etc.)
        const legacyRes = await fetch(manifest.legacy_config + cb);
        const legacyData = await legacyRes.json();

        // 6. Construct the final data object for the Engine
        const rulesData = {
            Traits: ontologyData,
            ACCL_Rules: combinedRules,
            ...legacyData
        };

        return new GuardrailEngine(rulesData, schemaData);
    }

    constructor(rulesData, schemaData) {
        this.rules = rulesData.ACCL_Rules ||[];
        this.domainOverrides = rulesData.Domain_Overrides ||[];
        this.fieldLimits = rulesData.Field_Limits || { default_max: 4 };
        this.locationSettings = rulesData.Location_Settings || null;
        this.conditionalLimits = rulesData.Conditional_Field_Limits ||[];
				this.inputConstraints = rulesData.Input_Constraints || { custom_chip_max_words: 8, custom_chip_min_chars: 3 };
				this.contradictionActions = rulesData.Contradiction_Actions ||[];
				this.exclusiveChoices = rulesData.Exclusive_Choices ||[];
        this.functionRules = this.domainOverrides.map(override => ({
            antecedent: override.triggerValue,
            whitelisted_interventions: override.allowed,
            blacklisted_interventions:[] 
        }));

        // Build the Ontological Trait Map (The "IS_A" relationships)
        this.itemTraits = {};
        if (rulesData.Traits) {
            for (const [trait, items] of Object.entries(rulesData.Traits)) {
                items.forEach(item => {
                    this.assignTrait(item, trait, schemaData);
                });
            }
        }
    }

    // Maps traits to specific items, and dynamically inherits traits from schema categories
    assignTrait(item, trait, schemaData) {
        if (!this.itemTraits[item]) this.itemTraits[item] = [];
        if (!this.itemTraits[item].includes(trait)) this.itemTraits[item].push(trait);

        // Subsumption: If the item is a category in the schema (e.g., "Academic Readiness"),
        // automatically apply the trait to all of its children (e.g., "Tracing letters").
        if (schemaData) {
            for (const key of Object.keys(schemaData)) {
                if (schemaData[key] && schemaData[key][item] && Array.isArray(schemaData[key][item])) {
                    schemaData[key][item].forEach(child => {
                        if (!this.itemTraits[child]) this.itemTraits[child] =[];
                        if (!this.itemTraits[child].includes(trait)) this.itemTraits[child].push(trait);
                    });
                }
            }
        }
    }

    // Evaluates strings or Compound Logic (ALL_OF, ANY_OF, NONE_OF) against the hydrated state
    evaluateCondition(condition, stateSet) {
        if (typeof condition === 'string') {
            return stateSet.has(condition);
        }
        if (Array.isArray(condition)) {
            // Implicit ANY_OF for arrays
            return condition.some(c => this.evaluateCondition(c, stateSet));
        }
        if (typeof condition === 'object') {
            if (condition.ALL_OF) {
                return condition.ALL_OF.every(c => this.evaluateCondition(c, stateSet));
            }
            if (condition.ANY_OF) {
                return condition.ANY_OF.some(c => this.evaluateCondition(c, stateSet));
            }
            if (condition.NONE_OF) {
                return condition.NONE_OF.every(c => !this.evaluateCondition(c, stateSet));
            }
        }
        return false;
    }

    validateSubset(validationType, selectedSubset) {
        let expandedState = new Set(selectedSubset);
        selectedSubset.forEach(item => {
            if (this.itemTraits[item]) {
                this.itemTraits[item].forEach(trait => expandedState.add(trait));
            }
        });

        for (const rule of this.rules) {
            const isGlobalRule = rule.scope === "GLOBAL";
            
            // Local form validation skips global timeline rules. 
            // BUT Global validation evaluates EVERYTHING.
            if (validationType !== "Global" && isGlobalRule) {
                continue; 
            }

            // --- NEW: EXTENDED EXCLUSION OPERATOR (List of any length) ---
            if (rule.op === 'MUTEX_GROUP') {
                let matchCount = 0;
                // Count how many items from the mutually exclusive list are currently in the state
                for (const item of rule.items) {
                    if (this.evaluateCondition(item, expandedState)) matchCount++;
                }
                // If more than 1 item from the list is true, it's a contradiction
                if (matchCount > 1) return { valid: false, ruleFailed: rule };
                continue; 
            }
            // -------------------------------------------------------------

            const leftTrue = this.evaluateCondition(rule.left, expandedState);
            if (leftTrue) {
                if (rule.op === 'EXCLUDES' || rule.op === 'MUTEX') {
                    const rightTrue = this.evaluateCondition(rule.right, expandedState);
                    if (rightTrue) return { valid: false, ruleFailed: rule };
                } else if (rule.op === 'REQUIRES') {
                    const rightTrue = this.evaluateCondition(rule.right, expandedState);
                    if (!rightTrue) return { valid: false, ruleFailed: rule };
                }
            }
        }
        return { valid: true };
    }

    // --- Legacy Passthrough Methods for UI Compatibility ---
    getRulesForAntecedent(antecedent) { return this.functionRules.find(r => r.antecedent === antecedent) || { whitelisted_interventions: [], blacklisted_interventions:[] }; }
    isExclusiveChoice(val) { return this.exclusiveChoices.includes(val); }
    getContradictionActions(cat, val) { 
				const rule = this.contradictionActions.find(r => r.trigger_category === cat && r.trigger_value === val);
				return rule ? rule.actions :[];
		}
    getAllowedSettings(loc) { return this.locationSettings ? this.locationSettings[loc] : null; }
    getAvailableTransitions(loc, cur) { const allowed = this.getAllowedSettings(loc); return allowed ? allowed.filter(s => s !== cur) :[]; }
    getMaxSelections(fieldId, formState = {}) {
				let max = this.fieldLimits[fieldId] !== undefined ? this.fieldLimits[fieldId] : (this.fieldLimits.default_max || 4);
				
				// Evaluate conditional limits (e.g., if Deescalation_Time === '< 1 minute', Interventions max = 2)
				const condition = this.conditionalLimits.find(c => c.target_field === fieldId && formState[c.trigger_field] === c.trigger_value);
				if (condition) max = condition.max_allowed;
		
				return max;
		}
    auditSession() { return[]; }
}