#!/usr/bin/env node
// Genererar 100 förinställda profilbilder via DiceBears publika API
// och sparar som SVG i public/avatars/.
//
// Stil: Lorelei Neutral (bara huvuden, könsneutralt).
// Bakgrund: aktivitetspaletten från src/lib/color-themes.ts, deterministisk
// round-robin (8 färger × ~12-13 = 100). Varje avatar har samma färg varje
// gång — färgen är en funktion av index.
//
// Skriptet är idempotent: hoppar över filer som redan finns.
// Körs manuellt: node scripts/generate-preset-avatars.mjs

import { writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STYLE = "lorelei-neutral";
const VERSION = "9.x";
const PREFIX = "avatar";
const TOTAL = 100;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "avatars");

// Aktivitetspaletten (utan #). Index % 8 ger 4 färger med 13 st och 4 med 12 st.
const PALETTE = [
  "b8cfc0", // sage
  "f5cfb5", // peach
  "bdd4e0", // sky
  "d9a890", // terracotta
  "d1c5de", // lavender
  "e5cf97", // mustard
  "e4c5cd", // rose
  "c7c9c2", // stone
];

const SEEDS = [
  "Anna Lindqvist", "Maria Bergström", "Sara Holmberg", "Karin Nyström",
  "Lena Eriksson", "Eva Sandberg", "Kristina Wallin", "Susanne Forsberg",
  "Linnea Ahlström", "Sofia Karlsson", "Margareta Dahl", "Birgitta Söderlund",
  "Emma Lundgren", "Hanna Engström", "Elsa Vidmark", "Astrid Bjurman",
  "Greta Sjöberg", "Alma Lindahl", "Stina Hellström", "Ingrid Norrman",
  "Klara Forss", "Cecilia Wahlberg", "Marta Ödman", "Inger Brandt",
  "Kerstin Lundin",
  "Erik Andersson", "Lars Holm", "Karl Johansson", "Anders Bergman",
  "Per Strand", "Mikael Lundberg", "Johan Berg", "Olof Wennberg",
  "Nils Sundström", "Bengt Friberg", "Sven Lindgren", "Stefan Almqvist",
  "Magnus Hagberg", "Gunnar Persson", "Björn Ekström", "Hans Norén",
  "Henrik Wikström", "Jonas Roos", "Daniel Sjökvist", "Oskar Vidlund",
  "Axel Falk", "Viktor Hammar", "Gustav Modig", "Fredrik Lind",
  "Mattias Boman",
  "Ebba Söderberg", "Tilde Nordqvist", "Wilma Hedlund", "Saga Lindfors",
  "Nova Bjurman", "Iris Wadin", "Tuva Engdahl", "Vilja Rosén",
  "Lykke Bertilsson", "Maja Westin", "Elin Hallqvist", "Frida Lundkvist",
  "Ida Wessman", "Lovisa Brink", "Moa Frisell", "Nora Sjödin",
  "Sigrid Renström", "Tea Ahlman", "Therese Wikander", "Vera Holmsten",
  "Elliot Bergvall", "Hugo Forslund", "Isak Norling", "Liam Wadlöf",
  "Lukas Hellström", "Melker Boström", "Noah Jansson", "Olle Steen",
  "Otto Hammarström", "Rasmus Vidström", "Theo Ekstrand", "Vincent Adelsten",
  "Walter Sjögren", "William Brink", "Adrian Norén", "Albin Ström",
  "Arvid Wallander", "Edvin Granat", "Felix Sjöblom", "Gabriel Wirén",
  "Hannes Lundén", "Hjalmar Friberg", "Joel Henriksson", "Loke Bergh",
  "Love Ekvall", "Malte Forsell", "Måns Lindwall", "Sixten Wallinder",
  "Vidar Brun", "Wilmer Holmberg",
];

if (SEEDS.length !== TOTAL) {
  throw new Error(`Förväntade ${TOTAL} seeds, hittade ${SEEDS.length}`);
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function fetchSvg(seed, params) {
  const url = `https://api.dicebear.com/${VERSION}/${STYLE}/svg?${new URLSearchParams({ seed, ...params })}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.text();
    if (res.status === 429) {
      const wait = 2000 * attempt;
      console.warn(`  rate-limit, väntar ${wait}ms innan retry...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`HTTP ${res.status} för seed "${seed}"`);
  }
  throw new Error(`gav upp efter 3 försök för seed "${seed}"`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let written = 0;
  let skipped = 0;

  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i];
    const file = `${PREFIX}-${String(i + 1).padStart(3, "0")}.svg`;
    const path = join(OUT_DIR, file);
    if (await exists(path)) {
      skipped++;
      continue;
    }
    const svg = await fetchSvg(seed, { backgroundColor: PALETTE[i % PALETTE.length] });
    await writeFile(path, svg, "utf8");
    written++;
    console.log(`  ${file}  (seed: ${seed})`);
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nKlart. ${written} skrivna, ${skipped} hoppade över.`);
  console.log(`Resultat: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("Fel:", err.message);
  process.exit(1);
});
