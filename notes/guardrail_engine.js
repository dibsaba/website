/**
 * @fileoverview GuardrailEngine - Hybrid Engine combining O(1) Markdown Bit-Matrices with dynamic Compound Logic.
 */
export default class GuardrailEngine {
    
    static async build(schemaData) {
        const cb = "?v=" + new Date().getTime();
        
        // 1. Fetch the Ontology directly from root
        const ontologyRes = await fetch("ontology.json" + cb);
        const ontologyData = await ontologyRes.json();
        
        // 2. Fetch Legacy configs directly from root
        const legacyRes = await fetch("legacy_config.json" + cb);
        const legacyData = await legacyRes.json();

        // 3. Fetch the new Doc-as-Code Markdown Matrix
        const rulesRes = await fetch("Compiled_Clinical_Rules.md" + cb);
        const rulesText = await rulesRes.text();

        // Construct the final data object
        const configData = {
            Traits: ontologyData,
            ...legacyData
        };

        const engine = new GuardrailEngine(configData, schemaData);
        engine.parseMarkdownRules(rulesText);
        
        return engine;
    }

    constructor(configData, schemaData) {
        this.domainOverrides = configData.Domain_Overrides || [];
        this.fieldLimits = configData.Field_Limits || { default_max: 4 };
        this.locationSettings = configData.Location_Settings || null;
        this.conditionalLimits = configData.Conditional_Field_Limits || [];
        this.inputConstraints = configData.Input_Constraints || { custom_chip_max_words: 8, custom_chip_min_chars: 3 };
        this.contradictionActions = configData.Contradiction_Actions || [];
        this.exclusiveChoices = configData.Exclusive_Choices || [];
        this.functionRules = this.domainOverrides.map(override => ({
            antecedent: override.triggerValue,
            whitelisted_interventions: override.allowed,
            blacklisted_interventions: schemaData && schemaData.Interventions 
                ? schemaData.Interventions.filter(i => !override.allowed.includes(i)) 
                : []
        }));

        // --- Matrix Engine State ---
        this.categories = [];
        this.catToIdx = {};
        this.reqMatrix = [];
        this.exclMatrix = [];
        this.rationales = {};

        // --- Ontology Mapping ---
        this.itemTraits = {};
        if (configData.Traits) {
            for (const [trait, items] of Object.entries(configData.Traits)) {
                items.forEach(item => {
                    if (!this.itemTraits[item]) this.itemTraits[item] = [];
                    if (!this.itemTraits[item].includes(trait)) this.itemTraits[item].push(trait);
                });
            }
        }

        // Ontological Subsumption via Trait Intersection
        if (schemaData) {
            const itemParents = {};
            for (const key of Object.keys(schemaData)) {
                const group = schemaData[key];
                if (group && typeof group === 'object' && !Array.isArray(group)) {
                    for (const [parent, children] of Object.entries(group)) {
                        if (Array.isArray(children)) {
                            children.forEach(child => {
                                if (!itemParents[child]) itemParents[child] = new Set();
                                itemParents[child].add(parent);
                            });
                        }
                    }
                }
            }
            for (const [child, parents] of Object.entries(itemParents)) {
                let intersectedTraits = null;
                parents.forEach(parent => {
                    const parentTraits = new Set(this.itemTraits[parent] || []);
                    if (!intersectedTraits) {
                        intersectedTraits = new Set(parentTraits);
                    } else {
                        for (const t of intersectedTraits) {
                            if (!parentTraits.has(t)) intersectedTraits.delete(t);
                        }
                    }
                });
                if (intersectedTraits && intersectedTraits.size > 0) {
                    if (!this.itemTraits[child]) this.itemTraits[child] = [];
                    intersectedTraits.forEach(t => {
                        if (!this.itemTraits[child].includes(t)) {
                            this.itemTraits[child].push(t);
                        }
                    });
                }
            }
        }
    }

    parseMarkdownRules(markdownText) {
        const lines = markdownText.split('\n');
        let currentCatIdx = -1;

        const catSet = new Set();
        lines.forEach(line => {
            const match = line.match(/^## \[([^\]]+)\]/);
            if (match) catSet.add(match[1]);
        });
        
        this.categories = Array.from(catSet).sort();
        this.categories.forEach((cat, idx) => {
            this.catToIdx[cat] = idx;
            this.reqMatrix[idx] = new Uint8Array(this.categories.length);
            this.exclMatrix[idx] = new Uint8Array(this.categories.length);
        });

        lines.forEach(line => {
            const catMatch = line.match(/^## \[([^\]]+)\]/);
            if (catMatch) {
                currentCatIdx = this.catToIdx[catMatch[1]];
                return;
            }

            if (currentCatIdx > -1) {
                const reqMatch = line.match(/^\* REQ: \[([^\]]+)\] \| (.*)/);
                if (reqMatch) {
                    const targetIdx = this.catToIdx[reqMatch[1]];
                    if (targetIdx !== undefined) this.reqMatrix[currentCatIdx][targetIdx] = 1;
                    return;
                }

                const excMatch = line.match(/^\* EXC: \[([^\]]+)\] \| (.*)/);
                if (excMatch) {
                    const targetIdx = this.catToIdx[excMatch[1]];
                    if (targetIdx !== undefined) {
                        this.exclMatrix[currentCatIdx][targetIdx] = 1;
                        const keyA = Math.min(currentCatIdx, targetIdx);
                        const keyB = Math.max(currentCatIdx, targetIdx);
                        this.rationales[`EXC_${keyA}_${keyB}`] = excMatch[2].trim();
                    }
                }
            }
        });
        console.log(`[Guardrail Engine] Loaded Matrix with ${this.categories.length} categories.`);
    }

    // Maps raw UI strings to ontology tags, then applies Matrix requirement closure
    expandRequiredState(stateArray, availableFormValues = null) {
        let expandedState = new Set(stateArray);
        
        stateArray.forEach(item => {
            if (this.itemTraits[item]) {
                this.itemTraits[item].forEach(trait => expandedState.add(trait));
            }
        });

        let addedNew = true;
        while (addedNew) {
            addedNew = false;
            const currentItems = Array.from(expandedState);
            
            currentItems.forEach(item => {
                const idx = this.catToIdx[item];
                if (idx !== undefined) {
                    for (let j = 0; j < this.categories.length; j++) {
                        if (this.reqMatrix[idx][j] === 1) {
                            const requiredCat = this.categories[j];
                            if (!expandedState.has(requiredCat)) {
                                expandedState.add(requiredCat);
                                addedNew = true;
                            }
                        }
                    }
                }
            });
        }
        return Array.from(expandedState);
    }

    validateSubset(validationType, selectedSubset) {
        const state = this.expandRequiredState(selectedSubset);
        
        // 1. O(S^2) FAST MATRIX CHECK
        for (let i = 0; i < state.length; i++) {
            for (let j = i + 1; j < state.length; j++) {
                const idxA = this.catToIdx[state[i]];
                const idxB = this.catToIdx[state[j]];
                
                if (idxA === undefined || idxB === undefined) continue;
                
                if (this.exclMatrix[idxA][idxB] === 1 || this.exclMatrix[idxB][idxA] === 1) {
                    const keyA = Math.min(idxA, idxB);
                    const keyB = Math.max(idxA, idxB);
                    return { 
                        valid: false, 
                        contradiction: `Cannot combine '${state[i]}' and '${state[j]}'`,
                        ruleFailed: { rationale: this.rationales[`EXC_${keyA}_${keyB}`] } 
                    };
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
        return rule ? rule.actions : [];
    }
    getAllowedSettings(loc) { return this.locationSettings ? this.locationSettings[loc] : null; }
    getAvailableTransitions(loc, cur) { const allowed = this.getAllowedSettings(loc); return allowed ? allowed.filter(s => s !== cur) : []; }
    getMaxSelections(fieldId, formState = {}) {
        let max = this.fieldLimits[fieldId] !== undefined ? this.fieldLimits[fieldId] : (this.fieldLimits.default_max || 4);
        const condition = this.conditionalLimits.find(c => c.target_field === fieldId && formState[c.trigger_field] === c.trigger_value);
        if (condition) max = condition.max_allowed;
        return max;
    }
    auditSession() { return []; }
}