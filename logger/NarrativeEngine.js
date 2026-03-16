/**
 * @fileoverview NarrativeEngine - A pure JavaScript engine for generating 
 * clinical narratives based on templates, synonyms, and user event timelines.
 */

class NarrativeEngine {
  /**
   * Formats an array of strings into a natural English list.
   * - 1 item: "Item A"
   * - 2 items: "Item A and Item B"
   * - 3+ items: "Item A, Item B, and Item C" (Oxford comma applied)
   * 
   * @param {Array<string>|string|any} dataVal - The data array or value to format.
   * @returns {string} The cleanly formatted English string.
   */
  static formatList(dataVal) {
    if (!Array.isArray(dataVal)) {
      // If it's not an array, return it as a string, or an empty string if null/undefined
      return dataVal == null ? "" : String(dataVal);
    }
    
    if (dataVal.length === 0) return "";
    if (dataVal.length === 1) return String(dataVal[0]);
    if (dataVal.length === 2) return `${dataVal[0]} and ${dataVal[1]}`;
    
    const items = [...dataVal];
    const lastItem = items.pop();
    return `${items.join(", ")}, and ${lastItem}`;
  }

  /**
   * Selects a random element from an array.
   * 
   * @param {Array<string>} arr - The array to select from.
   * @returns {string} A random string from the array, or an empty string if invalid.
   */
  static getRandomElement(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    const randomIndex = Math.floor(Math.random() * arr.length);
    return arr[randomIndex];
  }

  /**
   * Generates a compiled narrative string from configurations and chronological events.
   * 
   * @param {Object} synonyms - A dictionary of synonym arrays mapped by exact synonym keys.
   * @param {Object} templates - A dictionary of template string arrays mapped by event types.
   * @param {Array<Object>} timeline - Chronological event objects containing `type` and `data`.
   * @returns {string} The final compiled, randomized narrative paragraph.
   */
  static generate(synonyms, templates, timeline) {
    if (!Array.isArray(timeline)) return "";

    const paragraphParts =[];

    // 1. Loop through the timeline array sequentially with an index (i)
    for (let i = 0; i < timeline.length; i++) {
      const event = timeline[i];
      const { type, data } = event;
      const availableTemplates = templates[type];

      if (!Array.isArray(availableTemplates) || availableTemplates.length === 0) {
        continue;
      }

      let sentence = this.getRandomElement(availableTemplates);

      // 3. Process Synonyms ({curly_brackets})
      sentence = sentence.replace(/\{([^}]+)\}/g, (match, key) => {
        
        // --- OUR CHRONOLOGY OVERRIDE FIX ---
        // Force the correct transition based on where we are in the timeline
        if (key.includes("transitions")) {
          if (i === 0) {
            key = "intro_transitions"; // Always use Intro for the first event
          } else if (i === timeline.length - 1 && timeline.length > 1) {
            key = "end_transitions"; // Always use End for the last event
          } else {
            key = "mid_transitions"; // Always use Mid for everything else
          }
        }
        // -----------------------------------

        const options = synonyms[key];
        if (Array.isArray(options) && options.length > 0) {
          return this.getRandomElement(options);
        }
        return ""; 
      });

      // 4. Process Data ([square_brackets])
      const eventData = data || {};
      sentence = sentence.replace(/\[([^\]]+)\]/g, (match, key) => {
        const val = eventData[key];
        if (val === undefined || val === null) {
          return ""; 
        }
        return this.formatList(val);
      });

      // Clean up whitespace and punctuation
      sentence = sentence
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([.,!?])/g, "$1")
        .trim();
      
      if (sentence) {
        paragraphParts.push(sentence);
      }
    }

    return paragraphParts.join(" ");
  }
}

export default NarrativeEngine;
