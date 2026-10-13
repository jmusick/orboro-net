-- Review locally with: npx wrangler d1 execute DB --local --file=scripts/content/could-jev-power-the-next-wowanalyzer.sql
PRAGMA foreign_keys = ON;

INSERT INTO content (
  id, slug, title, markdown, page_type, status, author_id,
  published_at, created_at, updated_at, featured_image_url
)
VALUES (
  'c3ba11b2-b6bd-453b-aac7-b30d9cf94d73',
  'could-jev-power-the-next-wowanalyzer',
  'Could Jev Power the Next WoWAnalyzer?',
  'After a bad raid pull, the useful question is rarely just “How much damage did we do?” It is “What should we change before the next attempt?”

[WoWAnalyzer](https://github.com/WoWAnalyzer/WoWAnalyzer) helps players improve through performance metrics and gameplay suggestions. [Wipefest](https://www.wipefest.gg/) turns Warcraft Logs reports into raid-mechanic insights and timelines. That helps a player or raid leader decide what to change before the next pull.

Could Jev, a specialized AI decision model, help build an alternative to these tools? It could provide an interpretation layer, provided a combat-log engine supplies the facts and maintained game rules support each recommendation.

## What Jev brings to the problem

Jev is TypeSafe AI''s model for bounded decisions. Give it relevant context and a question with a defined answer space, and it returns a structured result your application can consume. TypeSafe calls this a System One model. [Introduction](https://docs.typesafe.ai/introduction)

Jev has three question types. Choice selects from named alternatives. Score rates something across descriptive levels. Noul returns the probability that a yes/no statement is true. Choice and Score also include probability distributions and a confidence statistic.

For a WoW tool, these might become:

- Choice: does a delayed cooldown look like a missed opportunity, deliberate alignment, or an unclear case?
- Score: how actionable is this finding under a defined review rubric?
- Noul: does the supplied evidence support checking an interrupt assignment?

Vercel reported that Jev reached nearly 13% of AI Gateway''s paid teams within its first day. That is an adoption signal, not evidence that it can analyze WoW correctly. [Vercel''s launch report](https://vercel.com/blog/ai-gateway-jev-model-launch)

## Build the fight model first

Sending an entire combat log with “tell me what went wrong” would leave too much work to the model.

A rotation analyzer needs to reconstruct casts, buffs, resources, cooldown availability, and target availability. It also needs patch-specific rules for the player''s spec, talents, and encounter. Holding a cooldown can be sensible if a damage window is approaching; an apparent cast gap can be explained by forced downtime.

A raid analyzer needs encounter phases, mechanic definitions, assignments where available, and the sequence before a pull becomes unrecoverable. Later deaths can be consequences of an earlier failure. A log alone may not establish why someone made a decision.

The proposed pipeline is:

Combat events → deterministic reconstruction → candidate findings → Jev classification → evidence-linked feedback.

Code should calculate durations, count casts, and enforce known rules. Jev receives compact findings with the relevant rule attached. This also follows TypeSafe''s guidance to filter state before evaluating it. [State design](https://docs.typesafe.ai/concepts/state)

## Example: reviewing a delayed cooldown

Suppose the parser finds a long delay before a major offensive cooldown. Rather than immediately mark it as a mistake, a second layer could classify the context.

Install `@typesafe-ai/sdk`, set `TYPESAFE_API_KEY` in your server environment, and run the following as an `.mjs` file using Node.js 20 or newer. The SDK reads the key automatically. [JavaScript SDK](https://docs.typesafe.ai/sdk/javascript)

```js
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

const client = new TypeSafeClient();

// Synthetic fixture: these fields come from our own analysis engine.
// They are not raw Warcraft Logs API fields or measured results.
const finding = {
  kind: "delayed_offensive_cooldown",
  delay: "Long enough to lose a use before the fight ends",
  playerAlive: true,
  targetAvailable: true,
  forcedDowntime: false,
  plannedHold: false,
  rule: "Use while a target is available unless holding for a documented window.",
  evidenceIds: ["cooldown-ready-1", "next-cast-1", "fight-end-1"],
};

const { answers } = await client.systemOne({
  model: "jev-1.13.0",
  state: finding,
  questions: {
    interpretation: choice(
      "Which interpretation is best supported by this finding and its rule?",
      {
        missed_opportunity: "Usable cooldown delayed without a documented reason",
        justified_hold: "Evidence supports holding for a planned window or downtime",
        insufficient_context: "Missing or conflicting evidence prevents classification",
      },
    ),
  },
});

console.log(answers.interpretation);
```

The API call depends on the analysis that precedes it. The fixture assumes the engine has determined whether another use was possible, supplied target availability, and attached a reviewed rule. Keep unknown information marked as unknown; converting it to `false` changes the evidence.

Jev''s answer is an interpretation of that evidence. It is not a simulation of the damage another cast would have produced. Estimating a DPS loss requires additional modeling.

## Example: suggesting a raid investigation

For raid analysis, ask which investigation the evidence supports. Avoid asking the model to name the player who caused the wipe.

Here is a separate request using another synthetic fixture:

```js
const raidReview = await client.systemOne({
  model: "jev-1.13.0",
  state: {
    firstDeath: "Tank died immediately after an interruptible cast completed",
    interrupts: "No successful interrupt recorded for that cast",
    mechanicRule: "This cast must be interrupted under the selected strategy",
    assignment: "Unknown",
    evidenceIds: ["cast-complete-7", "death-8"],
  },
  questions: {
    next_check: choice("What should the raid leader investigate first?", {
      interrupt_plan: "Check assignments and interrupt availability for this cast",
      defensive_plan: "Check mitigation if evidence points to expected damage",
      more_context: "The evidence does not support a specific investigation",
    }),
  },
});

console.log(raidReview.answers.next_check);
```

“Review the interrupt assignment at this timestamp” is a useful lead. “Player X wiped the raid” requires much stronger evidence. A production tool would retain links to the relevant cast and death events so someone can verify the finding.

## Turn decisions into controlled feedback

A model-selected label should not automatically become a definitive coaching tip. Choice confidence describes the returned distribution; it is not a guarantee of correctness. [Confidence reference](https://docs.typesafe.ai/confidence)

```js
const decision = answers.interpretation;
const threshold = 0.85; // Illustrative; tune on expert-reviewed examples.

const review =
  decision.choice === "insufficient_context" || decision.confidence < threshold
    ? { status: "needs_review", evidenceIds: finding.evidenceIds }
    : {
        status: "suggested_interpretation",
        label: decision.choice,
        evidenceIds: finding.evidenceIds,
      };

console.log(review);
```

The UI could map labels to reviewed explanation templates. A generative model could write richer summaries later, constrained to verified findings. Jev itself is not designed to write those explanations.

## Could this replace WoWAnalyzer or Wipefest?

A new product could compete with them, but Jev would supply only part of the system. It would still need report ingestion, correct event reconstruction, spec and encounter knowledge, useful timelines, and ongoing patch maintenance.

The potential benefit is a reusable interpretation layer: the same interface could review cooldown findings, mechanic failures, and conflicting evidence. Test it against deterministic rules to see whether it improves accuracy or reduces maintenance.

TypeSafe documents limitations involving arithmetic, indirect questions, irrelevant context, and adversarial input. Typed outputs do not remove those problems. [Known limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13)

I would start with one spec, one encounter, and a labeled collection of findings reviewed by experienced players. Measure incorrect advice and unnecessary review alongside latency and cost. Show the source evidence for every suggestion.

Jev could help select an interpretation, but the analysis engine still has to establish the facts. I would judge the prototype by how often experienced players agree with its advice and can verify it from the linked events.',
  'post',
  'published',
  (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1),
  CAST(strftime('%s', '2026-09-30 16:00:00') AS INTEGER) * 1000,
  CAST(strftime('%s', '2026-09-30 16:00:00') AS INTEGER) * 1000,
  CAST(strftime('%s', '2026-09-30 16:00:00') AS INTEGER) * 1000,
  'https://media.orboro.net/images/could-jev-power-the-next-wowanalyzer-header.webp'
)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  markdown = excluded.markdown,
  page_type = excluded.page_type,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = excluded.updated_at,
  featured_image_url = excluded.featured_image_url;

INSERT OR IGNORE INTO content_categories (content_id, category_id)
SELECT
  (SELECT id FROM content WHERE slug = 'could-jev-power-the-next-wowanalyzer'),
  id
FROM categories
WHERE slug IN ('development', 'gaming', 'world-of-warcraft');
