#!/usr/bin/env python3
"""Check and index the requirements in docs/.

Usage:
    python3 scripts/requirements.py check   # validate IDs, statuses, anchors and links
    python3 scripts/requirements.py build   # regenerate docs/requirements/traceability.md

The conventions this script enforces are described in docs/requirements/README.md.
Standard library only, so it runs anywhere Python 3.9+ does.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
REQUIREMENTS = DOCS / "requirements"
MATRIX = REQUIREMENTS / "traceability.md"
REPO_URL = "https://github.com/maximethenextimmoscoopbe/immoscoop-dataplatform-datahub"

ID = r"(?:FR|TR|NFR|DEC|EC|OP)-[A-Z]{2,3}-\d{2,3}"
HEADING_KINDS = {"FR", "EC", "TR", "NFR"}
LIST_KINDS = {"DEC", "OP"}
STATUSES = ["Proposed", "Specified", "Implemented", "Verified", "Withdrawn"]

HEADING_DEF = re.compile(rf"^#{{2,4}}\s+({ID})\s+·\s+(.+?)\s*$")
LIST_DEF = re.compile(rf'^\s*-\s+(?:\[([ x])\]\s+)?<a id="([^"]+)"></a>\*\*({ID})\*\*\s+·\s+(.+)$')
ANCHOR_LINE = re.compile(r'^<a id="([^"]+)"></a>\s*$')
ANCHOR = re.compile(r'<a id="([^"]+)"></a>')
HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
STATUS = re.compile(r"\*\*Status:\*\*\s+([A-Za-z]+)")
ALIAS = re.compile(r"\*\*Confluence:\*\*\s+([A-Z]+-\d+)")
REALISES = re.compile(r"\*\*Realises:\*\*(.*)")
APPLIES = re.compile(r"\*\*Applies to:\*\*(.*)")
LINK = re.compile(r"(?<!!)\[([^\]]*)\]\(([^)\s]+)\)")
MENTION = re.compile(rf"(?<![\w-])({ID})(?![\w-])")
TRAILER = re.compile(r"^\W*(Implements|Refs):\s*(.+)$", re.MULTILINE)
FENCE = re.compile(r"^(```|~~~)")


@dataclass
class Item:
    id: str
    kind: str
    title: str
    file: Path
    line: int
    status: str = ""
    alias: str = ""
    realises: list[str] = field(default_factory=list)
    applies_to: list[str] = field(default_factory=list)


@dataclass
class Doc:
    path: Path
    lines: list[str]
    title: str = ""
    anchors: set[str] = field(default_factory=set)


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def is_skipped(path: Path) -> bool:
    """Templates contain placeholder IDs; the matrix is generated from everything else."""
    return "_templates" in path.parts or path == MATRIX


def strip_code(lines: list[str]) -> list[str]:
    """Blank out fenced code blocks, inline code and HTML comments, keeping line numbers."""
    out, in_fence, in_comment = [], False, False
    for line in lines:
        if FENCE.match(line.strip()):
            in_fence = not in_fence
            out.append("")
            continue
        if in_fence:
            out.append("")
            continue
        if in_comment:
            if "-->" in line:
                in_comment = False
                line = line.split("-->", 1)[1]
            else:
                out.append("")
                continue
        line = re.sub(r"<!--.*?-->", "", line)
        if "<!--" in line:
            in_comment = True
            line = line.split("<!--", 1)[0]
        out.append(re.sub(r"`[^`]*`", "", line))
    return out


def github_slug(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = text.replace("`", "").replace("*", "").strip().lower()
    text = re.sub(r"[^\w\- ]", "", text)
    return text.replace(" ", "-")


def load_docs() -> dict[Path, Doc]:
    docs = {}
    for path in sorted(DOCS.rglob("*.md")):
        lines = path.read_text(encoding="utf-8").splitlines()
        doc = Doc(path, lines)
        seen: dict[str, int] = defaultdict(int)
        for line in strip_code(lines):
            m = HEADING.match(line)
            if m:
                if not doc.title and len(m.group(1)) == 1:
                    doc.title = m.group(2)
                slug = github_slug(m.group(2))
                doc.anchors.add(slug if seen[slug] == 0 else f"{slug}-{seen[slug]}")
                seen[slug] += 1
            doc.anchors.update(ANCHOR.findall(line))
        docs[path] = doc
    return docs


def link_ids(text: str) -> list[str]:
    return MENTION.findall(text)


def parse_items(docs: dict[Path, Doc], errors: list[str]) -> dict[str, Item]:
    items: dict[str, Item] = {}
    for path, doc in docs.items():
        if is_skipped(path):
            continue
        lines = strip_code(doc.lines)
        for i, line in enumerate(lines):
            item = None
            m = HEADING_DEF.match(line)
            if m:
                ident, title = m.groups()
                item = Item(ident, ident.split("-")[0], title, path, i + 1)
                prev = next((lines[j] for j in range(i - 1, -1, -1) if lines[j].strip()), "")
                above = ANCHOR_LINE.match(prev.strip())
                if not above or above.group(1) != ident.lower():
                    errors.append(f"{rel(path)}:{i + 1}: {ident} needs the line <a id=\"{ident.lower()}\"></a> right above it")
                if item.kind not in HEADING_KINDS:
                    errors.append(f"{rel(path)}:{i + 1}: {ident} must be a list item, not a heading")
                block = []
                for nxt in lines[i + 1:]:
                    if HEADING.match(nxt):
                        break
                    block.append(nxt)
                text = "\n".join(block)
                status = STATUS.search(text)
                if not status:
                    errors.append(f"{rel(path)}:{i + 1}: {ident} has no **Status:** line")
                elif status.group(1) not in STATUSES:
                    errors.append(f"{rel(path)}:{i + 1}: {ident} has unknown status '{status.group(1)}' (allowed: {', '.join(STATUSES)})")
                else:
                    item.status = status.group(1)
                if alias := ALIAS.search(text):
                    item.alias = alias.group(1)
                if realises := REALISES.search(text):
                    item.realises = link_ids(realises.group(1))
                if applies := APPLIES.search(text):
                    item.applies_to = link_ids(applies.group(1))
                if item.kind == "TR" and not item.realises:
                    errors.append(f"{rel(path)}:{i + 1}: {ident} must link at least one requirement in a **Realises:** line")
            m = LIST_DEF.match(line) if not item else None
            if m:
                box, anchor, ident, text = m.groups()
                item = Item(ident, ident.split("-")[0], text, path, i + 1)
                if anchor != ident.lower():
                    errors.append(f"{rel(path)}:{i + 1}: anchor '{anchor}' does not match {ident}")
                if item.kind not in LIST_KINDS:
                    errors.append(f"{rel(path)}:{i + 1}: {ident} must be a heading, not a list item")
                if item.kind == "OP":
                    if box is None:
                        errors.append(f"{rel(path)}:{i + 1}: {ident} needs a checkbox, [ ] or [x]")
                    item.status = "Done" if box == "x" else "Open"
                else:
                    item.status = "Decided"
            if item:
                if item.id in items:
                    other = items[item.id]
                    errors.append(f"{rel(path)}:{i + 1}: {item.id} is already defined in {rel(other.file)}:{other.line}")
                else:
                    items[item.id] = item
    return items


def check_links(docs: dict[Path, Doc], items: dict[str, Item], errors: list[str]) -> None:
    for path, doc in docs.items():
        if is_skipped(path):
            continue
        for i, line in enumerate(strip_code(doc.lines)):
            where = f"{rel(path)}:{i + 1}"
            for ident in MENTION.findall(line):
                if ident not in items:
                    errors.append(f"{where}: {ident} is mentioned but not defined anywhere")
            for _, target in LINK.findall(line):
                if re.match(r"^[a-z]+:", target):
                    continue
                file_part, _, fragment = target.partition("#")
                dest = (path.parent / file_part).resolve() if file_part else path
                if dest == MATRIX:
                    continue  # generated by build; check reports separately when it is missing
                if not dest.exists():
                    errors.append(f"{where}: link to missing file '{file_part}'")
                    continue
                if fragment and dest.suffix == ".md":
                    anchors = docs[dest].anchors if dest in docs else set()
                    if fragment not in anchors:
                        errors.append(f"{where}: link to missing anchor '#{fragment}' in {rel(dest)}")
                    ident = fragment.upper()
                    if ident in items and items[ident].file != dest:
                        errors.append(f"{where}: {ident} is defined in {rel(items[ident].file)}, not in {rel(dest)}")


def validate() -> tuple[dict[Path, Doc], dict[str, Item], list[str]]:
    errors: list[str] = []
    docs = load_docs()
    items = parse_items(docs, errors)
    check_links(docs, items, errors)
    for item in items.values():
        for ref in item.realises + item.applies_to:
            if ref not in items:
                errors.append(f"{rel(item.file)}:{item.line}: {item.id} refers to unknown {ref}")
    return docs, items, errors


def git_commits(items: dict[str, Item], warnings: list[str]) -> dict[str, list[tuple[str, str, str, str]]]:
    """Map each ID to the commits whose Implements:/Refs: trailers name it."""
    try:
        log = subprocess.run(
            ["git", "log", "--date=short", "--format=%H%x1f%h%x1f%ad%x1f%B%x1e"],
            cwd=ROOT, capture_output=True, text=True, check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as exc:
        warnings.append(f"git log unavailable, commit column left empty: {exc}")
        return {}
    commits: dict[str, list[tuple[str, str, str, str]]] = defaultdict(list)
    for record in log.split("\x1e"):
        if not record.strip():
            continue
        full, short, date, body = record.strip("\n").split("\x1f", 3)
        for kind, rest in TRAILER.findall(body):
            for ident in MENTION.findall(rest):
                if ident not in items:
                    warnings.append(f"commit {short} names unknown {ident} in its {kind}: trailer")
                    continue
                entry = (full, short, date, kind)
                if entry not in commits[ident]:
                    commits[ident].append(entry)
    return commits


def relative_link(path: Path, base: Path) -> str:
    return Path(os.path.relpath(path, base.parent)).as_posix()


def link_to(item: Item, base: Path) -> str:
    return f"[{item.id}]({relative_link(item.file, base)}#{item.id.lower()})"


def build(docs: dict[Path, Doc], items: dict[str, Item], warnings: list[str]) -> str:
    commits = git_commits(items, warnings)
    realised_by: dict[str, list[str]] = defaultdict(list)
    for item in items.values():
        for ref in item.realises:
            realised_by[ref].append(item.id)

    for item in items.values():
        implemented = any(kind == "Implements" for *_, kind in commits.get(item.id, []))
        if item.status in ("Implemented", "Verified") and not implemented:
            warnings.append(f"{item.id} is {item.status} but no commit has 'Implements: {item.id}'")
        if item.status in ("Proposed", "Specified") and implemented:
            warnings.append(f"{item.id} is still {item.status} although a commit implements it")

    def cell_ids(ids: list[str]) -> str:
        return ", ".join(link_to(items[i], MATRIX) for i in ids) or "–"

    def cell_commits(ident: str) -> str:
        found = commits.get(ident, [])
        return "<br>".join(f"[{short}]({REPO_URL}/commit/{full}) {kind.lower()}, {date}" for full, short, date, kind in found) or "–"

    def breakdown(group: list[Item], order: list[str]) -> str:
        if not group:
            return "–"
        counts = defaultdict(int)
        for item in group:
            counts[item.status] += 1
        return f"{len(group)} (" + ", ".join(f"{counts[s]} {s.lower()}" for s in order if counts[s]) + ")"

    by_file: dict[Path, list[Item]] = defaultdict(list)
    for item in items.values():
        by_file[item.file].append(item)
    files = sorted(
        {p for p in by_file} | {p for p in docs if p.parent == REQUIREMENTS / "functional" and re.match(r"\d\d-", p.name)},
        key=lambda p: rel(p),
    )

    def file_link(path: Path) -> str:
        return f"[{docs[path].title or path.stem}]({relative_link(path, MATRIX)})"

    out = [
        "# Traceability matrix",
        "",
        "<!-- Generated by scripts/requirements.py build. Do not edit by hand. -->",
        "",
        "Generated from the requirement files under `docs/` and from the `Implements:` and `Refs:` trailers in the git history.",
        "Regenerate it with `python3 scripts/requirements.py build`; the conventions are in the [requirements README](README.md).",
        "",
        "## Summary",
        "",
        "| File | Requirements | Edge cases | Decisions | Open points |",
        "| --- | --- | --- | --- | --- |",
    ]
    for path in files:
        group = by_file.get(path, [])
        reqs = [i for i in group if i.kind in ("FR", "TR", "NFR")]
        out.append(
            f"| {file_link(path)} | {breakdown(reqs, STATUSES)} | {breakdown([i for i in group if i.kind == 'EC'], STATUSES)}"
            f" | {len([i for i in group if i.kind == 'DEC']) or '–'} | {breakdown([i for i in group if i.kind == 'OP'], ['Open', 'Done'])} |"
        )

    sections = [
        ("Functional requirements", "FR", ["ID", "Title", "Status", "Confluence", "Realised by", "Commits"],
         lambda i: [i.alias or "–", cell_ids(realised_by.get(i.id, []))]),
        ("Edge cases", "EC", ["ID", "Title", "Status", "Realised by", "Commits"],
         lambda i: [cell_ids(realised_by.get(i.id, []))]),
        ("Technical requirements", "TR", ["ID", "Title", "Status", "Realises", "Commits"],
         lambda i: [cell_ids(i.realises)]),
        ("Non-functional requirements", "NFR", ["ID", "Title", "Status", "Applies to", "Realised by", "Commits"],
         lambda i: [cell_ids(i.applies_to), cell_ids(realised_by.get(i.id, []))]),
    ]
    for heading, kind, columns, extra in sections:
        out += ["", f"## {heading}", ""]
        group_files = [p for p in files if any(i.kind == kind for i in by_file.get(p, []))]
        if not group_files:
            out.append("None yet.")
            continue
        for path in group_files:
            out += [f"### {file_link(path)}", "", "| " + " | ".join(columns) + " |", "|" + " --- |" * len(columns)]
            for item in by_file[path]:
                if item.kind == kind:
                    out.append("| " + " | ".join([link_to(item, MATRIX), item.title.replace("|", "\\|"), item.status, *extra(item), cell_commits(item.id)]) + " |")
            out.append("")
        if out[-1] == "":
            out.pop()
    return "\n".join(out) + "\n"


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] not in ("check", "build"):
        print(__doc__.strip())
        return 2
    docs, items, errors = validate()
    for error in errors:
        print(f"error: {error}")
    if errors:
        print(f"\n{len(errors)} error(s); see docs/requirements/README.md for the conventions.")
        return 1
    counts = defaultdict(int)
    for item in items.values():
        counts[item.kind] += 1
    summary = ", ".join(f"{counts[k]} {k}" for k in ("FR", "EC", "TR", "NFR", "DEC", "OP") if counts[k])
    if argv[1] == "check":
        if not MATRIX.exists():
            print(f"error: {rel(MATRIX)} is missing; run: python3 scripts/requirements.py build")
            return 1
        print(f"ok: {summary}")
        return 0
    warnings: list[str] = []
    MATRIX.write_text(build(docs, items, warnings), encoding="utf-8")
    for warning in warnings:
        print(f"warning: {warning}")
    print(f"wrote {rel(MATRIX)}: {summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
