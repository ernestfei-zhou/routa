"use strict";

const registry = require("./registry");
const { PAGE, FONTS, COLORS, MARGINS } = require("./theme");

function renderDiagramSlide(slide, pptx, kind, data) {
  const renderer = registry[kind];
  if (!renderer) {
    throw new Error(`Unknown diagram renderer kind: ${kind}`);
  }
  return renderer(slide, pptx, data);
}

module.exports = {
  registry,
  renderDiagramSlide,
  PAGE,
  FONTS,
  COLORS,
  MARGINS,
};
