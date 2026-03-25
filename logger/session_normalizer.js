/**
 * @fileoverview SessionNormalizer - Converts chronological events into a semantic model.
 */
export default class SessionNormalizer {
    static normalize(timeline) {
        const session = {
            context: null,
            transitions: [],
            skills: [],
            behaviors:[],
            end: null
        };

        timeline.forEach(event => {
            if (event.type === 'Session_Start') session.context = event.data;
            if (event.type === 'Location_Transition') session.transitions.push(event.data);
            if (event.type === 'Skill_Acquisition') session.skills.push(event.data);
            if (event.type === 'Behavior_Reduction') session.behaviors.push(event.data);
            if (event.type === 'Session_End') session.end = event.data;
        });

        // We only aggregate Behaviors now. Skills pass through individually!
        session.aggregatedBehaviors = this.aggregateBehaviors(session.behaviors);

        return session;
    }

    static aggregateBehaviors(behaviorsArray) {
        if (behaviorsArray.length === 0) return null;
        const grouped = {};

        behaviorsArray.forEach(b => {
            const key = `${b.Target_Behaviors}_${b.Antecedents}`;
            if (!grouped[key]) {
                grouped[key] = {
                    Target_Behaviors: b.Target_Behaviors,
                    Antecedents: b.Antecedents,
                    count: 0,
                    Intensity: new Set(),
                    Specific_Topography: new Set(),
                    Interventions: new Set(),
                    Deescalation_Time: new Set(),
                    Smart_Chips: new Set(),
                    Custom_Narrative:[]
                };
            }
            grouped[key].count++;
            if (b.Intensity) grouped[key].Intensity.add(b.Intensity);
            if (b.Specific_Topography) grouped[key].Specific_Topography.add(b.Specific_Topography);
            if (b.Interventions) b.Interventions.forEach(i => grouped[key].Interventions.add(i));
            if (b.Deescalation_Time) grouped[key].Deescalation_Time.add(b.Deescalation_Time);
            if (b.Smart_Chips) b.Smart_Chips.forEach(c => grouped[key].Smart_Chips.add(c));
            if (b.Custom_Narrative && b.Custom_Narrative.trim() !== "") grouped[key].Custom_Narrative.push(b.Custom_Narrative);
        });

         return Object.values(grouped).map(g => ({
            Target_Behaviors: g.Target_Behaviors,
            Antecedents: g.Antecedents,
            Raw_Count: g.count, 
            Frequency: g.count === 1 ? "an episode of" : "multiple instances of",
            Intensity: Array.from(g.Intensity),
            Specific_Topography: Array.from(g.Specific_Topography),
            Interventions: Array.from(g.Interventions),
            Deescalation_Time: Array.from(g.Deescalation_Time),
            Smart_Chips: Array.from(g.Smart_Chips),
            Custom_Narrative: g.Custom_Narrative.join(". ")
        }));
    }
}