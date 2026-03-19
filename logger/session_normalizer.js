/**
 * @fileoverview SessionNormalizer - Converts chronological events into a semantic model.
 */
export default class SessionNormalizer {
    static normalize(timeline) {
        const session = {
            context: null,
            transitions:[],
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

        session.aggregatedSkills = this.aggregateSkills(session.skills);
        session.aggregatedBehaviors = this.aggregateBehaviors(session.behaviors);

        return session;
    }

    static aggregateSkills(skillsArray) {
        if (skillsArray.length === 0) return null;
        const agg = { domains: new Set(), targets: new Set(), formats: new Set(), prompts: new Set(), reinforcers: new Set() };
        
        skillsArray.forEach(s => {
            if (s.Skill_Domains) agg.domains.add(s.Skill_Domains);
            if (s.Specific_Target && s.Specific_Target.trim() !== "") agg.targets.add(s.Specific_Target);
            if (s.Teaching_Formats) agg.formats.add(s.Teaching_Formats);
            if (s.Prompt_Levels) agg.prompts.add(s.Prompt_Levels);
            if (s.Specific_Reinforcers) s.Specific_Reinforcers.forEach(r => agg.reinforcers.add(r));
        });

        // FIX: Provide clinical defaults if the RBT left optional fields blank
        if (agg.targets.size === 0) agg.targets.add("individualized treatment goals");
        if (agg.domains.size === 0) agg.domains.add("comprehensive skill acquisition");
        if (agg.formats.size === 0) agg.formats.add("various teaching formats");
        if (agg.prompts.size === 0) agg.prompts.add("systematic");
        if (agg.reinforcers.size === 0) agg.reinforcers.add("positive reinforcement");

        return {
            All_Domains: Array.from(agg.domains),
            All_Targets: Array.from(agg.targets),
            All_Formats: Array.from(agg.formats),
            All_Prompts: Array.from(agg.prompts),
            All_Reinforcers: Array.from(agg.reinforcers)
        };
    }

    // NEW: Behavior Aggregation
    static aggregateBehaviors(behaviorsArray) {
        if (behaviorsArray.length === 0) return null;
        const grouped = {};

        // Group by Behavior + Antecedent combination
        behaviorsArray.forEach(b => {
            const key = `${b.Target_Behaviors}_${b.Antecedents}`;
            if (!grouped[key]) {
                grouped[key] = {
                    Target_Behaviors: b.Target_Behaviors,
                    Antecedents: b.Antecedents,
                    count: 0,
                    Intensity: new Set(),
                    Interventions: new Set(),
                    Deescalation_Time: new Set(),
                    Custom_Narrative: []
                };
            }
            grouped[key].count++;
            if (b.Intensity) grouped[key].Intensity.add(b.Intensity);
            if (b.Interventions) b.Interventions.forEach(i => grouped[key].Interventions.add(i));
            if (b.Deescalation_Time) grouped[key].Deescalation_Time.add(b.Deescalation_Time);
            if (b.Custom_Narrative && b.Custom_Narrative.trim() !== "") grouped[key].Custom_Narrative.push(b.Custom_Narrative);
        });

        // Convert the groups back into an array with computed "Frequency"
         return Object.values(grouped).map(g => ({
            Target_Behaviors: g.Target_Behaviors,
            Antecedents: g.Antecedents,
            Raw_Count: g.count, // <-- NEW: Explicit integer for Behavior Weighting
            Frequency: g.count === 1 ? "an episode of" : "multiple instances of",
            Intensity: Array.from(g.Intensity),
            Interventions: Array.from(g.Interventions),
            Deescalation_Time: Array.from(g.Deescalation_Time),
            Custom_Narrative: g.Custom_Narrative.join(". ")
        }));
    }
}