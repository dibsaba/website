export default class NarrativeEngine {
  static formatList(dataVal) {
    if (!Array.isArray(dataVal)) return dataVal == null ? "" : String(dataVal);
    if (dataVal.length === 0) return "";
    if (dataVal.length === 1) return String(dataVal[0]);
    if (dataVal.length === 2) return `${dataVal[0]} and ${dataVal[1]}`;
    const items = [...dataVal];
    const lastItem = items.pop();
    return `${items.join(", ")}, and ${lastItem}`;
  }

  static getRandomElement(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  }

  static generate(synonyms, templates, timeline) {
    if (!Array.isArray(timeline)) return "";
    const paragraphParts =[];

    for (let i = 0; i < timeline.length; i++) {
      const event = timeline[i];
      const { type, data } = event;
      const availableTemplates = templates[type];

      if (!Array.isArray(availableTemplates) || availableTemplates.length === 0) continue;

      let sentence = this.getRandomElement(availableTemplates);

      // --- THE SPACING FIX ---
      // This automatically adds a space before a[ or { if it's missing, 
      // and a space after a ] or } if it's not punctuation.
      sentence = sentence.replace(/([^\s])(\{|\[)/g, '$1 $2').replace(/(\}|\])([^\s.,!?;:])/g, '$1 $2');

      // Process Synonyms ({curly_brackets})
      sentence = sentence.replace(/\{([^}]+)\}/g, (match, key) => {
        if (key.includes("transitions")) {
          if (i === 0) key = "intro_transitions";
          else if (i === timeline.length - 1 && timeline.length > 1) key = "end_transitions";
          else key = "mid_transitions";
        }
        const options = synonyms[key];
        return (Array.isArray(options) && options.length > 0) ? this.getRandomElement(options) : ""; 
      });

      // Process Data ([square_brackets])
      const eventData = data || {};
      sentence = sentence.replace(/\[([^\]]+)\]/g, (match, key) => {
        const val = eventData[key];
        // If empty, return nothing. Otherwise, format the list.
        return (val === undefined || val === null || val === "" || val === "None selected") ? "none" : this.formatList(val);
      });

      // Clean up whitespace and punctuation
      sentence = sentence.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
      
      if (sentence) paragraphParts.push(sentence);
    }

    return paragraphParts.join(" ");
  }
}