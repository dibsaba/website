/**
 * @fileoverview NarrativePlanner - Creates a structural blueprint for the final note.
 */
export default class NarrativePlanner {
    static buildPlan(normalizedSession) {
        const plan =[];

        // 1. Context / Intro
        if (normalizedSession.context) {
            plan.push({ section: 'Session_Start', data: normalizedSession.context });
        }

        // 2. Transitions (Grouped)
        if (normalizedSession.transitions.length > 0) {
            const allSettings = normalizedSession.transitions.map(t => t.Specific_Setting);
            plan.push({ section: 'Location_Transition', data: { Specific_Setting: allSettings } });
        }

        // 3. Skill Acquisition (Aggregated summary instead of individual loops)
        if (normalizedSession.aggregatedSkills) {
            plan.push({ section: 'Skills_Summary', data: normalizedSession.aggregatedSkills });
        }

        // 4. Behaviors (Kept sequential to show distinct incidents)
        normalizedSession.behaviors.forEach(behavior => {
            plan.push({ section: 'Behavior_Reduction', data: behavior });
        });

        // 5. Conclusion / Handoff
        if (normalizedSession.end) {
            plan.push({ section: 'Session_End', data: normalizedSession.end });
        }

        return plan;
    }
}