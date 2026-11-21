"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CustomEase } from "gsap/CustomEase";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(useGSAP, Flip, CustomEase);

/** Classic easeOutCubic (Penner) — 250ms default for UI state changes. */
CustomEase.create("ease-out-cubic", "0.215,0.61,0.355,1");

export const MOTION = {
  duration: 0.25,
  ease: "ease-out-cubic",
} as const;

gsap.defaults(MOTION);

const FLIP_PROPS = "backgroundColor,borderColor,color,opacity";

export function captureFlipState(root: ParentNode | null) {
  if (!root) return null;
  const targets = gsap.utils.toArray<Element>("[data-flip]", root);
  if (targets.length === 0) return null;
  return Flip.getState(targets, { props: FLIP_PROPS });
}

export function playFlip(state: Flip.FlipState | null) {
  if (!state) return;
  return Flip.from(state, {
    ...MOTION,
    absolute: false,
    nested: true,
  });
}

export { gsap, useGSAP, Flip };
