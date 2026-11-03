-- Kairos article: Nov. 2 results revision approved and synced to production.
-- Production artwork must exist in R2 before applying this seed remotely.
-- Apply: npx wrangler d1 execute DB --remote --file=scripts/content/kairos-rebuilding-priority-recommendations.sql
PRAGMA foreign_keys = ON;

INSERT INTO content (
  id, slug, title, markdown, page_type, status, author_id,
  published_at, created_at, updated_at, featured_image_url, comments_mode
) VALUES (
  '7d4059fa-cf66-4406-8414-dff80f7cc0c4', 'kairos-rebuilding-priority-recommendations', 'Kairos: rebuilding WoW rotation advice', 'I''m building a WoW addon called Kairos to find out how much useful rotation advice we can recover from the combat information Midnight still lets addons read.

The goal is to run our own priority recommendations, using SimulationCraft''s action priority lists and a model of what is happening to your character. Blizzard''s Assisted Combat remains available as a fallback. It isn''t the primary source of Kairos''s recommendations on the specs we''re developing.

That work is experimental. Arcane Sunfury and Demonology have independent implementations, and both still have gaps. The interesting part is how much of a decision we can reconstruct even when the game won''t give us the underlying buff or cooldown directly.

## A hidden stack count can still have readable consequences

Midnight''s secret-value system allows addons to display some combat information while preventing their Lua code from inspecting it or using it in calculations. Blizzard describes that distinction in its [explanation of the addon changes](https://news.blizzard.com/en-us/article/24246290/combat-philosophy-and-addon-disarmament-in-midnight).

A priority list needs information it can reason about. If a rule says to cast one spell below a stack threshold and another above it, drawing the hidden stack count on screen doesn''t give the addon a usable input.

But a hidden value can have observable causes and effects.

Your own successful cast may consume a buff. Another spell may build it. A readable activation glow may indicate that a threshold has been reached. A readable aura can give us a starting value before restrictions take effect, or correct the model when those restrictions lift.

Kairos combines those observations with explicit models of spell mechanics. Between reliable observations, the model estimates how the state changes. When a new observation establishes a value, it corrects the estimate.

The theory is that a priority list often needs less information than a complete reconstruction of combat. If the next decision only depends on whether you have at least 12 stacks, an estimate of 15 can produce the right recommendation when the real value is 17. An estimate of 11 when the real value is 12 can produce the wrong one.

That makes accuracy around the actual decision thresholds especially important.

## The signals Kairos uses

The available information varies by spell, resource and game context. Kairos probes what the client actually exposes and checks reads for secret values before using them.

| Signal | What it contributes |
| --- | --- |
| Your own casts and readable cast/channel timing | Previous actions, cooldown starts, resource changes and progress through a channel |
| Spell activation glows and readable spell replacements | Proc presence, replacement-spell availability and some threshold confirmations |
| Readable resources | Current Arcane Charges or Soul Shards, when those reads pass the checks |
| Readable aura, cooldown and charge data | Starting values and corrections whenever the client exposes them |
| Cached talents, learned spells, gear and haste | The applicable mechanics, available abilities and baseline timings |
| Movement and readable hostile nameplates | Movement restrictions and an approximate enemy count |

A glow needs to be interpreted carefully. It may establish that a proc exists without revealing its stack count. Several effects may also light the same spell. Nameplates give us an approximation of enemy count, with no guarantee that every counted enemy is in range of the recommended spell.

Even an aura lookup returning nothing needs care: some restricted lookups return `nil` for an aura that is present but secret. Kairos checks the restriction rather than treating that result as proof the buff is down. Leaving combat doesn''t always make everything readable again, either; the raid probes found restrictions that persisted afterward.

The signal wrapper makes that boundary explicit. This is the read function from `Core/Signal.lua`; `Known` and `Unknown` construct tagged results for the state model:

```lua
function Signal.Read(fn, ...)
    if type(fn) ~= "function" then
        return Signal.Unknown("missing")
    end
    local ok, value = pcall(fn, ...)
    if not ok then return Signal.Unknown("error") end
    if issecretvalue(value) then
        return Signal.Unknown("secret")
    end
    return Signal.Known(value)
end
```

The wrapper checks whether the returned value is secret before handing it to the model. A failed or restricted read carries a reason instead of silently becoming zero or false. Tables whose individual fields can be secret have a separate field-reading guard.

## Arcane Salvo is a useful test case

Arcane Salvo''s stack count is hidden in combat in the tested builds. The Sunfury priority list uses several boundaries, including whether Salvo is below 12, above eight or exactly 25.

Kairos tracks Salvo from casts and channels. Arcane Blast and Prismatic Bolt add modeled gains. Missiles adds an estimated gain based on how much of the channel ran. A normal Barrage consumes Salvo and anchors the model at zero.

The Barrage glow provides another correction. Outside the competing effects that also light it, the glow can establish that Salvo has reached 25. Arcane Soul needs separate handling because it keeps Barrage glowing and changes Barrage''s interaction with Salvo.

For an isolated Missiles channel, the basic estimate looks like this. The inputs below are ordinary numbers from the model and readable timing, with a positive channel duration. This shortened example leaves out new anchors, other casts and Arcane Soul handling:

```lua
-- Credit only the fraction of the channel that ran.
local fraction = math.max(0, math.min(1, elapsed / duration))
local gain = 11 * fraction  -- estimated full-channel gain
local estimate = math.min(25, startSalvo + gain)
local stacks = math.floor(estimate + 0.5)

-- One condition used by the Missiles priority rule:
local belowThreshold = stacks < 12
```

The 11-stack gain is the current model''s average, not a guaranteed result of the spell. Starting from two stacks, a full channel gives an estimate of 13, so that below-12 condition is false. Other conditions still decide the recommended spell. If a normal Barrage consumes Salvo, the production model calls `Salvo:Anchor(0)`; a qualifying glow can call `Salvo:Anchor(25)`. Those observations replace the estimate before it keeps accumulating error.

Missiles is where the uncertainty becomes difficult. Its gains vary, and the tested visible spell fields haven''t supplied a reliable way to identify Overpowered Missiles. The Missiles glow tracks Clearcasting; it doesn''t distinguish that empowered channel.

That produces real errors near 12 stacks. A model can have a small average stack error and still choose the wrong spell when the true value sits just across the threshold. Repeatedly changing an average gain to improve the score on one recorded session would hide that problem. A new session has to test whether the model generalizes.

Cumulative Power is a more predictable example. Kairos models its buildup during Missiles, its consumption at eight stacks by Blast or Prismatic Bolt, and its expiration. In one later dummy session, the offline model answered the eight-stack condition correctly at 189 of 192 decisions; the live estimate did so at 187 of 194. Those results describe one buff condition in one session, rather than the accuracy of the entire rotation.

## Sometimes the missing value doesn''t change the answer

Demonology provides another approach to uncertainty.

A readable Demonbolt glow can establish that Demonic Core is present while its stack count remains hidden. When the priority evaluation needs that count, Kairos can try every possible positive value: one, two, three and four.

If every value produces the same recommended spell, the exact count isn''t necessary for that decision. If the spell changes, Kairos falls back to Assisted Combat.

This shortened excerpt shows the check in `DemonologyState:Pick`. It runs only after the glow has established presence and the priority evaluation has read the unknown stack count. `s` is the non-secret model, `pick` is the initial recommendation, and `evaluate()` reruns the priorities while tracking unknown dependencies in `reads`:

```lua
local original = s.coreStacks
local sameSpell = true

for count = 1, 4 do
    s.coreStacks = count
    local other = evaluate()
    if (other and other.spellID) ~= (pick and pick.spellID) then
        sameSpell = false
    end
end
s.coreStacks = original

if sameSpell then reads.coreStacks = nil end
local uncertain = s.timingUnknown or next(reads) ~= nil
```

Only the Core-count dependency is cleared when all four answers agree. Unknown timing or another input can still force fallback. No hidden stack count is recovered or inspected: the engine tests whether that missing information can change this particular choice.

Other Demonology inputs need estimates. Wild Imps are modeled in batches from the player''s own casts, with lifetimes based on their expected Firebolt expenditure and cached haste. The model pauses their lifetime clock outside combat and while the player has no live hostile target, and corrects the estimate from Implosion''s cast count wherever that count is readable between pulls.

The player''s target is still an approximation of whether every imp is attacking, and Inner Demons'' timer phase remains unmodeled. Those gaps can leave the estimated count too low and cost Implosion recommendations. They also show why a model that behaves well on a dummy needs dungeon testing.

## Running the priorities ourselves

An offline translator converts pinned SimulationCraft action priority lists into Lua shipped with the addon. During play, the spec adapter supplies the reconstructed state and the generated rules evaluate it in priority order.

There is no live connection to SimulationCraft, and Kairos doesn''t run a full simulation inside WoW. The translator supports part of the source lists; coverage reports identify unsupported rules and approximations. Some behavior also comes from explicit Kairos constraints, such as holding Arcane Surge until Touch of the Magi is ready.

For the normal main recommendation, the adapter projects deterministic effects to the end of the current cast or global cooldown. If you''re already casting a resource generator, the next decision should account for the resources that cast is expected to provide. Projection uses a copy of state so those future changes don''t affect the running model early.

New random procs aren''t predicted. Arcane''s ordinary additional queued recommendation remains withheld; its immediate Touch cue and Barrage/Touch pairing have separate timing handling. Demonology now checks a possible next spell against the modeled Core gains, hidden Core counts and relevant Demonic Art procs, and shows the queued icon only when the alternatives agree.

Kairos''s signal layer distinguishes known, estimated and unknown inputs. The current adapters accept modeled estimates as usable. Unknown reads along the evaluated priority path trigger fallback, including unknowns encountered in higher-priority rules that were rejected before the selected rule.

The fallback displays Blizzard''s pick with an AC badge when that pick is available. It also supplies recommendations on specs without an independent Kairos implementation. An accepted estimate can still be wrong, though: fallback handles uncertainty the model recognizes, not every modeling error.

## Testing the recommendation that was actually on screen

The live addon records its decisions and diagnostic inputs. After play, offline tools align that recorder with the combat log by matching casts, reconstruct state from the log, and evaluate the priorities against it. Kairos never reads the combat log live.

Timing matters here. By the time a cast event arrives, the display may already have advanced to a recommendation for the following global cooldown. Scoring that later icon against the earlier press would grade advice the player hadn''t been shown for that decision. The recorder preserves evaluations from before the new GCD begins; the later Demonology sessions have tested that handling live.

## Results: how close are we to the APL?

As of the Nov. 2 review, the latest three retained Demonology runs matched the reference priority at **460 of 473 scored presses, or 97%**. Blizzard Assisted Combat matched at **372 of 473, or 79%**. That is 88 additional reference-matching recommendations in those samples.

For each scored press, the offline replay reconstructs the combat state and asks the implemented SimC-derived priorities which spell they would select. We compare that answer with the recommendation Kairos displayed before the press and with the recorded Blizzard AC recommendation. The player''s actual spell is a separate measurement: following the advice is not required for the recommendation to count as a match.

### Demonology: from 80% to the mid-to-high 90s

These selected runs show the progress across the Nov. 1 sessions. Each cell gives matching recommendations divided by scored decisions, followed by the rounded percentage. The builds and encounters changed between runs, so this is a development record rather than a controlled before-and-after benchmark.

| Demonology session | Build used | Kairos matches APL | Blizzard AC matches APL |
| --- | --- | --- | --- |
| The Everbloom, first run | 0.2.1 with development fixes | 177/222 (80%) | 145/225 (64%) |
| Shadowmoon Burial Grounds, first run | 0.2.2 | 150/170 (88%) | 97/170 (57%) |
| The Everbloom, evening | 0.2.6 | 234/261 (90%) | 187/261 (72%) |
| Skyreach, evening | 0.2.7 | 148/154 (96%) | 110/154 (71%) |
| The Blinding Vale, normal | 0.2.7 | 310/329 (94%) | 206/329 (63%) |
| Skyreach, late-night capture | 0.2.7 with cast shard hold | 75/77 (97%) | 63/77 (82%) |
| The Everbloom, late-night capture | 0.2.7 with cast shard hold | 255/258 (99%) | 208/258 (81%) |
| Shadowmoon Burial Grounds, late-night capture | 0.2.7 with cast shard hold | 130/138 (94%) | 101/138 (73%) |

All listed dungeons except The Blinding Vale were Timewalking. The first Everbloom capture has slightly different Kairos and AC denominators because the scored recommendations available for each differ. The three late-night rows share their denominators, and their sums produce the 460/473 versus 372/473 comparison above. The [Demonology replay report](https://github.com/jmusick/kairos/blob/main/docs/replay/12.1.5-70688-demonology.md) records the full session table, fixes and reference limitations.

The late-night session actually contained eleven dungeons, but only the last three retained enough recorder data to score. The earlier eight are unscored. The 97% figure describes the retained samples, not the entire evening, and unrecorded presses do not count as matches. Version 0.2.8 expands the archive and retains more of the resource and target observations needed to score longer sessions.

### What improved the recommendations

Early Demonology misses were concentrated in Implosion. The first Everbloom run had 45 Kairos mismatches, 29 of them Implosion calls. The model underestimated imps that survived between pulls or stopped attacking. Readable Implosion-count anchors and pauses around targetless periods address parts of that problem. The target-pause rule helped on the session used to develop it; its next Skyreach test confirmed the mechanism but changed little overall. That distinction keeps one favorable replay from becoming a general accuracy claim.

Another correction was Dominion of Argus. The old model let Hand of Gul''dan and Ruination keep extending the buff. The recorded windows showed a fixed duration from Tyrant, with the duration determined by talent rank. After that correction, neither the evening Skyreach run nor The Blinding Vale had a mismatch attributed to Argus.

Resource timing also matters. A cast can finish before its generated Soul Shards appear in the client''s resource reading. Dropping the projection immediately created a short window of advice based on the old count. Holding the expected gain until the reading catches up, for at most half a second, reduced Shadow Bolt''s stale-reading icon flips from 34 of 95 casts to five of 98 in the later sessions.

Rerunning The Blinding Vale''s captured decisions with that fix raised agreement from 310/329 to 318/329, about 97%. That is a retrospective rescore, not the result of a new live run, so the table keeps the recorded 310/329. The subsequent late-night captures ran with the cast shard hold and provide separate live evidence.

### Arcane: ahead of AC, with a harder threshold problem

Arcane''s larger raid sample remains below the target. Across seven retained Sszorak attempts on Oct. 30, the displayed recommendation matched at **219/260 decisions (84%)**, compared with **135/260 (52%)** for Blizzard AC. The gap is not uniform across spells:

| Reference APL spell | Kairos matches | Blizzard AC matches |
| --- | --- | --- |
| Arcane Barrage | 69/73 (95%) | 44/73 (60%) |
| Arcane Missiles | 62/68 (91%) | 24/68 (35%) |
| Prismatic Bolt | 25/47 (53%) | 8/47 (17%) |
| Arcane Blast | 53/59 (90%) | 54/59 (92%) |

Kairos improved agreement on several important priorities while Blizzard AC was slightly ahead on Blast in this sample. Bolt is the weakest category for both. Six Bolt mismatches that displayed Missiles had a latest recorded Salvo estimate of 11 against reconstructed values of 12–15, despite an observed Bolt glow. A small stack error can give the earlier Missiles rule priority over Bolt. That is a concrete example of the threshold problem described above, rather than a general failure to detect the proc.

The same raid log gives a useful diagnostic comparison: estimating only Salvo and Cumulative Power, with the other inputs held at reconstructed truth, chose the reference spell at 1,941 of 2,151 decisions (90%). That is an estimator-only replay over a larger window, not 90% live display agreement. It helps isolate the state-model problem while leaving projection, timing and availability errors to be investigated separately. The [Arcane raid report](https://github.com/jmusick/kairos/blob/main/docs/replay/12.1.5-70688-raid.md) documents both measurements and their different coverage.

### What these scores establish

The newer Demonology samples reach 94–99% agreement with the implemented priorities, while the retained Arcane raid sample is at 84%. That supports continuing the reconstruction work and identifies where the remaining errors sit. It does not establish a DPS gain, complete SimulationCraft equivalence or readiness across every encounter.

The reference uses the supported portion of the pinned SimC APL plus explicit Kairos constraints. Its reconstruction also has approximations: shard timing can disagree with client observations, imp counts can be uncertain, and auras expiring during loading screens needed a correction in the scorer. These percentages measure agreement with that reference, not an independently proven optimal spell at every press.

The project''s broader target remains at least 90% main-icon agreement across a full Mythic+ key and a raid boss on Arcane. High Demonology scores in Timewalking and a normal dungeon do not complete that validation gate.

[Tuono''s reconstruction research](https://github.com/matt82198/Tuono) was a reference for this approach; Kairos is a separate implementation. The current addon runs entirely in Lua, uses non-secret inputs for its decisions and leaves every spell press to the player.

The [Kairos repository](https://github.com/jmusick/kairos) contains the models, generated priorities, probe findings and replay reports. The next work is to collect longer captures with the expanded recorder, keep testing imp behavior during targetless stretches, and bring the newer press-time scoring approach to Arcane before drawing conclusions from another raid comparison.',
  'post', 'published',
  (SELECT id FROM users WHERE role='admin' ORDER BY created_at ASC LIMIT 1),
  1793551797856, 1793551797856, 1793635499483, 'https://media.orboro.net/images/kairos-rebuilding-priority-recommendations-header-f70057958618.webp', 'open'
)
ON CONFLICT(slug) DO UPDATE SET
  title=excluded.title, markdown=excluded.markdown, page_type=excluded.page_type,
  status=excluded.status, published_at=COALESCE(content.published_at,excluded.published_at),
  updated_at=excluded.updated_at, featured_image_url=excluded.featured_image_url,
  comments_mode=excluded.comments_mode;

INSERT OR IGNORE INTO content_categories (content_id,category_id)
SELECT (SELECT id FROM content WHERE slug='kairos-rebuilding-priority-recommendations'), id
FROM categories WHERE slug IN ('development','gaming','world-of-warcraft');

INSERT INTO media (id,url,alt_text,caption,created_by,created_at)
VALUES (
  '6d3a67fc-e430-4e76-9557-f0c3dba31a89', 'https://media.orboro.net/images/kairos-rebuilding-priority-recommendations-header-f70057958618.webp', 'Orboro adjusts an hourglass instrument as glowing combat signals converge into a spell recommendation.', 'Kairos: rebuilding priority recommendations from readable combat signals.',
  (SELECT id FROM users WHERE role='admin' ORDER BY created_at ASC LIMIT 1), 1793551797856
)
ON CONFLICT(id) DO UPDATE SET url=excluded.url, alt_text=excluded.alt_text, caption=excluded.caption;
