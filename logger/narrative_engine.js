/**
 * @fileoverview NarrativeEngine - Generates and sanitizes clinical text deterministically.
 */
export default class NarrativeEngine {
    
    static seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    static generateSeed(planStr) {
        let hash = 0;
        for (let i = 0; i < planStr.length; i++) {
            hash = ((hash << 5) - hash) + planStr.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    static cleanText(val) {
        if (typeof val !== 'string') return val;
        return val.split(' ').map(word => {
            const cleanWord = word.replace(/[(),.]/g, '');
            if (/^[A-Z/-]+$/.test(cleanWord) && cleanWord.length > 0) return word;
            return word.toLowerCase();
        }).join(' ');
    }

    static formatList(dataVal) {
        if (!Array.isArray(dataVal)) return dataVal == null ? "" : this.cleanText(String(dataVal)).replace(/[.!?]+$/, '');
        const clean = dataVal.filter(v => v && v !== "None selected").map(v => this.cleanText(v).replace(/[.!?]+$/, ''));
        if (clean.length === 0) return "";
        if (clean.length === 1) return clean[0];
        if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
        const last = clean.pop();
        return `${clean.join(", ")}, and ${last}`;
    }

    static generate(synonyms, templates, plan) {
        const paragraphParts =[];
        let currentSeed = this.generateSeed(JSON.stringify(plan)); 
        const usedSynonyms = new Set();

        const getElement = (arr) => {
            if (!Array.isArray(arr) || arr.length === 0) return "";
            const index = Math.floor(this.seededRandom(currentSeed++) * arr.length);
            return arr[index];
        };

        const getUniqueSynonym = (options) => {
            if (!Array.isArray(options) || options.length === 0) return "";
            for (let j = 0; j < 10; j++) {
                const candidate = getElement(options);
                if (!usedSynonyms.has(candidate)) {
                    usedSynonyms.add(candidate);
                    return candidate;
                }
            }
            return getElement(options); 
        };

        for (let i = 0; i < plan.length; i++) {
            const { section, data } = plan[i];
            const availableTemplates = templates[section];
            if (!Array.isArray(availableTemplates) || availableTemplates.length === 0) continue;

            let sentence = getElement(availableTemplates);

            sentence = sentence.replace(/([^\s])(\{|\[)/g, '$1 $2').replace(/(\}|\])([^\s.,!?;:'])/g, '$1 $2');

            // Replace Synonyms (and cleverly lowercase transitions that accidentally land mid-sentence)
            sentence = sentence.replace(/\{([^}]+)\}/g, (match, key, offset) => {
                if (key.includes("transitions")) {
                    if (i === 0) key = "intro_transitions";
                    else if (i === plan.length - 1) key = "end_transitions";
                    else key = "mid_transitions";
                    
                    let syn = getUniqueSynonym(synonyms[key]);
                    // If the template poorly placed this transition mid-sentence, lower-case the first letter so it flows
                    if (offset > 0 && syn.length > 0) {
                        syn = syn.charAt(0).toLowerCase() + syn.slice(1);
                    }
                    return syn;
                }
                return getUniqueSynonym(synonyms[key]);
            });

            const eventData = data || {};
            sentence = sentence.replace(/\[([^\]]+)\]/g, (match, key) => {
                const val = eventData[key];
                return (val === undefined || val === null || val === "" || val.length === 0) ? "" : this.formatList(val);
            });

            // --- DEEP GRAMMAR SCRUBBER ---
            sentence = sentence.replace(/\(\s*\)/g, ""); // Clean empty ()
            sentence = sentence.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")"); // Clean inner () spacing
            sentence = sentence.replace(/,\s*\./g, "."); // FIX: If a transition brought a trailing comma right before a period, delete the comma
            sentence = sentence.replace(/,\s*,/g, ","); // FIX: Clean up double commas
            sentence = sentence.replace(/\.+/g, "."); // Fix double periods
            sentence = sentence.replace(/\s+([.,!?])/g, "$1"); // Fix space before punctuation
            sentence = sentence.replace(/\s{2,}/g, " ").trim(); 
            
            if (sentence) {
                if (eventData.Custom_Narrative && eventData.Custom_Narrative.trim() !== "") {
                    let customTxt = eventData.Custom_Narrative.trim();
                    customTxt = customTxt.charAt(0).toUpperCase() + customTxt.slice(1);
                    if (!customTxt.match(/[.!?]$/)) customTxt += ".";
                    sentence += " Clinical observation: " + customTxt;
                }
                sentence = sentence.replace(/(?:^|[.!?]\s+)([a-z])/g, match => match.toUpperCase());
                paragraphParts.push(sentence);
            }
        }
        return paragraphParts.join(" ");
    }
}