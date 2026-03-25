#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRoutaTokens } from "./color-tokens.mjs";
import {
  addBody,
  addBulletList,
  addCard,
  addFullBleed,
  addHeadline,
  addKicker,
  addSectionTitle,
  createDeck,
  ensureDir,
  fileExists,
  readJson,
  resolveOutputPath,
} from "./ppt-theme.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(toolRoot, "..", "..");
const releaseNotePath = path.join(repoRoot, "docs", "releases", "v0.2.7-release-notes.md");
const screenshotManifestPath = resolveOutputPath(toolRoot, "screenshots", "manifest.json");
const outputFile = resolveOutputPath(toolRoot, "routa-product-showcase-deck.pptx");

const tokens = loadRoutaTokens();
const pptx = createDeck({
  title: "Routa Product Showcase Deck",
  subject: "Release and product showcase deck",
  lang: "en-US",
});
const shapeType = pptx.ShapeType;

function readReleaseNotes() {
  const source = fs.readFileSync(releaseNotePath, "utf8");
  const title = source.match(/^#\s+(.+)$/m)?.[1] ?? "Routa Release";
  const releaseDate = source.match(/\*\*Release Date\*\*:\s+(.+)$/m)?.[1]?.trim() ?? "";
  const tag = source.match(/\*\*Tag\*\*:\s+`(.+)`/m)?.[1] ?? "";
  const overviewBlock = source.split("## Overview")[1]?.split("## Key Highlights")[0] ?? "";
  const overview = overviewBlock
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("##"))
    .map((line) => line.replace(/`/g, ""));

  const highlightChunks = (source.split("## Key Highlights")[1]?.split("## Technical Summary")[0] ?? "")
    .split("\n### ")
    .slice(1);

  const highlights = highlightChunks.map((chunk) => {
    const [headingLine, ...rest] = chunk.split(/\r?\n/);
    const body = rest.join("\n");
    const bulletPart = body.split("User impact:")[0];
    const impactPart = body.split("User impact:")[1] ?? "";
    return {
      title: headingLine.trim(),
      bullets: bulletPart
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2).replace(/`/g, "")),
      impact: impactPart
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2).replace(/`/g, "")),
    };
  });

  return { title, releaseDate, tag, overview, highlights };
}

function loadScreenshots() {
  return readJson(screenshotManifestPath, []);
}

function addHeroSlide(doc) {
  const slide = pptx.addSlide();
  const dark = tokens.desktop.dark;
  addFullBleed(slide, shapeType, dark["--dt-bg-primary"]);

  slide.addShape(shapeType.arc, {
    x: 8.6,
    y: -0.8,
    w: 5,
    h: 3.4,
    line: { color: dark["--dt-brand-blue"], transparency: 100 },
    fill: { color: dark["--dt-brand-blue"], transparency: 28 },
  });
  slide.addShape(shapeType.arc, {
    x: 7.6,
    y: 4.2,
    w: 5.4,
    h: 3.1,
    line: { color: dark["--dt-brand-purple"], transparency: 100 },
    fill: { color: dark["--dt-brand-purple"], transparency: 18 },
  });

  addKicker(slide, doc.tag || "v0.2.7", dark["--dt-brand-blue-soft"], 0.82, 0.82, 2.2);
  addHeadline(slide, "Product Showcase", dark["--dt-text-primary"], 0.8, 1.2, 4.2, 0.46, 16);
  addHeadline(slide, doc.title.replace(/^Release\s+/, ""), dark["--dt-text-primary"], 0.8, 1.72, 6.8, 0.9, 26);
  addBody(slide, doc.overview[0] ?? "Desktop workflow, automation, and coordination improvements.", dark["--dt-text-secondary"], 0.82, 2.8, 5.9, 0.7, 11);

  const stats = [
    { label: "Release Date", value: doc.releaseDate, color: dark["--dt-brand-blue"] },
    { label: "Highlights", value: `${doc.highlights.length} themes`, color: dark["--dt-brand-orange"] },
    { label: "Visual Style", value: "Showcase", color: dark["--dt-brand-green"] },
  ];
  stats.forEach((entry, index) => {
    const x = 0.82 + index * 1.95;
    addCard(slide, shapeType, {
      x, y: 5.08, w: 1.7, h: 1.02,
      line: { color: dark["--dt-border"], transparency: 55 },
      fill: { color: entry.color, transparency: 8 },
      radius: 0.12,
    });
    slide.addText(entry.label, {
      x: x + 0.14, y: 5.28, w: 1.1, h: 0.12,
      fontSize: 8, color: dark["--dt-text-muted"], margin: 0,
    });
    slide.addText(entry.value, {
      x: x + 0.14, y: 5.55, w: 1.2, h: 0.16,
      fontSize: 10.2, bold: true, color: dark["--dt-text-primary"], margin: 0,
    });
  });
}

function addNarrativeSlide(doc) {
  const slide = pptx.addSlide();
  const light = tokens.desktop.light;
  addFullBleed(slide, shapeType, light["--dt-bg-primary"]);
  addSectionTitle(slide, {
    eyebrow: "Narrative",
    title: "What this release is trying to fix",
    body: "Instead of presenting technical areas only, this layout keeps the story tied to operator experience and workflow confidence.",
    theme: {
      kicker: light["--dt-brand-purple"],
      title: light["--dt-text-primary"],
      body: light["--dt-text-secondary"],
    },
  });

  addCard(slide, shapeType, {
    x: 0.8, y: 2.05, w: 12, h: 4.85,
    line: { color: light["--dt-border"] },
    fill: { color: "FFFFFF" },
  });

  const accents = [
    light["--dt-brand-blue"],
    light["--dt-brand-orange"],
    light["--dt-brand-green"],
    light["--dt-brand-purple"],
  ];

  doc.overview.slice(0, 4).forEach((paragraph, index) => {
    const x = 1.05 + (index % 2) * 5.65;
    const y = 2.45 + Math.floor(index / 2) * 1.6;
    const accent = accents[index % accents.length];
    slide.addShape(shapeType.rect, {
      x, y, w: 0.08, h: 0.78,
      line: { color: accent, transparency: 100 },
      fill: { color: accent },
    });
    slide.addText(paragraph, {
      x: x + 0.22, y, w: 5.05, h: 0.72,
      fontSize: 9.6, color: light["--dt-text-secondary"], margin: 0,
    });
  });
}

function addFeatureGridSlide(doc) {
  const slide = pptx.addSlide();
  const light = tokens.desktop.light;
  addFullBleed(slide, shapeType, light["--dt-bg-secondary"]);
  addSectionTitle(slide, {
    eyebrow: "Feature Grid",
    title: "Five highlights, card-based",
    body: "This is the most presentation-friendly format when you need fast scanability rather than dense appendix detail.",
    theme: {
      kicker: light["--dt-brand-orange"],
      title: light["--dt-text-primary"],
      body: light["--dt-text-secondary"],
    },
  });

  const colors = [
    light["--dt-brand-blue"],
    light["--dt-brand-orange"],
    light["--dt-brand-green"],
    light["--dt-brand-purple"],
    light["--dt-brand-red"],
  ];

  doc.highlights.slice(0, 5).forEach((highlight, index) => {
    const x = 0.8 + (index % 2) * 6.05;
    const y = 2.02 + Math.floor(index / 2) * 1.58;
    const color = colors[index];
    addCard(slide, shapeType, {
      x, y, w: 5.55, h: index === 4 ? 1.2 : 1.34,
      line: { color: light["--dt-border"] },
      fill: { color: "FFFFFF" },
    });
    slide.addShape(shapeType.roundRect, {
      x: x + 0.2, y: y + 0.18, w: 1.22, h: 0.28,
      rectRadius: 0.1,
      line: { color, transparency: 100 },
      fill: { color },
    });
    slide.addText(highlight.title.replace(/^\d+\.\s*/, ""), {
      x: x + 1.6, y: y + 0.18, w: 3.5, h: 0.18,
      fontSize: 10, bold: true, color: light["--dt-text-primary"], margin: 0,
    });
    slide.addText((highlight.impact[0] ?? highlight.bullets[0] ?? "").slice(0, 110), {
      x: x + 0.22, y: y + 0.62, w: 4.95, h: 0.45,
      fontSize: 8.5, color: light["--dt-text-secondary"], margin: 0,
    });
  });
}

function addShowcaseSlide(screenshots) {
  const slide = pptx.addSlide();
  const light = tokens.desktop.light;
  addFullBleed(slide, shapeType, light["--dt-bg-primary"]);
  addSectionTitle(slide, {
    eyebrow: "Showcase",
    title: "Real UI surfaces",
    body: "If screenshots exist, this slide becomes evidence. If not, it still acts as a designed placeholder for future capture.",
    theme: {
      kicker: light["--dt-brand-green"],
      title: light["--dt-text-primary"],
      body: light["--dt-text-secondary"],
    },
  });

  const entries = screenshots.slice(0, 3);
  entries.forEach((entry, index) => {
    const x = 0.82 + index * 4.1;
    addCard(slide, shapeType, {
      x, y: 2.15, w: 3.55, h: 4.5,
      line: { color: light["--dt-border"] },
      fill: { color: "FFFFFF" },
    });
    if (fileExists(entry.file)) {
      slide.addImage({
        path: entry.file,
        x: x + 0.12,
        y: 2.27,
        w: 3.31,
        h: 2.55,
      });
    }
    slide.addText(entry.id, {
      x: x + 0.16, y: 5.02, w: 1.3, h: 0.15,
      fontSize: 8.8, bold: true, color: light["--dt-text-primary"], margin: 0,
    });
    slide.addText(entry.description || entry.route, {
      x: x + 0.16, y: 5.28, w: 3.05, h: 0.35,
      fontSize: 7.8, color: light["--dt-text-secondary"], margin: 0,
    });
  });

  if (entries.length === 0) {
    addCard(slide, shapeType, {
      x: 1.15, y: 2.25, w: 11.1, h: 4.1,
      line: { color: light["--dt-border-light"] },
      fill: { color: light["--dt-bg-secondary"] },
    });
    slide.addText("No captured screenshots yet", {
      x: 4.7, y: 3.65, w: 3.4, h: 0.2,
      fontSize: 14, bold: true, color: light["--dt-text-primary"], margin: 0,
    });
    slide.addText("Run `npm run capture:screenshots` in tools/ppt-template when a local UI is available.", {
      x: 3.55, y: 4.05, w: 5.9, h: 0.16,
      fontSize: 8.8, color: light["--dt-text-secondary"], margin: 0,
    });
  }
}

function addImpactSlide(doc) {
  const slide = pptx.addSlide();
  const dark = tokens.desktop.dark;
  addFullBleed(slide, shapeType, dark["--dt-bg-secondary"]);
  addSectionTitle(slide, {
    eyebrow: "Impact",
    title: "User-facing outcomes",
    body: "A cleaner closing slide when the audience cares more about confidence and operations than code changes.",
    theme: {
      kicker: dark["--dt-brand-blue-soft"],
      title: dark["--dt-text-primary"],
      body: dark["--dt-text-secondary"],
    },
  });

  const items = doc.highlights.flatMap((highlight) => highlight.impact).slice(0, 6);
  addCard(slide, shapeType, {
    x: 0.8, y: 2.15, w: 12, h: 4.7,
    line: { color: dark["--dt-border"] },
    fill: { color: dark["--dt-bg-primary"], transparency: 8 },
  });
  addBulletList(slide, shapeType, items, {
    x: 1.08,
    y: 2.6,
    w: 10.9,
    bulletColor: dark["--dt-brand-green"],
    textColor: dark["--dt-text-secondary"],
    fontSize: 10.2,
    lineGap: 0.62,
  });
}

async function main() {
  ensureDir(path.dirname(outputFile));
  const doc = readReleaseNotes();
  const screenshots = loadScreenshots();

  addHeroSlide(doc);
  addNarrativeSlide(doc);
  addFeatureGridSlide(doc);
  addShowcaseSlide(screenshots);
  addImpactSlide(doc);

  await pptx.writeFile({ fileName: outputFile });
  console.log(`Generated product showcase deck: ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
