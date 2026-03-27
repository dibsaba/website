/**
 * @fileoverview GuardrailEngine - Enforces clinical constraints using Ontological Inheritance and Compound Logic.
 */
export default class GuardrailEngine {
		synthesizeDeadlockClosures(schemaData) {
        // Define the domains that, if fully exhausted, render the form un-savable.
        const requiredFields =[
            "Specific_Target", "Teaching_Formats", "Prompt_Levels", 
            "Reinforcement_Schedules", "Specific_Setting", 
            "Target_Behaviors", "Antecedents", "Intensity", "Deescalation_Time"
        ];

        const synthesizedRules =[];

        requiredFields.forEach(field => {
            if (!schemaData[field]) return;

            // 1. Flatten the schema options for this field (handles flat arrays & optgroups)
            let allOptions = [];
            if (Array.isArray(schemaData[field])) {
                allOptions = schemaData[field];
            } else {
                Object.values(schemaData[field]).forEach(group => allOptions.push(...group));
            }
            if (allOptions.length === 0) return;

            // 2. Map each EXCLUDES rule to its "Strike Set"
            const ruleStrikes =[];
            this.rules.forEach(rule => {
                if (rule.op === 'EXCLUDES') {
                    // Find all options in this field that the rule would disable
                    const struckOptions = allOptions.filter(opt => {
                        let optState = new Set([opt]);
                        if (this.itemTraits[opt]) {
                            this.itemTraits[opt].forEach(t => optState.add(t));
                        }
                        // Use the engine's native logic to see if the rule hits this option
                        return this.evaluateCondition(rule.right, optState);
                    });

                    if (struckOptions.length > 0) {
                        ruleStrikes.push({
                            antecedent: rule.left,
                            strikes: new Set(struckOptions)
                        });
                    }
                }
            });

            // 3. Find pairs of conditions that perfectly cover all options (Set Cover)
            for (let i = 0; i < ruleStrikes.length; i++) {
                for (let j = i + 1; j < ruleStrikes.length; j++) {
                    const combined = new Set([...ruleStrikes[i].strikes, ...ruleStrikes[j].strikes]);
                    
                    if (combined.size === allOptions.length) {
                        // 4. Synthesize the Closure Rule!
                        synthesizedRules.push({
                            citation: "Synthesized Closure Principle",
                            rationale: `Selecting these conditions simultaneously exhausts all valid options for the required field: ${field}.`,
                            op: "EXCLUDES",
                            left: ruleStrikes[i].antecedent,
                            right: ruleStrikes[j].antecedent,
                            scope: "GLOBAL" // Ensures it works across form states
                        });
                    }
                }
            }
        });

        // 5. Append the newly deduced logic to the engine
        this.rules = this.rules.concat(synthesizedRules);
        console.log(`[Guardrail Engine] Synthesized ${synthesizedRules.length} closure rules.`, synthesizedRules);
    }
    
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

        const engine = new GuardrailEngine(rulesData, schemaData);
        
        // Compute the logical closure before returning the engine to the app
        engine.synthesizeDeadlockClosures(schemaData);
        
        return engine;
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

		// Computes the mathematical closure of all REQUIRES relationships for a given state
    applyRequiresClosure(stateArray) {
        let closure = new Set(stateArray);
        let addedNew = true;

        // Keep looping until we stop finding new requirements (resolves chained requirements A->B->C)
        while (addedNew) {
            addedNew = false;
            for (const rule of this.rules) {
                if (rule.op === 'REQUIRES') {
                    // If the Left condition is met, but the Right is missing...
                    if (this.evaluateCondition(rule.left, closure) && !closure.has(rule.right)) {
                        closure.add(rule.right);
                        addedNew = true;
                    }
                }
            }
        }
        return Array.from(closure);
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