# Handover prompt for Claude Code

The opening message for the Claude Code session that builds this design into the web app. Paste everything below the line as the first message.

---

We are going to integrate the design of Data Hub into the code.

The folder `docs/design/` holds the design, worked out in a design session:

- `docs/design/principles.md` holds the rules and decisions. Read it completely first.
- `docs/design/tokens.css` holds all style values.
- `docs/design/base.css` and `docs/design/screens/` are working prototypes in HTML and CSS.

Agreements:

- `principles.md` is the source of truth for the rules, `tokens.css` for the values. When a rule changes, change `principles.md` first.
- The prototypes are the designs. Take sizes, colours, transitions and behaviour from them, not from your own judgement.
- The content of the screens is placeholder.

What I ask of you:

1. Explore the repo: the stack, the existing frontend and the folder with the requirements. Briefly summarise what you find before you change anything.
2. For each screen in `docs/design/screens/`, find the requirements it fulfils. Put their IDs at the top, in the comment of the screen, and add a reference to the screen to those requirements. Report which requirements have no screen yet, and which parts of the screens have no requirement.
3. Propose how `tokens.css` ends up in the styling of the app (CSS variables, a theme file, or whatever fits the stack), so that there is only one place for each value.
4. Propose a list of components based on the prototypes: navigation with floating icons, slide-out panel, list item, tile, tabs with concave corners, status chip, alert, maturity icon, intro of a start screen.
5. Wait for my approval before you build the components and screens. Then start with the navigation and the panel, because every screen rests on them.

The open points at the bottom of `principles.md` are not decided yet. Ask me about them when you run into them, and make no choice of your own.
