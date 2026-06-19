# PM Plus — Video Script
### Target length: 2:30 min

---

## INTRO (0:00 – 0:20)
*[Camera on team or screen with logo]*

> "Hi, we're [team names], and we built PM Plus —
> an AI-powered project management assistant that handles
> the coordination work so project managers can focus
> on what actually matters: making decisions."

---

## THE PROBLEM (0:20 – 0:50)
*[Stay on camera or switch to a simple slide]*

> "Every project manager starts their day the same way.
> They run a standup. They collect status updates from the team.
> Someone is blocked — they need to figure out who can help,
> then manually create a task in ClickUp and assign it.
>
> Then the next day, they do it all again.
>
> This is hours of pure admin work — every single week —
> that scales worse the bigger your team gets.
> By the time a PM spots a problem, it's already slowing the team down."

---

## THE VISION (0:50 – 1:15)
*[Switch to a diagram slide showing the full flow]*

> "We asked — what if none of that was manual?
>
> Imagine: a team member sends their daily check-in through Slack.
> AI agents instantly analyze it — is this person overloaded?
> Are they blocked? Who on the team can help?
>
> If there's a blocker, the right person gets a ClickUp task
> assigned automatically. If a developer finishes a feature,
> a testing task is auto-created for the QA engineer.
>
> And if something is serious enough to escalate,
> the PM gets one approval card — they click Approve or Reject —
> and the agents act on it.
>
> That's PM Plus. This is what we're building."

---

## WHAT WE BUILT (1:15 – 1:25)
*[Switch to dashboard — have it open and ready]*

> "At the hackathon, we built the core of that system —
> the AI agent pipeline and the live observability dashboard.
> Let me show you."

---

## LIVE DEMO (1:25 – 2:10)
*[Screen share the dashboard at pm-plus-production.up.railway.app]*

**[Click "Trigger Real Pipeline"]*
> "We're triggering a real pipeline now —
> four team members are submitting their daily check-ins."

**[Watch the stream light up — team cards appear]*
> "The agents are picking these up in real time.
> You can see the team health cards updating —
> Bob is light, Dave is heavy."

**[Point to the Agent Collaboration graph — Loop 1 activates]*
> "Loop 1 just fired — the Risk Analyzer is asking the Reporter
> for each employee's history before making a risk call.
> It's not just looking at today's check-in —
> it knows who has been blocked before."

**[Loop 2 activates if overload detected]*
> "An overload was detected. Loop 2 kicks in —
> the Risk Analyzer is asking the Resource Balancer
> who on the team can take this task.
> The Balancer looks at everyone's current workload
> and returns a confidence-scored recommendation."

**[Loop 3 — approval card appears]*
> "This one is high severity — so instead of acting automatically,
> the agent posts a risk flag and waits.
> Here's the PM approval card.
> Full context, recommended action, notes field.
> As the PM, I click Approve."

**[Click Approve]*
> "That response goes straight back to the agent.
> The agent continues. The loop closes."

**[Click Generate Weekly Report]*
> "And finally — one click generates the full weekly summary.
> Who was blocked, what risks were flagged, how the team performed.
> No manual compilation. It's just there."

---

## CLOSE (2:10 – 2:30)
*[Back to camera]*

> "The agent brain is live and working.
> Slack input and ClickUp task creation are the next integrations —
> and the decision logic for those is already in the pipeline.
>
> PM Plus doesn't replace the project manager.
> It replaces the admin work — so the PM can do their actual job.
>
> Thank you."

---

## TIPS FOR RECORDING
- Have the dashboard open and agents running **before** you hit record
- Run the simulated demo once first to make sure everything fires
- Speak slowly — 2:30 min feels short but goes fast when demoing
- If the live pipeline takes too long to respond, use "Run Simulated Demo" instead — it looks identical on screen
- Keep the approval card visible for a few seconds before clicking — let it land
