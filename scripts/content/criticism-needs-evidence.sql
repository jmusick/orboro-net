-- Reviewed article and corrected header; production sync authorized October 10, 2026.
-- Source draft and artwork: C:/Users/JD/Projects/orboro-net/articles/criticism-needs-evidence/
-- Upload criticism-needs-evidence-header-v3.webp to orboro-net-media/images/ first.
-- Publish with: npx wrangler d1 execute DB --config ./wrangler.toml --remote --file ./scripts/content/criticism-needs-evidence.sql
-- Re-running updates the article while preserving its original publication date.
PRAGMA foreign_keys = ON;
INSERT INTO content (id, slug, title, markdown, page_type, status, author_id, published_at, created_at, updated_at, featured_image_url)
VALUES ('2fdc374a-aa52-4bfd-b85f-0a9bcb4c95e2', 'criticism-needs-evidence', 'When “enshittification” and “AI slop” mean “I don’t like it”', '“Enshittification” and “AI slop” are useful terms until we start using them for everything we dislike. Then they become insults with the appearance of an explanation.

A browser changes its tabs. A developer releases an app built with AI assistance. Someone dislikes the result, reaches for a fashionable pejorative, and treats the label as if it settles the matter.

I want better criticism than that. A preference deserves to be expressed honestly. A technical accusation deserves evidence.

## Firefox Nova and the missing argument

Mozilla’s Firefox redesign, developed under the name Project Nova, began [rolling out Sept. 29, 2026](https://blog.mozilla.org/en/firefox/new-firefox-design/). It introduced softer tab shapes, more rounded components and new visual treatments. Mozilla also brought back compact mode.

The [Reddit launch discussion](https://www.reddit.com/r/firefox/comments/1wt9ig4/the_new_ux_design_nova_lands_in_firefox_today/) included praise, specific usability complaints and some furious objections. One commenter, arguing that Mozilla was prioritizing appearance over performance, called the rounded corners and gradients “an easy example of the enshittification of Firefox.” Another described the themes as “AI slop.”

Those labels make claims that the appearance of a tab cannot establish.

[Cory Doctorow’s account of enshittification](https://pluralistic.net/2023/01/21/potemkin-ai/) describes a platform attracting users with a good service, shifting value toward business customers once users become dependent, then taking more of that value for itself. Lock-in makes it harder for the people losing out to leave.

The term identifies a process of extraction. Its usefulness comes from connecting deterioration to the incentives and power that cause it.

Rounded corners do not demonstrate that process. Neither does a gradient you find ugly. Even an objectively worse interface needs an explanation of how it serves extraction before that diagnosis makes sense.

Someone could make that case about a redesign that hides privacy controls to increase data collection, steers people toward paid placements, or removes a useful feature to sell it back. They would need evidence linking the change to that outcome. Disliking the new shape of a Firefox tab supplies none of it.

Users in the same discussion reported problems with contrast, identifying container tabs and the amount of space menus occupied. Those are concrete complaints worth investigating. If a change makes someone’s daily work harder, the developer should take that seriously.

A person can also simply prefer the old design. Nobody needs an economic theory to justify wanting square tabs.

The mistake is inflating that preference into a diagnosis of exploitation. It makes the criticism less precise and makes genuine extraction harder to discuss, because the same word now covers everything from a business model to a border radius.

## If Nova isn’t working for you

You should be able to make your browser comfortable to use. If the new Firefox design gets in your way, there are practical options.

<details>
<summary>Firefox options: disable Nova, custom CSS and Zen Browser</summary>

**Temporarily disable Nova on desktop.** As of Firefox 157, users have [reported success with this preference](https://support.mozilla.org/en-US/questions/1608377):

1. Type `about:config` in Firefox’s address bar and press Enter.
2. Accept the warning to continue to the advanced preferences.
3. Search for `browser.nova.enabled`.
4. If the existing preference is `true`, double-click it or use its toggle button to set it to `false`.
5. Restart Firefox if the interface does not update immediately. You can reverse the change by setting the preference back to `true`.

Treat this as a temporary workaround. A moderator in that support discussion says the preference is expected to be removed in the future. Its presence today does not guarantee that later Firefox versions will retain the old interface. If the preference is absent, creating a new entry with that name will not restore code that has been removed.

**Customize Firefox’s appearance.** The [r/FirefoxCSS community](https://www.reddit.com/r/FirefoxCSS/) shares browser-interface styles and helps people adapt them. These changes typically use `userChrome.css`, which styles Firefox’s own interface. That gives you options beyond choosing a different color theme.

[WaveFox](https://github.com/QNetITQ/WaveFox) is one project to explore for configurable tab shapes and other interface adjustments. Follow its current README for installation and version requirements. The current WaveFox Nova release requires Firefox 157 or newer, custom stylesheets enabled, and **Nova enabled**. If you turned Nova off using the steps above, re-enable it before following that release’s instructions.

Custom CSS takes some maintenance as Firefox changes. Keep a copy of your existing customization and start with changes aimed at the particular thing bothering you.

**Try a different browser.** [Zen Browser](https://zen-browser.app/) is an alternative with its own interface, including workspaces, compact mode and split view. It is [built on Firefox](https://github.com/zen-browser/desktop), but offers a different approach to organizing your browsing. Try your everyday sites and extensions before deciding whether it fits your workflow.

</details>

You can change a preference, customize the interface or choose another browser. You can also give Mozilla specific feedback about what became harder to use. None of those choices requires pretending to like Nova.

## “AI slop” has the same problem

I use “AI slop” to describe low-quality generated work pushed out with little care for whether it is correct or useful. Fabricated explanations, barely functional apps and repetitive material published without review deserve criticism.

The carelessness matters. Knowing that AI helped produce something tells us about its production method. It leaves the quality of the result to be established.

Treating every AI-assisted project as slop makes that distinction disappear. A working application built against clear requirements gets put in the same bucket as a demo whose save button silently loses data.

AI assistance lowers the barrier to attempting software projects. That opens the door to useful small tools and to people shipping things they do not understand. We should expect to evaluate the work in front of us.

An app that fails to save your work has a demonstrable defect. A keyboard user trapped in a dialog has identified a real accessibility problem. A bland interface can fairly be called bland. None of those judgments requires guessing what tool wrote the code.

A familiar color palette or card layout, meanwhile, tells you very little about authorization checks, data integrity or maintainability. It may suggest a design trend. It cannot substitute for inspecting the software.

## Users can judge their experience. Engineering claims need more.

Users are qualified to say an application is frustrating, confusing or useless to them. They should never need a software engineering credential to report a bug.

Judging the engineering behind it takes different evidence. Someone declaring a codebase insecure or unmaintainable should be able to identify the unsafe behavior or explain the design problem. A screenshot is usually insufficient.

Most of us lack the expertise to audit much of the software we use. Even an experienced developer can be out of their depth in an unfamiliar domain. Reading a polished interface does not reveal whether its backend leaks private records; reading an ugly one does not reveal that it does.

The confidence of a drive-by “slop” verdict often exceeds the investigation behind it. The commenter has established a dislike and offered a conclusion about the entire project.

That is a poor basis for dismissing someone’s work, particularly when the person has actually done the engineering needed to make it dependable.

## AI can do serious implementation work

A capable coding agent, guided by strong engineering fundamentals and guardrails, can handle substantial parts of the scoped implementation work commonly assigned to a mid-level software engineer. That is a useful way to organize the work: give it a defined problem, an existing architecture and a way to check its changes.

The comparison applies to implementation tasks. A human still has to own the product decisions and decide whether the resulting change is safe to ship. Performance depends on the model, the task and the environment it works in.

Consider an illustrative assignment: add CSV export to an existing application.

The engineer defines which records the user may export, which fields belong in the file and how large exports should behave. They decide how to handle untrusted cell values. The agent can then build the endpoint and interface within the application’s existing conventions.

Verification should exercise the boundaries: an unauthorized request fails; another user’s records never appear; commas and quotes survive export correctly; spreadsheet formulas receive the intended treatment. A human checks the actual downloaded file and reviews the code before release.

That is useful engineering work. Getting a plausible-looking button onto a page would have been a much smaller achievement.

[Anthropic’s engineering write-up on long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) describes this dependence on the surrounding process. Its experiments found agents taking on too much at once or declaring completion prematurely. Explicit feature lists, incremental changes and testing through the running application helped address those failures. The authors also document remaining limitations.

The lesson is practical: give the agent feedback that can expose its mistakes, and require it to resolve them.

## Matt Pocock’s software factory has a quality process

[Matt Pocock’s YouTube channel](https://www.youtube.com/@mattpocockuk) is a useful example of taking AI-assisted software development seriously. His accompanying [AI Hero material](https://www.aihero.dev/) puts engineering fundamentals at the center of the process, from shaping an idea through implementation and review.

His [guide to AI coding feedback loops](https://www.aihero.dev/essential-ai-coding-feedback-loops-for-type-script-projects) shows how type checking, automated tests and pre-commit hooks give an agent concrete information about whether its changes work. A failed check blocks the commit and gives the agent an error to address.

His [Ralph guide](https://www.aihero.dev/tips-for-ai-coding-with-ralph-wiggum) extends the approach to agents working through a task list. It emphasizes explicit scope, progress tracking and small changes. It also recommends starting with human supervision, keeping people involved in risky architectural work and reviewing the commits produced by unattended runs.

That provides a credible model for an AI-powered software factory. An engineer defines the work and the quality bar. Agents perform bounded implementation work, receive feedback and produce changes that can be reviewed.

The quality bar needs to be meaningful. A test can faithfully confirm the wrong requirement. An agent can make a check pass by weakening it. Green checks still require someone to consider what they actually prove and to use the application.

Good engineering makes the factory useful by giving it ways to catch defects and someone responsible for the result. It does not promise defect-free software. Human teams cannot offer that promise either.

Calling everything this process produces “slop” ignores the work that determines its quality. The tool used to write the first draft of the code is a remarkably weak basis for judging the finished product.

## Make the criticism earn its conclusion

Both terms are worth keeping. Enshittification helps describe how a service extracts value from people who depend on it. AI slop helps describe generated work published with insufficient care.

Using them as reflexive insults makes them less useful.

“The new tabs are harder for me to distinguish” gives a developer something to investigate. “The export loses these fields” identifies a failure. An account of how a company made its service worse to extract more money supplies a case for enshittification.

“I don’t like it” is also a complete and honest statement.

If you want to make a stronger claim, do the work to support it. Show the defect. Explain the incentive. Give the person who built it something more substantial than a fashionable word for contempt.', 'post', 'published', (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1), CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000, 'https://media.orboro.net/images/criticism-needs-evidence-header-v3.webp')
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  markdown = excluded.markdown,
  page_type = excluded.page_type,
  status = excluded.status,
  published_at = COALESCE(content.published_at, excluded.published_at),
  updated_at = excluded.updated_at,
  featured_image_url = excluded.featured_image_url;
INSERT OR IGNORE INTO content_categories (content_id, category_id)
SELECT (SELECT id FROM content WHERE slug = 'criticism-needs-evidence'), id
FROM categories WHERE slug IN ('development', 'personal');
INSERT INTO media (id, url, alt_text, caption, created_by, created_at)
VALUES ('5a7894b1-60d8-4794-b6f5-37c91e1e8af0', 'https://media.orboro.net/images/criticism-needs-evidence-header-v3.webp', 'Cartoon JD thoughtfully examines a software project while thumbs-down speech bubbles float above his monitor.', 'Header artwork for When “enshittification” and “AI slop” mean “I don’t like it”; corrected hand anatomy.', (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1), CAST(strftime('%s', 'now') AS INTEGER) * 1000)
ON CONFLICT(id) DO UPDATE SET url = excluded.url, alt_text = excluded.alt_text, caption = excluded.caption;
