# Data Hub design principles

Status: first version, 22 October 2026. Built in a design session with Max.

This file is the source of truth for **the rules** of the design. The **values** (colours, sizes, durations of transitions) live only in [`tokens.css`](tokens.css). The **screens** live in [`screens/`](screens/). Confluence describes this and links to it, but does not duplicate it.

Working agreement: when a rule changes, change this file first, then the tokens and the code.

Its decisions and open points carry IDs with the code `UX`, numbered and linked like the requirements ([requirements conventions](../requirements/README.md)). The web app does not follow this design yet; [OP-UX-07](#op-ux-07) to [OP-UX-13](#op-ux-13) are where it differs from what is decided or built today.

## Sources of truth

| What | Where |
| --- | --- |
| Rules, navigation behaviour, decisions | this file |
| Style values | [`tokens.css`](tokens.css) |
| Components | [`base.css`](base.css) (prototype), later the components in the app |
| Screens | [`screens/*.html`](screens/), each with the requirements it fulfils |

Data Hub is an internal tool and has no Figma. The design lives in code ([DEC-UX-01](#dec-ux-01)).

## General

- The interface is in **English** ([FR-SR-15](../requirements/functional/04-stacks-and-resources.md#fr-sr-15)).
- **Calm and air:** plenty of negative space. Rather less on a screen than a full screen.
- **Full screen.** The content uses the full width, divided into blocks, never long rows or lines across the full width.

## Layers and focus

There are three layers:

1. **Background:** a slow transition between three warm colours (sand, blush, mist).
2. **Frames:** the tab of the active navigation icon, the panel and the main area. Slightly transparent, they blend into the background.
3. **Reading surfaces:** everything with text on it that you actually read. Fully opaque (white, or warm grey within a white surface).

**Focus follows the mouse.** The window the mouse is in gets fully opaque reading surfaces. The other windows become slightly softer.

- By default the focus is on the main area, because that is where the actual work happens.
- The transition is slow and sweeps; it does not switch on and off (`--motion-focus`).
- A short delay (`--delay-focus`) makes sure that a mouse that only passes by sets nothing in motion.
- On touch, hover does not exist: there the window tapped last gets the focus.

## Colour

- **Colour only on content** (charts, Collections, Resources), **never on navigation**.
- Hover and active are **shades of grey**, not colour.
- The palette is **warm grey**. A deliberate deviation from the cool greys in the brandbook, because Data Hub is an internal tool.
- Text is **warm dark grey, never black**.
- Collections get a colour from the Collection palette. Magenta, bordeaux and teal come from the brand; ochre, slate blue and olive are additions.
- **Signal colour** (ochre) only for a state that calls for action, such as a Level that has dropped.

*The app today uses the colours of the brandbook and nine Collection colours of its own: see [OP-UX-08](#op-ux-08) and [OP-UX-09](#op-ux-09).*

## Themes

- Light and dark. Dark is **warm dark grey** ([OP-UX-09](#op-ux-09)).
- By default the theme follows the system. The User can switch; the choice is remembered.

## Typography

- **Poppins**, with its weights for hierarchy: regular for text, medium for titles and names, semibold sparingly.
- One large page title, the rest small and calm.
- Technical names (Keys, columns, Log IDs) in a monospace font.

## Shape

- **Rounding only, never shadow.** Shadow does not work with transparent surfaces.
- Concave corners where two surfaces flow into each other: the active navigation icon into the panel (`--flare-nav`), the active tab into its content (`--flare-tab`).

## Icons

- One family: **Phosphor**.
- **Filled icons** for everything of the interface.
- **Line icons** for what the User chooses, such as the icon of a Collection. They always sit in a circle with a light tint of the colour of the Collection.

*The icon of a Collection comes from Tabler Icons today: see [OP-UX-07](#op-ux-07).*

## Navigation

- **On the left, floating:** the icons have no bar or background of their own. Three to four main items (now Collections, Lenses, Reports; see [OP-UX-11](#op-ux-11)); at the bottom theme, settings and account.
- **Collapsed,** each icon shows a label after a short delay. The active icon keeps its transparent tile.
- **A slide-out panel per main item.** The active icon and the panel form one shape: the icon has the same background as the panel and flows into it with concave corners.

### Navigation rules

1. **Click on another main item:** you go to that section and its panel slides open. The panel always belongs to the active section.
2. **Click on the main item you are already in:** the panel slides in or out. The button in the panel does the same.
3. **Click on an item in the panel:** the detail opens on the right; the panel stays.
4. Whether the panel is open or closed is **remembered per User** ([OP-UX-13](#op-ux-13)).

### What is in the panel

- **At the level of a section:** the index of that section. For Collections: search (filters the list), a plus button for a new Collection, "Your collections" (name, number of Resources, public or private) and "Shared resources" (name, and the team that owns the Resource).
- **Within a Collection:** the Resources of that Collection, each with the maturity icon. Resources that are not published get a struck-through eye. An arrow takes you back to all Collections.

## Start screen per section

Each main item opens on a **start screen**, not on an overview that repeats the panel. The panel is the index; the start screen shows what the list cannot show.

For Collections:

- **Intro** at the top, with a graphic element, "What are collections?", a short explanation, the button "New collection" and a link to more explanation.
  - It can be dismissed. That is saved **per User and per section** in the settings.
  - The intro has a **version number**: after a big change it can appear again.
  - Dismissed: a calm title bar with "Show intro" and the fixed button "New collection".
- **Recently**, switchable between **Updated** and **Added**: what changed, by whom and when.
- **Popular collections.**

## Grid

- The grid is **always 100% wide**.
- Tiles have a **minimum width**; they stretch until there is room for an extra column. That way there is never an empty strip on the right.
- The minimum width depends on the content and is chosen per screen.

## Tabs

- Real tabs: **rounded corners at the top, concave corners at the bottom** that flow into the content surface, and a **fine line** under the row of tabs.
- The content surface under the tabs is a reading surface. Tiles in it get a light warm-grey tint instead of a border.

## Maturity

- The **maturity icon**: six bars, filled up to the current Level (0 Beta, 1 Available, 2 Described, 3 Confirmed, 4 Explored, 5 Monitored).
- When the Level has **dropped**, the previous Level shows as an outlined bar in the signal colour.
- The icon is the fixed symbol for maturity, wherever a Resource appears. On hover it shows the name of the Level.

## Detail page of a Resource

- **Header:** icon of the Collection, name, Key with a copy button, the button "Ask a question".
- **Status row:** maturity, Publication, Owner, freshness, open Signals.
- **Alert on a drop:** what happened, and a button "Reconfirm" for the Owner. It disappears when all is well.
- **Tabs:** Overview, Columns, Lineage, EDA, History, Conversations, Preview.
- **Overview:** the description across the full width, the maturity ladder, Known Behaviour (intended use, pitfalls), the key fields and Parameters, Entities, and recent history with Log IDs.

## Background and motion

- Motion in the background is **very slow** (`--background-cycle`), felt rather than seen.
- Only in the background: reading surfaces never move.
- **"Reduce motion"** in the system turns all animation off. A switch in the settings can do so too.
- Light for the computer: CSS, no video.
- An alternative we tried: three blurred blobs of colour that move slowly. The gradient is the current choice.

## Decisions

All decided on 2026-10-22, in the design session.

- <a id="dec-ux-01"></a>**DEC-UX-01** · No Figma for Data Hub: an internal tool, the design lives in code next to the requirements.
- <a id="dec-ux-02"></a>**DEC-UX-02** · Navigation on the left with a slide-out panel, instead of navigation at the top.
- <a id="dec-ux-03"></a>**DEC-UX-03** · Each section opens on a start screen; the panel is the index. No separate overview screen that repeats the panel.
- <a id="dec-ux-04"></a>**DEC-UX-04** · The "Promoted" feature on the start screen is not built yet.
- <a id="dec-ux-05"></a>**DEC-UX-05** · Background: a gradient of three colours instead of blobs of colour.

## Open points

- [ ] <a id="op-ux-01"></a>**OP-UX-01** · **Popular:** which measure? Views, the number of colleagues, or use in Lenses.
- [ ] <a id="op-ux-02"></a>**OP-UX-02** · **Shared resources** in the panel: align with the model of Publication (visibility hangs on Publication, ownership runs through the Collection).
- [ ] <a id="op-ux-03"></a>**OP-UX-03** · **Start screens** for Lenses and Reports.
- [ ] <a id="op-ux-04"></a>**OP-UX-04** · **Tabs** Lineage, EDA, History, Conversations and Preview.
- [ ] <a id="op-ux-05"></a>**OP-UX-05** · **Collection palette:** align the three additional colours with the chart language.
- [ ] <a id="op-ux-06"></a>**OP-UX-06** · **Screens on mobile** or in narrow windows.

Raised while the design was taken into this repository, on 2026-10-22; not in the design session:

- [ ] <a id="op-ux-07"></a>**OP-UX-07** · **Icons:** this design takes Phosphor as the one family, with its line icons for the icon of a Collection. [DEC-CO-13](../requirements/functional/03-collections.md#dec-co-13) and [DEC-CO-14](../requirements/functional/03-collections.md#dec-co-14) take Tabler Icons, and catalogue and the web app already offer every outline icon of Tabler but the logos of brands. Decide which family Data Hub uses. Moving the icons of existing Collections to Phosphor means mapping their names, as the two sets name their icons differently.
- [ ] <a id="op-ux-08"></a>**OP-UX-08** · **Collection palette:** this design has six colours (magenta, bordeaux, teal, ochre, slate blue, olive). [DEC-CO-07](../requirements/functional/03-collections.md#dec-co-07) and the app have the nine of the "muted" palette by Paul Tol, and catalogue stores those names. Decide which palette applies, and how the colours of existing Collections move over. Together with [OP-UX-05](#op-ux-05) and [OP-CO-02](../requirements/functional/03-collections.md#op-co-02).
- [ ] <a id="op-ux-09"></a>**OP-UX-09** · **Look:** [DEC-PF-22](../requirements/technical/00-platform.md#dec-pf-22) asks for the colours of the brandbook, with teal on larger areas, and one light look without a dark mode. This design has warm greys, colour only on content, and a light and a dark theme. Decide whether this design replaces those parts of DEC-PF-22.
- [ ] <a id="op-ux-10"></a>**OP-UX-10** · **Stack:** decide what builds this design: React with Mantine, as [DEC-PF-06](../requirements/technical/00-platform.md#dec-pf-06) and DEC-PF-22 decide, or Svelte, as other repositories of Immoscoop use (raised on 2026-10-20). The design itself does not depend on it: its values are CSS variables and its prototypes plain HTML and CSS.
- [ ] <a id="op-ux-11"></a>**OP-UX-11** · **Sections:** the navigation holds Collections, Lenses and Reports. The web app today also has Charts, the gallery of the Chart Server, and for the Data Team the search through the dbt projects. Decide where they go.
- [ ] <a id="op-ux-12"></a>**OP-UX-12** · **Capitals in the interface:** the documentation writes Defined Terms with capitals, and so does the interface of the web app today ("New Collection", "Owner Unit"). The prototypes write the interface in sentence case ("New collection", "Your collections", "Owner: Credit team"). Decide which applies to the interface.
- [ ] <a id="op-ux-13"></a>**OP-UX-13** · **Settings of a User:** the state of the panel and the dismissed intros, per section and with their version, are kept per User in the settings, and the theme is remembered. Data Hub has no settings of a User yet, and no requirement for them; the prototypes keep them in the browser. Decide where they are kept: in the browser, or in Data Hub, so that they follow the User to another device.
