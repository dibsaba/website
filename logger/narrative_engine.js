export default class NarrativeEngine {
  static formatList(dataVal) {
    if (!Array.isArray(dataVal)) return dataVal == null ? "" : String(dataVal);
    if (dataVal.length === 0) return "";
    if (dataVal.length === 1) return String(dataVal[0]);
    if (dataVal.length === 2) return `${dataVal[0]} and ${dataVal[1]}`;
    const items =[...dataVal];
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

      // FIX: Better spacing regex that ignores apostrophes (')
      sentence = sentence.replace(/([^\s])(\{|\[)/g, '$1 $2').replace(/(\}|\])([^\s.,!?;:'])/g, '$1 $2');

      sentence = sentence.replace(/\{([^}]+)\}/g, (match, key) => {
        if (key.includes("transitions")) {
          if (i === 0) key = "intro_transitions";
          else if (i === timeline.length - 1 && timeline.length > 1) key = "end_transitions";
          else key = "mid_transitions";
        }
        const options = synonyms[key];
        return (Array.isArray(options) && options.length > 0) ? this.getRandomElement(options) : ""; 
      });

      const eventData = data || {};
      sentence = sentence.replace(/\[([^\]]+)\]/g, (match, key) => {
        const val = eventData[key];
        return (val === undefined || val === null || val === "" || val === "None selected") ? "" : this.formatList(val);
      });

      // FIX: Clean up extra spaces, including empty parenthesis from missing specific targets
      sentence = sentence.replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
      
      // FIX: Auto-capitalize the very first letter of the generated sentence
      if (sentence) {
        sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
        paragraphParts.push(sentence);
      }
    }

    return paragraphParts.join(" ");
  }
}