/**
 * @fileoverview NarrativePlanner - Creates a structural blueprint and injects Clinical Intent.
 */
export default class NarrativePlanner {
    
    // THE NEW NARRATIVE STRATEGY LAYER
    static analyzeStrategy(session) {
        const behaviorCount = session.aggregatedBehaviors ? session.aggregatedBehaviors.length : 0;
        const skillCount = session.aggregatedSkills ? session.aggregatedSkills.All_Targets.length : 0;
        
        return {
            // If there are multiple distinct behaviors, we condense them into one fluid sentence
            condenseBehaviors: behaviorCount > 1,
            emphasizeSkills: skillCount > 0 && behaviorCount === 0,
            behaviorCount: behaviorCount
        };
    }

    static buildPlan(normalizedSession) {
        const plan =[];
        const strategy = this.analyzeStrategy(normalizedSession);

        // 1. ANTECEDENT -> PURPOSE MAPPING
        const ANTECEDENT_PURPOSE = {
            "Demand/Escape": "to escape demands",
            "Denied Access/Tangible": "to access restricted items",
            "Attention Diverted": "to gain attention",
            "Unstructured Time/Automatic": "for automatic reinforcement",
            "Transition": "to avoid transitioning",
            "Sensory Overload": "due to sensory overstimulation",
            "Interruption of Preferred Activity": "to maintain access to a preferred activity",
            "Change in Routine": "to resist a change in routine"
        };

        // 2. INTERVENTION -> CLINICAL ACTION MAPPING
        const getClinicalAction = (intervention, antecedent) => {
            if (!intervention) return "";
            if (intervention.includes("FCT")) {
                if (antecedent.includes("Escape")) return "functional communication training to request a break";
                if (antecedent.includes("Attention")) return "functional communication training to request attention";
                if (antecedent.includes("Tangible")) return "functional communication training to request access";
                return "functional communication training";
            }
            if (intervention.includes("DRA")) {
                if (antecedent.includes("Attention")) return "differential reinforcement of appropriate attention-seeking";
                return "differential reinforcement of alternative behaviors (DRA)";
            }
            if (intervention.includes("DRO")) return "differential reinforcement of other behaviors (DRO)";
            if (intervention.includes("Premack")) return "the Premack principle (first/then contingency)";
            if (intervention.includes("Escape Extinction")) return "escape extinction to maintain demand fading";
            if (intervention.includes("Planned Ignoring")) return "planned ignoring to withhold attention";
            if (intervention.includes("Redirection")) return "redirection to neutral activities";
            return intervention; 
        };

        // 3. NEW: CLINICAL EFFECTIVENESS SCORING
        const getEffectiveness = (timeArray) => {
            if (!timeArray || timeArray.length === 0) return "resulting in safe de-escalation";
            const times = Array.isArray(timeArray) ? timeArray : [timeArray];
            if (times.includes("> 30 minutes")) return "yielding limited initial success before achieving de-escalation";
            if (times.includes("15-30 minutes")) return "yielding partial effectiveness in reaching de-escalation";
            if (times.includes("5-15 minutes")) return "effectively achieving stabilization";
            return "proving highly effective in reaching rapid de-escalation";
        };

        // --- BUILD THE NARRATIVE PLAN ---
        if (normalizedSession.context) plan.push({ section: 'Session_Start', data: normalizedSession.context });
        
        if (normalizedSession.transitions.length > 0) {
            const allSettings = normalizedSession.transitions.map(t => t.Specific_Setting);
            plan.push({ section: 'Location_Transition', data: { Specific_Setting: allSettings } });
        }

        if (normalizedSession.aggregatedSkills) {
            plan.push({ section: 'Skills_Summary', data: normalizedSession.aggregatedSkills });
        }

        // --- STRATEGIC BEHAVIOR ROUTING WITH WEIGHTING ---
        if (strategy.behaviorCount > 0) {
            
            const processedBehaviors = normalizedSession.aggregatedBehaviors.map(b => {
                b.Purpose = ANTECEDENT_PURPOSE[b.Antecedents] || "for its presumed function";
                b.Contextual_Interventions = Array.isArray(b.Interventions) ? b.Interventions.map(i => getClinicalAction(i, b.Antecedents)) :[];
                b.Effectiveness = getEffectiveness(b.Deescalation_Time); // Add effectiveness to single behaviors
                return b;
            });

            if (strategy.condenseBehaviors) {
                // NEW: BEHAVIOR WEIGHTING (Sort by Raw_Count highest to lowest)
                const sorted = [...processedBehaviors].sort((a, b) => b.Raw_Count - a.Raw_Count);
                
                // Identify the Primary Behavior
                const primary = sorted[0];
                const primaryIntensity = primary.Intensity && primary.Intensity.length > 0 ? primary.Intensity[0] : '';
                const primaryString = `${primary.Frequency} ${primaryIntensity} ${primary.Target_Behaviors}`.trim();
                
                // Group the rest as Secondary Behaviors
                const secondaryBehaviors = sorted.slice(1).map(b => b.Target_Behaviors);
                const secondaryString = secondaryBehaviors.length > 0 ? `with secondary occurrences of ${secondaryBehaviors.join(' and ')}` : '';
                
                const allFunctions =[...new Set(processedBehaviors.map(b => b.Purpose))];
                const allInterventions =[...new Set(processedBehaviors.flatMap(b => b.Contextual_Interventions))];
                const allTimes =[...new Set(processedBehaviors.flatMap(b => b.Deescalation_Time))];
                const overallEffectiveness = getEffectiveness(allTimes);
                const combinedNotes = processedBehaviors.map(b => b.Custom_Narrative).filter(n => n && n.trim() !== "").join(" ");

                plan.push({
                    section: 'Behaviors_Condensed',
                    data: {
                        Primary_Behavior: primaryString,
                        Secondary_Behaviors: secondaryString, // New variable
                        All_Functions: allFunctions,
                        All_Interventions: allInterventions,
                        All_Times: allTimes,
                        Effectiveness: overallEffectiveness, // New variable
                        Custom_Narrative: combinedNotes
                    }
                });
            } else {
                plan.push({ section: 'Behavior_Reduction', data: processedBehaviors[0] });
            }
        }

        if (normalizedSession.end) plan.push({ section: 'Session_End', data: normalizedSession.end });

        return plan;
    }
}