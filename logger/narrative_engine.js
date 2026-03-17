/**
 * @fileoverview NarrativeEngine - Generates and sanitizes clinical text.
 */
export default class NarrativeEngine {
    
    // Smart text cleaner: Lowercases text mid-sentence but preserves acronyms (e.g., FCT, DRA)
    static cleanText(val) {
        if (typeof val !== 'string') return val;
        return val.split(' ').map(word => {
            const cleanWord = word.replace(/[(),.]/g, '');
            if (/^[A-Z/-]+$/.test(cleanWord) && cleanWord.length > 0) return word;
            return word.toLowerCase();
        }).join(' ');
    }

    static formatList(dataVal) {
        // Strip trailing periods from individual data points so they don't break mid-sentence flow
        if (!Array.isArray(dataVal)) return dataVal == null ? "" : this.cleanText(String(dataVal)).replace(/[.!?]+$/, '');
        const clean = dataVal.filter(v => v && v !== "None selected").map(v => this.cleanText(v).replace(/[.!?]+$/, ''));
        if (clean.length === 0) return "";
        if (clean.length === 1) return clean[0];
        if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
        const last = clean.pop();
        return `${clean.join(", ")}, and ${last}`;
    }

    static getRandomElement(arr) {
        return (!Array.isArray(arr) || arr.length === 0) ? "" : arr[Math.floor(Math.random() * arr.length)];
    }

    static generate(synonyms, templates, plan) {
        const paragraphParts =[];

        for (let i = 0; i < plan.length; i++) {
            const { section, data } = plan[i];
            const availableTemplates = templates[section];

            if (!Array.isArray(availableTemplates) || availableTemplates.length === 0) continue;

            let sentence = this.getRandomElement(availableTemplates);

            // Protect brackets from spacing issues
            sentence = sentence.replace(/([^\s])(\{|\[)/g, '$1 $2').replace(/(\}|\])([^\s.,!?;:'])/g, '$1 $2');

            // Synonyms
            sentence = sentence.replace(/\{([^}]+)\}/g, (match, key) => {
                if (key.includes("transitions")) {
                    if (i === 0) key = "intro_transitions";
                    else if (i === plan.length - 1) key = "end_transitions";
                    else key = "mid_transitions";
                }
                const options = synonyms[key];
                return (Array.isArray(options) && options.length > 0) ? this.getRandomElement(options) : "";
            });

            // Data Insertion
            const eventData = data || {};
            sentence = sentence.replace(/\[([^\]]+)\]/g, (match, key) => {
                const val = eventData[key];
                return (val === undefined || val === null || val === "" || val.length === 0) ? "" : this.formatList(val);
            });

            // --- ADVANCED GRAMMAR SCRUBBING ---
            sentence = sentence.replace(/\(\s*\)/g, ""); // Remove empty parenthesis
            sentence = sentence.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")"); // Fix spacing inside parenthesis
            sentence = sentence.replace(/\.+/g, "."); // Fix double punctuation
            sentence = sentence.replace(/\s+([.,!?])/g, "$1"); // Fix spaces before punctuation
            sentence = sentence.replace(/\s{2,}/g, " ").trim(); // Clean up extra spaces
            
            if (sentence) {
                // Add the Custom Technician Narrative if they typed one
                if (eventData.Custom_Narrative && eventData.Custom_Narrative.trim() !== "") {
                    let customTxt = eventData.Custom_Narrative.trim();
                    
                    // Auto-capitalize their text
                    customTxt = customTxt.charAt(0).toUpperCase() + customTxt.slice(1);
                    if (!customTxt.match(/[.!?]$/)) customTxt += ".";
                    
                    // Prefix it so it acts as an addendum, not a chronological misstep
                    sentence += " Clinical observation: " + customTxt;
                }

                // CAPITALIZATION FIX: Capitalize the first letter of EVERY sentence inside the block
                sentence = sentence.replace(/(?:^|[.!?]\s+)([a-z])/g, match => match.toUpperCase());

                paragraphParts.push(sentence);
            }
        }

        return paragraphParts.join(" ");
    }
}