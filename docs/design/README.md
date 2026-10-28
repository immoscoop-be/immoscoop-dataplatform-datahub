# Design of the web app

The design of Data Hub as it was worked out in a design session on 2026-10-22: the rules, the style values and two screens as working prototypes. The web app does not follow it yet.

## Contents

```text
docs/design/
├── README.md              this file
├── principles.md          the rules and decisions (source of truth; DEC-UX, OP-UX)
├── tokens.css             all style values
├── base.css               the components of the prototype
├── components.md          every component, its layer, behaviour and dependencies
├── handover-prompt.md     the opening message for Claude Code, once the designs are final
├── build-order.md         the parts in which Data Hub is built, with a prompt per part
└── screens/
    ├── index.html         overview of the screens
    ├── collections-start.html
    ├── resource-detail.html
    └── app.js             behaviour of the prototype (theme, panel, tabs, search)
```

## How we work

1. **The design is documented here.** [`principles.md`](principles.md) holds the rules, [`tokens.css`](tokens.css) the values, and [`screens/`](screens/) the screens as prototypes in plain HTML and CSS. When a rule changes, `principles.md` changes first.
2. **We finalize the designs together, here.** The [open points](principles.md#open-points) are decided, and the screens that are still missing are designed as prototypes, before anything is built. A decision becomes a `DEC-UX` in `principles.md`; nothing is decided by building it.
3. **Only then does building start,** from the [handover prompt](handover-prompt.md). Until then, the web app stays as it is described in [web](../architecture/services/web.md).

## Viewing the screens

Open `docs/design/screens/index.html` in your browser, from a checkout of this repository. You need internet for the font and the icons. GitHub shows these files as source, not as pages.

What you can do in the screens:

- Click the active icon on the left, or the double arrow, to slide the panel in and out.
- Type in the search field of the panel to filter the list.
- Switch between light and dark with the moon.
- On the start screen: dismiss the intro, and switch between Updated and Added.
- Click "Credit leads" in the panel to go to the detail page, and the arrow to go back.
- On the detail page: switch between the tabs Overview and Columns.

All content is placeholder.
