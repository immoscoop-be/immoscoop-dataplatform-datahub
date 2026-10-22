# Data Hub design principles

Status: first version, 22 October 2026. Built in a design session with Max.

This file is the source of truth for **the rules** of the design. The **values** (colours, sizes, durations of transitions) live only in [`tokens.css`](tokens.css). The **screens** live in [`screens/`](screens/). Confluence describes this and links to it, but does not duplicate it.

Working agreement: when a rule changes, change this file first, then the tokens and the code.

## Sources of truth

| What | Where |
| --- | --- |
| Rules, navigation behaviour, decisions | this file |
| Style values | [`tokens.css`](tokens.css) |
| Components | [`base.css`](base.css) (prototype), later the components in the app |
| Screens | [`screens/*.html`](screens/), each with the requirements it fulfils |

Data Hub is an internal tool and has no Figma. The design lives in code.

## General

- The interface is in **English**.
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

## Themes

- Light and dark. Dark is **warm dark grey**.
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

## Navigation

- **On the left, floating:** the icons have no bar or background of their own. Three to four main items (now Collections, Lenses, Reports); at the bottom theme, settings and account.
- **Collapsed,** each icon shows a label after a short delay. The active icon keeps its transparent tile.
- **A slide-out panel per main item.** The active icon and the panel form one shape: the icon has the same background as the panel and flows into it with concave corners.

### Navigation rules

1. **Click on another main item:** you go to that section and its panel slides open. The panel always belongs to the active section.
2. **Click on the main item you are already in:** the panel slides in or out. The button in the panel does the same.
3. **Click on an item in the panel:** the detail opens on the right; the panel stays.
4. Whether the panel is open or closed is **remembered per User**.

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

| Date | Decision |
| --- | --- |
| 2026-10-22 | No Figma for Data Hub: an internal tool, the design lives in code next to the requirements. |
| 2026-10-22 | Navigation on the left with a slide-out panel, instead of navigation at the top. |
| 2026-10-22 | Each section opens on a start screen; the panel is the index. No separate overview screen that repeats the panel. |
| 2026-10-22 | The "Promoted" feature on the start screen is not built yet. |
| 2026-10-22 | Background: a gradient of three colours instead of blobs of colour. |

## Open points

- **Popular:** which measure? Views, the number of colleagues, or use in Lenses.
- **Shared resources** in the panel: align with the model of Publication (visibility hangs on Publication, ownership runs through the Collection).
- **Start screens** for Lenses and Reports.
- **Tabs** Lineage, EDA, History, Conversations and Preview.
- **Collection palette:** align the three additional colours with the chart language.
- **Screens on mobile** or in narrow windows.
