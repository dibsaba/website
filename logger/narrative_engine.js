/**
 * @fileoverview NarrativeEngine - Generates sentences based on the Narrative Plan.
 */
export default class NarrativeEngine {
    static formatList(dataVal) {
        if (!Array.isArray(dataVal)) return dataVal == null ? "" : String(dataVal);
        const clean = dataVal.filter(v => v && v !== "None selected");
        if (clean.length === 0) return "";
        if (clean.length === 1) return String(clean[0]);
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

            // Spacing Fix: Protects apostrophes and punctuation
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

            // Grammar Cleanup: Fix empty parenthesis, double spaces, and auto-capitalize
            sentence = sentence.replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
            if (sentence) {
                sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
                paragraphParts.push(sentence);
            }
        }

        return paragraphParts.join(" ");
    }
}