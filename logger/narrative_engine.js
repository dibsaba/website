/**
 * @fileoverview NarrativeEngine - Generates and sanitizes clinical text.
 */
export default class NarrativeEngine {
    
    // Smart text cleaner: Lowercases text mid-sentence but preserves acronyms (e.g., FCT, DRA)
    static cleanText(val) {
        if (typeof val !== 'string') return val;
        return val.split(' ').map(word => {
            // Strip punctuation for the check
            const cleanWord = word.replace(/[(),.]/g, '');
            // If the word is strictly uppercase letters (like DTT, DRA), keep it uppercase
            if (/^[A-Z/-]+$/.test(cleanWord) && cleanWord.length > 0) return word;
            // Otherwise, lowercase it so it flows naturally mid-sentence
            return word.toLowerCase();
        }).join(' ');
    }

    static formatList(dataVal) {
        if (!Array.isArray(dataVal)) return dataVal == null ? "" : this.cleanText(String(dataVal));
        const clean = dataVal.filter(v => v && v !== "None selected").map(v => this.cleanText(v));
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
            // 1. Remove empty parenthesis () or ( ) resulting from missing data
            sentence = sentence.replace(/\(\s*\)/g, "");
            // 2. Fix spacing inside parenthesis e.g., ( Living room ) -> (living room)
            sentence = sentence.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
            // 3. Fix double punctuation e.g., target.. -> target.
            sentence = sentence.replace(/\.+/g, ".");
            // 4. Fix spaces before punctuation e.g., target , -> target,
            sentence = sentence.replace(/\s+([.,!?])/g, "$1");
            // 5. Clean up extra spaces
            sentence = sentence.replace(/\s{2,}/g, " ").trim();
            
            // Auto-capitalize the very first letter of the generated sentence
            if (sentence) {
                sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
                
                // Add the Custom Technician Narrative if they typed one
                if (eventData.Custom_Narrative && eventData.Custom_Narrative.trim() !== "") {
                    let customTxt = eventData.Custom_Narrative.trim();
                    // Ensure the technician's custom text ends with a period
                    if (!customTxt.match(/[.!?]$/)) customTxt += ".";
                    // Capitalize the first letter of their custom text
                    customTxt = customTxt.charAt(0).toUpperCase() + customTxt.slice(1);
                    sentence += " " + customTxt;
                }

                paragraphParts.push(sentence);
            }
        }

        return paragraphParts.join(" ");
    }
}