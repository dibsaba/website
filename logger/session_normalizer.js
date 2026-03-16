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

        // Deduplicate and aggregate skills data to prevent run-on sentences
        session.aggregatedSkills = this.aggregateSkills(session.skills);

        return session;
    }

    static aggregateSkills(skillsArray) {
        if (skillsArray.length === 0) return null;
        const agg = { domains: new Set(), targets: new Set(), formats: new Set(), prompts: new Set(), reinforcers: new Set() };
        
        skillsArray.forEach(s => {
            if (s.Skill_Domains) agg.domains.add(s.Skill_Domains);
            if (s.Specific_Target) agg.targets.add(s.Specific_Target);
            if (s.Teaching_Formats) agg.formats.add(s.Teaching_Formats);
            if (s.Prompt_Levels) agg.prompts.add(s.Prompt_Levels);
            if (s.Specific_Reinforcers) s.Specific_Reinforcers.forEach(r => agg.reinforcers.add(r));
        });

        return {
            All_Domains: Array.from(agg.domains),
            All_Targets: Array.from(agg.targets),
            All_Formats: Array.from(agg.formats),
            All_Prompts: Array.from(agg.prompts),
            All_Reinforcers: Array.from(agg.reinforcers)
        };
    }
}