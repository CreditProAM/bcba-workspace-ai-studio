
import type { PromptTemplate } from '../components/toolkit/toolkitTypes';

const templates: PromptTemplate[] = [
  // Crisis Help
  {
    id: 'crisis-aggression-transitions',
    category: 'Crisis Help',
    title: 'Aggression During Transitions',
    description: 'Generate strategies for a 5 y/o exhibiting aggression during transitions.',
    prompt: `I am a behavior analyst working with a 5-year-old child diagnosed with ASD. The child exhibits physical aggression (hitting, kicking) during transitions between preferred and non-preferred activities in a clinic setting. Provide a brief, actionable, in-the-moment crisis plan using person-first language. Then, suggest 3 proactive antecedent strategies to reduce the likelihood of this behavior in the future. Format the response clearly with headings.`,
    staticFallback: `**In-the-Moment Crisis Plan:**
1. **Ensure Safety:** Block aggression safely. Clear the immediate area of dangerous objects. Use a calm, neutral tone and minimal language.
2. **Follow Through:** Guide the child through the transition with gentle physical prompts if necessary and safe. Do not allow aggression to escape the demand.
3. **De-escalate:** Once the transition is complete, provide a brief moment of calm and then re-engage in the new activity.

**Proactive Antecedent Strategies:**
1. **Visual Supports:** Use a visual schedule or "First-Then" board to show what is coming next.
2. **Transition Warnings:** Provide clear, timed warnings (e.g., "In 2 minutes, we will clean up blocks and go to the table.").
3. **Behavioral Momentum:** Precede the difficult transition with 2-3 easy, high-probability requests the child is likely to follow.`
  },
  {
    id: 'crisis-elopement',
    category: 'Crisis Help',
    title: 'Elopement Response',
    description: 'Outline immediate steps to take when a child runs out of the room (elopement).',
    prompt: `An 8-year-old client in a home-based session has just run out of the therapy room and is attempting to leave the house. What are the immediate, step-by-step actions a behavior technician should take to ensure safety and manage the situation according to best practices? The response should prioritize safety and de-escalation.`,
    staticFallback: `**Immediate Elopement Response Plan:**
1. **Stay Calm:** Your calm demeanor is crucial for de-escalation.
2. **Move to Block:** Immediately and calmly move to position yourself between the child and the exit. Do not grab the child unless there is an immediate danger (e.g., running into a street).
3. **State the Boundary:** Use simple, clear language. "I need you to stay inside where it's safe."
4. **Redirect:** Once the immediate exit is blocked, redirect the child back to a safe area or the therapy room. Offer a choice of two calming activities.
5. **Report:** Inform your supervising BCBA and the parent/guardian about the incident as soon as the situation is stable.`
  },
  // Documentation Templates
  {
    id: 'doc-soap-note',
    category: 'Documentation Templates',
    title: 'SOAP Note for Tantrum Session',
    description: 'Generate a SOAP note structure for a session focused on tantrum behavior.',
    prompt: `Generate a template for a SOAP (Subjective, Objective, Assessment, Plan) note for a 2-hour ABA session with a 6-year-old. The session's primary focus was responding to tantrum behavior (crying, screaming) when presented with academic tasks. Include placeholders for data. Use person-first language.`,
    staticFallback: `**SOAP Note Template**
**Client:** [Client Initials] | **Date:** [Date] | **Therapist:** [Therapist Name]

**S (Subjective):** Parent reported that the child had a difficult morning before the session, stating "[Parent Quote]". The child appeared [e.g., tired, energetic] upon arrival.

**O (Objective):** Session length: 120 minutes. The client participated in skill acquisition programs, including [Program 1] and [Program 2]. Tantrum behavior (defined as crying and screaming for >15s) occurred [Number] times, with an average duration of [Avg. Duration]. Data shows tantrums were functionally related to the presentation of academic tasks. Successful compliance with academic tasks occurred [Number] times with FCT.

**A (Assessment):** The behavior intervention plan for tantrums appears [e.g., effective, moderately effective, in need of modification]. The use of Functional Communication Training (FCT) to request a break successfully averted [Number] potential tantrums. The frequency of tantrums has [increased/decreased/remained stable] compared to the previous session.

**P (Plan):** Continue with the current behavior plan. Continue to focus on reinforcing FCT. The therapist will introduce a new token economy system for academic task completion in the next session. Consult with BCBA regarding [specific issue].`
  },
  {
    id: 'doc-dap-note',
    category: 'Documentation Templates',
    title: 'DAP Note for Skill Acquisition',
    description: 'Generate a DAP note structure for a skill acquisition-focused session.',
    prompt: `Generate a template for a DAP (Data, Assessment, Plan) note for a skill acquisition session with a young child. Focus on manding (requesting) and tacting (labeling) skills. Include placeholders for specific data points.`,
    staticFallback: `**DAP Note Template**
**Client:** [Client Initials] | **Date:** [Date] | **Therapist:** [Therapist Name]

**D (Data):** During the 90-minute session, the following was observed:
- **Manding:** The child independently manded for desired items/activities [Number] times. [Number]/[Number] prompted manding opportunities were successful.
- **Tacting:** The child correctly tacted [Number] of [Number] presented common objects. [List of mastered tacts].
- **Program Goals:** [Program Name]: [Score, e.g., 80% accuracy across 3 trials].

**A (Assessment):** The child shows continued progress in spontaneous manding, indicating a growing understanding of language as a tool. Tacting of familiar items is strong, but generalization to new items requires further practice. Motivation was high when using [Reinforcer].

**P (Plan):** Continue current manding and tacting programs. Introduce [Number] new tact targets in the next session (e.g., [Target 1], [Target 2]). Probe for generalization of manding with different communication partners (e.g., another therapist, parent).`
  },
  // Ethics Support
  {
    id: 'ethics-dual-relationship',
    category: 'Ethics Support',
    title: 'Dual Relationship: Parent Friend Request',
    description: 'Formulate a professional response to a parent who sends a social media friend request.',
    prompt: `A parent of a current client has sent you, a behavior technician, a friend request on a personal social media platform. How should you respond? Provide a script for a polite and professional verbal response to the parent that explains the ethical boundary without damaging rapport. Reference the relevant principle from the BACB Ethics Code.`,
    staticFallback: `**Ethical Consideration:** This scenario falls under BACB Ethics Code 1.11 Multiple Relationships. Accepting the request would create a dual relationship that could impair objectivity and professional judgment.

**Professional Response Script:**
"Hi [Parent's Name], thank you so much for the friend request! I really appreciate you reaching out. As your child's therapist, I have to follow specific professional ethics codes to make sure our relationship stays focused on providing the best possible service for [Child's Name]. These guidelines don't allow me to connect with clients or their families on personal social media. It’s nothing personal at all—it’s a rule I follow with all families to maintain professional boundaries. I'm so happy to chat about [Child's Name]'s progress anytime through our official channels!"`
  },
  {
    id: 'ethics-hipaa-texting',
    category: 'Ethics Support',
    title: 'HIPAA and Texting Parents',
    description: 'Explain the risks of texting parents about client behavior and suggest compliant alternatives.',
    prompt: `A colleague frequently texts parents with brief updates about their child's behavior during sessions (e.g., "Just wanted to let you know Timmy had a great session!"). Explain the potential HIPAA/privacy violations and ethical risks associated with this practice. Suggest at least two secure, compliant alternatives for communication.`,
    staticFallback: `**Risks of Texting Client Information:**
1. **Lack of Encryption:** Standard SMS texting is not encrypted, making it vulnerable to interception. This is a potential HIPAA violation as it can expose Protected Health Information (PHI).
2. **Data Security:** Phones can be lost, stolen, or viewed by others, leading to an unauthorized disclosure of PHI.
3. **No Record:** Text messages are difficult to formally log as part of the client's official record, leading to incomplete documentation.
4. **Blurred Boundaries:** It can create an informal communication channel that undermines professional boundaries.

**Compliant Communication Alternatives:**
1. **Secure Parent Portal:** Use your organization's designated secure messaging portal (e.g., CentralReach, Rethink). These are HIPAA-compliant and maintain a log of all communications within the client's record.
2. **Phone Calls or In-Person Updates:** For brief updates, a direct phone call or a quick summary at the end of the session during pickup is secure and professional. All significant updates should be documented in the session notes.`
  },
  // Parent Scripts
  {
    id: 'parent-no-progress',
    category: 'Parent Scripts',
    title: 'Explaining Lack of Progress',
    description: 'Craft a collaborative and data-based script for discussing a lack of progress with a parent.',
    prompt: `Data for a key skill acquisition goal has been flat for three weeks. Generate a script for a BCBA to use when discussing this with a concerned parent. The script should be empathetic, data-focused, collaborative, and avoid jargon.`,
    staticFallback: `**Script for Discussing Lack of Progress:**

"Hi [Parent's Name], thanks for meeting with me. I want to talk about [Child's Name]'s progress on their goal of [Goal]. I've been looking closely at the data we've collected over the past three weeks, and I want to be transparent with you—we aren't seeing the consistent progress we were hoping for just yet.

This is actually very normal in this process. It doesn't mean [Child's Name] can't learn this skill; it just means our current teaching strategy might not be the perfect fit. My job is to figure out why and adjust our approach.

I have a few ideas I'd like to try, such as [Idea 1, e.g., 'breaking the skill down into smaller steps'] and [Idea 2, e.g., 'trying a different type of reward']. I also wanted to ask if you've noticed anything at home that might give us a clue? Sometimes what's happening in other parts of their day can affect learning.

We're a team in this, and your insight is so valuable. Let's work together on a new plan, and we'll check back in on it next week to see if we're moving in the right direction."`
  },
  {
    id: 'parent-data-resistance',
    category: 'Parent Scripts',
    title: 'Parent Resistant to Data Collection',
    description: 'Develop a script to explain the importance of data collection to a resistant parent.',
    prompt: `A parent feels that data collection at home is "too clinical" and is hesitant to do it. Provide a script for a BCBA to explain the "why" behind data collection in a user-friendly, non-technical way that highlights the benefits for their child.`,
    staticFallback: `**Script for Explaining Data Collection:**

"Hi [Parent's Name], I completely understand that tracking this information can feel a bit technical or like extra work. I want to explain why it's so important for helping [Child's Name].

Think of the data as our map. Without it, we're just guessing where to go. When you track [the behavior], you're giving us the clues we need to see what's really working and what's not. It helps us answer questions like, 'Does this behavior happen more before lunch?' or 'Does our new strategy actually make a difference?'

It's not about judgment or getting a perfect score. It's about seeing patterns. The simple notes you take tell us exactly how to adjust our plan to help [Child's Name] be more successful. It makes sure that the time and effort we are all putting in is having the biggest possible positive impact.

Could we maybe try to find a way to track it that feels easier for you? Maybe a simple checklist on the fridge or a quick note in your phone?"`
  },
  // Data & Patterns
  {
    id: 'data-regression',
    category: 'Data & Patterns',
    title: 'Progress or Regression?',
    description: 'Analyze a simple data pattern (e.g., 3 tantrums this week) and suggest interpretations.',
    prompt: `A client engaged in 3 tantrums this week, compared to an average of 1 per week for the prior month. Generate a list of potential reasons or "hypotheses" a BCBA should investigate to understand this change. Frame it as a structured problem-solving guide.`,
    staticFallback: `**Analyzing an Increase in Tantrums: A Problem-Solving Guide**

An increase from 1 to 3 tantrums/week could be a temporary fluctuation or a sign of a new issue. Here are the key areas to investigate:

1.  **Medical/Physical Factors:**
    *   Could the child be sick, teething, or experiencing allergies?
    *   Have there been any changes to sleep patterns or diet?

2.  **Environmental Changes:**
    *   Has there been a change in routine at home or school (e.g., new teacher, vacation, family visitor)?
    *   Has the therapy setting or schedule changed?

3.  **Antecedent (Trigger) Analysis:**
    *   Did the tantrums occur around the same activity, person, or time of day?
    *   Was a new or more difficult demand being placed on the child?

4.  **Consequence Analysis:**
    *   How did staff/family respond to the tantrums? Is it possible the behavior was accidentally reinforced (e.g., escape from demand, access to a desired item)?

5.  **Skill Deficit:**
    *   Is the child struggling with a new skill, and the tantrum is a result of frustration?
    *   Is there a communication breakdown where the child cannot effectively express their wants/needs?

**Next Step:** Systematically review ABC data from the incidents to identify the most likely hypothesis.`
  },
  {
    id: 'data-manding',
    category: 'Data & Patterns',
    title: 'Inconsistent Manding Data',
    description: 'Provide potential reasons for inconsistent manding data and suggest next steps.',
    prompt: `Data shows a child's manding (requesting) is high in some sessions but very low in others. What are the top 3 most likely variables influencing this inconsistency? For each variable, suggest a specific action step for the clinical team.`,
    staticFallback: `**Investigating Inconsistent Manding Data**

Here are three common variables that cause inconsistent manding and how to address them:

1.  **Variable: Fluctuating Motivation (MO)**
    *   **Reason:** The child may not want the items available for requesting. Manding is driven by motivation. If they are not motivated for the toys/snacks available, they won't ask for them.
    *   **Action Step:** Conduct a preference assessment at the beginning of each session. Offer a wider array of items and activities to identify what is motivating for the child *in that moment*.

2.  **Variable: Different Communication Partners**
    *   **Reason:** The child may have learned to mand successfully with one therapist but has not generalized the skill to others. Different people may provide reinforcement more or less quickly, affecting the child's effort.
    *   **Action Step:** Systematically train new communication partners. Ensure all therapists on the team are using the same prompting and reinforcement procedures for manding.

3.  **Variable: Environmental Distractions**
    *   **Reason:** Some sessions may have more distractions (e.g., other children, loud noises, access to "free" reinforcement) that compete with the motivation to engage in structured requesting.
    *   **Action Step:** Analyze the environment during low-manding sessions. If possible, increase environmental control by reducing distractions or temporarily restricting free access to reinforcers to make requesting more powerful.`
  },
  // Goal Writing
  {
    id: 'goal-smart-transition',
    category: 'Goal Writing',
    title: 'SMART Goal for Transition Compliance',
    description: 'Create a SMART goal for improving compliance with transitions.',
    prompt: `Write a SMART (Specific, Measurable, Achievable, Relevant, Time-bound) goal for a 4-year-old child who resists transitioning from playtime to table work. The goal should be written in professional, clinical language.`,
    staticFallback: `**SMART Goal: Transition Compliance**

*   **Specific:** The client will transition from a preferred play activity to a structured work activity within 1 minute of a verbal and visual cue from the therapist, with no more than 1 verbal prompt.
*   **Measurable:** Compliance will be defined as the client moving to the work area and sitting at the table without engaging in problem behavior (crying, dropping to floor, or physical resistance). This will be achieved in 80% of opportunities across 3 consecutive sessions.
*   **Achievable:** The goal is achievable with the implementation of antecedent strategies such as a visual timer and "First-Then" board. The baseline is currently 20% compliance.
*   **Relevant:** Improving transition compliance is directly relevant to increasing the client's ability to participate in more structured learning environments (e.g., school, therapy).
*   **Time-bound:** This goal will be mastered within 12 weeks.`
  },
  {
    id: 'goal-generalization-requesting',
    category: 'Goal Writing',
    title: 'Generalization Goal for Requesting Help',
    description: 'Formulate a goal for generalizing the skill of requesting help.',
    prompt: `A child has mastered requesting "help" with their primary therapist when they can't open a container. Write a goal focused on generalizing this skill across different people, settings, and situations.`,
    staticFallback: `**Generalization Goal: Requesting Assistance**

By [Date], when faced with a difficult or novel task (e.g., a challenging puzzle, a stuck zipper, a high toy), the client will independently request assistance (e.g., by saying "help," "help me," or leading someone's hand to the object) without engaging in problem behavior. This skill will be demonstrated across at least 3 different people (e.g., therapist, parent, teacher) and in 2 different settings (e.g., home, clinic) in 4 out of 5 opportunities, as documented by direct observation and data collection.`
  },
  // Supervisor Talk Tracks
  {
    id: 'supervisor-escalation-pattern',
    category: 'Supervisor Talk Tracks',
    title: 'Presenting Escalation Pattern to BCBA',
    description: 'Provide a script for an RBT to report a new, concerning behavior pattern to their supervisor.',
    prompt: `An RBT has noticed that a client's minor protest behavior (whining) is now frequently escalating to aggression. Provide a clear, professional script for the RBT to use when reporting this to their supervising BCBA. The script should be data-oriented and concise.`,
    staticFallback: `**RBT Script for Reporting to BCBA:**

"Hi [BCBA's Name], I wanted to give you a heads-up about a pattern I'm seeing with [Client's Name]. Over the past week, I've noticed that when I present the [Task Name] task, the initial whining is escalating to hitting within about 10-15 seconds. This has happened in 4 of the last 5 sessions.

Previously, the whining would de-escalate with a simple prompt, but now it seems to be intensifying quickly. I've been following the current protocol of [Briefly state current protocol], but it doesn't seem to be as effective for these escalated instances. I have my ABC data from these events ready to review with you. Do you have some time later today or this week to discuss a potential plan modification?"`
  },
  {
    id: 'supervisor-case-consult',
    category: 'Supervisor Talk Tracks',
    title: 'Case Consult: Aggression & Sensory Overlap',
    description: 'Formulate questions for a case consultation about overlapping functions of behavior.',
    prompt: `You are a BCBA preparing for a case consultation about a client whose aggression seems to be linked to both escape from demands AND sensory sensitivities (e.g., loud noises). Generate 3-4 specific, insightful questions to bring to the consultation to help untangle the functions and develop a more effective intervention.`,
    staticFallback: `**Questions for Case Consultation: Mixed Functions**

1.  "Given the overlap, how can we structure our functional analysis to effectively differentiate between escape-maintained aggression and aggression that is a reaction to aversive sensory input? Are there specific conditions we should add?"

2.  "For intervention, should we prioritize an approach that focuses on tolerating sensory input (desensitization), or one that focuses on tolerating demands, or is there a combined approach we can use? What would be the starting point?"

3.  "What antecedent strategies could we implement that would address both potential functions simultaneously? For example, would noise-canceling headphones (sensory) and a visual schedule (escape/predictability) be a valid combination to try first?"

4.  "How do we measure the interaction between the two functions? What specific data should we be collecting to see if a reduction in sensory overload leads to a corresponding reduction in escape-maintained behavior, or vice-versa?"`
  },
  // Add 15 more prompts to reach 30+
  {
    id: 'crisis-sib-aggression',
    category: 'Crisis Help',
    title: 'Aggression Towards Sibling',
    description: 'Immediate response plan for aggression towards a sibling during shared playtime.',
    prompt: 'During playtime, a 7-year-old client hits their younger sibling to gain access to a toy. Provide a brief, immediate safety and response plan for the caregiver or therapist.',
    staticFallback: `**Immediate Response for Sibling Aggression:**
1. **Prioritize Safety:** Immediately and calmly separate the children. Position yourself between them.
2. **Address the Victim:** First, check on the sibling who was hit. Provide comfort and ensure they are okay. This removes attention from the aggressor.
3. **Remove the Toy:** State calmly, "We don't hit. Hitting means the toy goes away for a minute." Remove the disputed toy for a short period (e.g., 1-2 minutes).
4. **State the Rule & Redirect:** Once calm, briefly restate the rule: "We use our words or ask for a turn." Then, redirect both children to separate activities.
5. **Plan for Prevention:** Later, practice and reinforce asking for toys or taking turns when the children are calm.`
  },
  {
    id: 'doc-progress-summary',
    category: 'Documentation Templates',
    title: 'Quarterly Progress Summary',
    description: 'Generate a template for a quarterly client progress summary for insurance.',
    prompt: 'Create a template for a quarterly progress summary for an insurance authorization review. The template should include sections for background, goals addressed, progress summary, barriers, and recommendations.',
    staticFallback: `**Quarterly Progress Summary Template**
**Client:** [Client Initials] | **Authorization Period:** [Start Date] - [End Date]

**1. Background:** [Client's Name] is a [Age]-year-old individual diagnosed with [Diagnosis]. Services this period focused on [brief summary of focus, e.g., communication, social skills].

**2. Goals Addressed & Progress:**
* **Goal 1: [Goal Description]**
  * **Progress:** [Summarize progress with data, e.g., "Increased from 20% to 75% independence across 3 consecutive weeks."].
* **Goal 2: [Goal Description]**
  * **Progress:** [Summarize progress with data, e.g., "Met mastery criteria on [Date]."].
* **Behavior Reduction Goal: [Target Behavior]**
  * **Progress:** [Summarize with data, e.g., "Reduced from an average of 5 incidents/week to 1 incident/week."].

**3. Barriers to Progress:**
* [List any barriers, e.g., "Illness resulted in 3 cancelled sessions.", "Difficulty generalizing skills to the school setting."].

**4. Recommendations:**
* Based on the progress, it is recommended to [e.g., continue current hours, add a new goal for social skills]. Continued ABA services are medically necessary to build upon recent gains and address remaining deficits in [Area 1] and [Area 2].`
  },
  {
    id: 'ethics-gift-giving',
    category: 'Ethics Support',
    title: 'Gift from a Parent',
    description: 'How to respond when a parent offers you a gift.',
    prompt: 'A parent tries to give you a $50 gift card to thank you for your hard work. Citing the BACB ethics code, provide a script for how to politely decline the gift while preserving the therapeutic relationship.',
    staticFallback: `**Ethical Consideration:** This relates to BACB Ethics Code 1.12 Giving and Receiving Gifts. To avoid conflicts of interest and maintain boundaries, behavior analysts should not accept gifts from clients.

**Professional Response Script:**
"That is so incredibly thoughtful of you, thank you so much for thinking of me! I've truly enjoyed working with your family. Because of my professional ethics code, I'm not able to accept any gifts, but your kind words and seeing [Child's Name]'s progress are truly the best thanks I could ever receive. I really appreciate the gesture!"`
  },
  {
    id: 'parent-script-new-bx',
    category: 'Parent Scripts',
    title: 'Explaining a New Behavior',
    description: 'Script for explaining a new, unexpected behavior to a parent.',
    prompt: 'A client has suddenly started engaging in a new behavior (e.g., humming loudly). Generate a script for the BCBA to explain this to the parent, including the process of how you will determine its function.',
    staticFallback: `**Script for Explaining a New Behavior:**

"Hi [Parent's Name], I wanted to touch base about something new I've observed with [Child's Name] recently. I've noticed they've started humming quite loudly during our sessions.

Often when a new behavior pops up, it's serving a purpose for them. It could be for self-stimulation, a way to communicate something, or even a reaction to something in the environment. My next step is to act like a detective and gather some information to figure out the 'why' behind the humming. We call this figuring out the 'function' of the behavior. I'll be taking some notes on when it happens, what's going on right before, and what happens right after.

Once we have a better idea of why it's happening, we can decide if we need to address it and, if so, the best way to do that. Have you noticed this at home as well?"`
  },
  {
    id: 'data-skill-mastery',
    category: 'Data & Patterns',
    title: 'Is This Skill Mastered?',
    description: 'Criteria for deciding if a skill is truly mastered and generalized.',
    prompt: 'A client is meeting a skill acquisition goal at 90% accuracy in the therapy room with their primary therapist. What criteria should be met before the BCBA considers the skill "mastered" and moves to a maintenance plan? List at least 3 key criteria.',
    staticFallback: `**Criteria for True Skill Mastery:**

Before moving a skill to maintenance, ensure the client can demonstrate it across various conditions:

1.  **Across People:** The client performs the skill successfully not just with their primary therapist, but also with other therapists, parents, and teachers. (Target: >80% accuracy with at least 2 other people).

2.  **Across Settings:** The client performs the skill in different environments, not just the structured therapy room. This includes places like the playground, a different room in the house, or a community setting like a store. (Target: >80% accuracy in at least 1 other setting).

3.  **Across Materials/Stimuli:** If applicable, the client can apply the skill to different materials or examples than the ones used for initial teaching (e.g., can label 3 new, untrained pictures of a dog). (Target: >80% accuracy with novel stimuli).

Only when the skill is fluent and generalized should it be considered truly mastered.`
  },
  {
    id: 'goal-reduce-rigidity',
    category: 'Goal Writing',
    title: 'Goal for Reducing Rigidity',
    description: 'Write a goal to decrease rigid behaviors, such as insisting on a specific routine.',
    prompt: 'A child shows distress and protests if their daily schedule is slightly altered (e.g., going to the park before lunch instead of after). Write a clinical goal aimed at increasing flexibility and tolerating changes in routine.',
    staticFallback: `**Goal: Increasing Flexibility with Routines**

By [Date], when presented with an unexpected but reasonable change to a previously established routine (e.g., a different route home, a cancelled activity), the client will accept the change without protest or problem behavior (crying, verbal refusal). The client will tolerate the change with the support of a visual cue and one verbal reassurance (e.g., "I know this is different, we can do [the usual activity] later"). This skill will be demonstrated in 4 out of 5 opportunities over 2 consecutive weeks.`
  },
  {
    id: 'supervisor-feedback',
    category: 'Supervisor Talk Tracks',
    title: 'Receiving Difficult Feedback',
    description: 'A script for an RBT to respond professionally to constructive feedback from a supervisor.',
    prompt: 'An RBT receives feedback from their BCBA that their pacing is too slow during DTT. Provide a script for the RBT to respond professionally and receptively.',
    staticFallback: `**RBT Script for Receiving Feedback:**

"Thank you for that feedback. I appreciate you pointing that out. I want to make sure I'm running the programs effectively. Can you clarify what the ideal pace looks like, or maybe model it for me on the next trial? I'll make a conscious effort to increase the pace between trials. Thanks again for helping me improve."`
  },
  {
    id: 'crisis-self-injury',
    category: 'Crisis Help',
    title: 'Self-Injurious Behavior (SIB)',
    description: 'Immediate response to minor, attention-seeking SIB.',
    prompt: 'A child is engaging in low-intensity, attention-maintained self-injurious behavior (e.g., lightly hitting their own head). What is the immediate response protocol?',
    staticFallback: `**Immediate Response for Minor SIB:**
1.  **Ensure Safety:** If necessary, use a blocking procedure (e.g., a soft pillow or open hand to block the head-hitting) without making eye contact or speaking.
2.  **Planned Ignoring (Extinction):** Minimize all social attention. Do not talk to the child, make eye contact, or provide any reaction to the behavior itself.
3.  **Prompt a Replacement Behavior:** After a few seconds of the SIB stopping, prompt the child to engage in a functional communication or appropriate behavior (e.g., "What do you want?").
4.  **Reinforce Appropriateness:** Provide immediate, high-quality attention as soon as the child engages in the desired behavior. This teaches them a better way to get attention.`
  },
  {
    id: 'doc-intake-summary',
    category: 'Documentation Templates',
    title: 'Initial Intake Summary',
    description: 'Template for summarizing an initial client intake meeting.',
    prompt: 'Create a template for a BCBA to summarize the key findings from an initial parent intake meeting for a new client.',
    staticFallback: `**Initial Intake Summary Template**
**Client:** [Client Initials] | **Date of Intake:** [Date]
**Informant:** [Parent/Caregiver Name(s)]

**1. Presenting Concern:** [Summary of parent's primary reason for seeking services].
**2. Developmental History:** [Note key milestones - walking, talking. Any relevant medical history].
**3. Strengths & Preferences:** [List client's strengths, interests, and preferred reinforcers as reported by parent].
**4. Communication Skills:** [Note current communication methods - e.g., verbal, signs, AAC device. Level of use].
**5. Problem Behaviors of Concern:** [List parent-reported problem behaviors, their perceived function, and severity].
**6. Social Skills:** [Summary of interaction with peers, siblings, and adults].
**7. Initial Plan:** [e.g., "Schedule direct assessment (VB-MAPP, AFLS). Conduct FBA for top priority behavior. Begin rapport-building."]`
  },
  {
    id: 'ethics-social-media',
    category: 'Ethics Support',
    title: 'Posting about ABA on Social Media',
    description: 'Guidelines for a professional when posting generally about ABA on social media.',
    prompt: 'What are key ethical guidelines an RBT or BCBA should follow if they post about their work or the field of ABA on their personal social media? The focus is on avoiding confidentiality breaches.',
    staticFallback: `**Guidelines for Posting About ABA on Social Media:**
1.  **Anonymize Completely:** Never post pictures, videos, or specific stories about any current or past client, even if you think it's anonymous. Details can be pieced together. Use "a client" not "my client."
2.  **Avoid Identifying Information:** Do not mention client age, gender, diagnosis, or specific location/setting in combination. A post about "a 5-year-old boy with ASD I work with in Brooklyn" is too specific.
3.  **Use a Disclaimer:** Add a disclaimer to your profile, such as "Views are my own. This is not clinical advice."
4.  **Uphold Professionalism:** Represent the field responsibly. Avoid making unsubstantiated claims or engaging in unprofessional disputes.
5.  **Separate Personal and Professional:** The safest approach is to not discuss specific work details on personal accounts at all. Consider a separate, professional account if you wish to engage in public discourse about the field.`
  },
  {
    id: 'parent-script-generalization',
    category: 'Parent Scripts',
    title: 'Explaining Generalization',
    description: 'A simple way to explain "generalization" to a parent and ask for their help.',
    prompt: 'Provide a simple, jargon-free script to explain the concept of generalization to a parent and explain why their involvement is critical.',
    staticFallback: `**Script to Explain Generalization:**

"Hi [Parent's Name], I want to share some great progress. [Child's Name] is now consistently [skill] with me in the therapy room, which is fantastic!

Our next, and most important, step is something we call 'generalization.' All that means is we want to make sure this isn't just a 'therapy room skill.' We want them to be able to use this skill with you, at the grocery store, with their siblings—everywhere!

This is where you become the most valuable player on our team. When you practice this skill at home, even for just a few minutes a day, you are teaching [Child's Name] that this skill works in the real world, not just with me. Can we brainstorm some easy ways you could practice this at home this week?"`
  },
  {
    id: 'data-graph-interpretation',
    category: 'Data & Patterns',
    title: 'Interpreting a Graph',
    description: 'Basic steps for interpreting a line graph of behavior data.',
    prompt: 'Provide a simple, 3-step guide for a new RBT on how to interpret a standard line graph showing behavior frequency over time.',
    staticFallback: `**A 3-Step Guide to Interpreting a Behavior Graph:**

1.  **Analyze the Axes:** First, look at the labels. The vertical axis (Y-axis) tells you *what* you are measuring (e.g., "Number of Aggressions"). The horizontal axis (X-axis) tells you the timeframe (e.g., "Session Dates").

2.  **Look for the Trend:** Is the general direction of the data points going up, down, or staying flat? An upward trend indicates the behavior is increasing. A downward trend means it's decreasing. A flat line means no change. This is the most important takeaway.

3.  **Identify Variability and Phase Lines:** Are the data points close together (stable) or all over the place (variable)? High variability might mean your intervention isn't having a consistent effect. Look for vertical lines on the graph (phase change lines)—these show when a new strategy was introduced, so you can compare the data before and after the change.`
  },
  {
    id: 'goal-social-initiation',
    category: 'Goal Writing',
    title: 'Goal for Social Initiation',
    description: 'Write a goal for a child to initiate social interactions with peers.',
    prompt: 'Write a measurable goal for a 7-year-old to initiate social interactions with peers during unstructured playtime, such as recess.',
    staticFallback: `**Goal: Peer Social Initiation**

By [Date], during unstructured peer-play opportunities (e.g., recess, center time), the client will independently initiate a social interaction with a peer. An initiation is defined as approaching a peer and asking a game-related question (e.g., "Can I play?", "What are you building?") or making a contextually relevant comment. This will occur at least 2 times per observation period, across 3 consecutive observations, without adult prompting.`
  },
  {
    id: 'supervisor-rbt-burnout',
    category: 'Supervisor Talk Tracks',
    title: 'Addressing RBT Burnout',
    description: 'A script for a BCBA to check in with an RBT who seems to be showing signs of burnout.',
    prompt: 'A BCBA notices a reliable RBT has been frequently late, seems disengaged, and is less energetic in sessions. Provide a supportive, non-confrontational script for the BCBA to open a conversation about potential burnout.',
    staticFallback: `**BCBA Script for Burnout Check-in:**

"Hi [RBT's Name], do you have a minute to chat privately? I wanted to check in with you. I've noticed you seem a bit tired lately, and I just want to make sure everything is okay.

This work can be incredibly demanding, and your well-being is really important. The cases you're on are tough, and you handle them with so much professionalism. I want to make sure you feel supported by me and the team. Is there anything about your current schedule, the cases, or anything else that we could adjust to make things more manageable for you right now? I'm here to listen."`
  },
  {
    id: 'parent-script-reinforcement',
    category: 'Parent Scripts',
    title: 'Explaining Reinforcement',
    description: 'A simple way to explain "reinforcement" vs. "bribery" to a parent.',
    prompt: 'A parent says, "I feel like I am just bribing my child to behave." Provide a clear, simple script that explains the difference between reinforcement (which you are using) and bribery.',
    staticFallback: `**Script: Reinforcement vs. Bribery**

"That's a really common concern, and I'm glad you brought it up. It's helpful to think about the timing.

A **bribe** is when you offer something in the middle of a problem behavior to make it stop. For example, if a child is screaming in a store and you say, "If you stop screaming, I'll buy you that candy!" That's a bribe, and it accidentally teaches them that screaming gets them candy.

**Reinforcement**, which is what we are doing, is proactive. We set the expectation *before* the behavior. We say, "First, we clean up the blocks, *then* we get 5 minutes of iPad." We are teaching them that positive behavior earns them access to the things they love.

You're not stopping a bad behavior; you're rewarding a good one. It's a subtle but powerful difference that teaches them valuable skills over the long run."`
  }
];

templates.sort((a, b) => a.title.localeCompare(b.title));

export const promptTemplates = templates;
