# Design of the web app

The design of Data Hub as it was worked out in a design session on 2026-10-22: the rules, the style values and two screens as working prototypes.

## Contents

```text
docs/design/
├── README.md              this file
├── principles.md          the rules and decisions (source of truth)
├── tokens.css             all style values
├── base.css               the components of the prototype
├── handover-prompt.md     the opening message for Claude Code
└── screens/
    ├── index.html         overview of the screens
    ├── collections-start.html
    ├── resource-detail.html
    └── app.js             behaviour of the prototype (theme, panel, tabs, search)
```

## How to go on

1. **View the screens** by opening `docs/design/screens/index.html` in your browser, from a checkout of this repository. You need internet for the font and the icons.
2. **Start Claude Code** in the repository and paste [the handover prompt](handover-prompt.md) as the first message.

## What you can do in the screens

- Click the active icon on the left, or the double arrow, to slide the panel in and out.
- Type in the search field of the panel to filter the list.
- Switch between light and dark with the moon.
- On the start screen: dismiss the intro, and switch between Updated and Added.
- Click "Credit leads" in the panel to go to the detail page, and the arrow to go back.
- On the detail page: switch between the tabs Overview and Columns.

All content is placeholder.
