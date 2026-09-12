import { createModelObject, defaultMaterial, emptyModelScene, vec } from "./model-object";
import type { ModelObject, ModelScene } from "./schema";

export function createLattice(extras: Partial<ModelObject> = {}): ModelObject {
  return createModelObject("lattice", extras);
}

/** A steel space-frame / lattice on a yard, used when the brief is not solar. */
export function latticeScene(prompt = ""): ModelScene {
  const t = prompt.toLowerCase();
  const scene = emptyModelScene();
  scene.background = "#1a1c20";
  scene.objects.push(
    createModelObject("plane", {
      name: "Ground",
      material: defaultMaterial("#2c2a26"),
      scale: vec(12, 12, 1),
    }),
    createModelObject("light", {
      name: "Sun",
      position: vec(6, 10, 5),
      light: { kind: "directional", intensity: 2, color: "#fff1cc" },
    }),
    createModelObject("light", {
      name: "Fill",
      position: vec(-3, 4, 3),
      light: { kind: "point", intensity: 0.55, color: "#b7c8dc" },
    })
  );

  let lattice: ModelObject;
  if (/\b(fence|grille|trellis|railing)\b/.test(t)) {
    lattice = createLattice({
      name: "Metal fence",
      position: vec(0, 0.7, 0),
      params: { width: 4.2, height: 1.4, depth: 0.16, cellsX: 8, cellsY: 3, cellsZ: 1, bar: 0.035, diagonals: 1 },
    });
    scene.camera = { position: vec(4.2, 1.6, 4.6), target: vec(0, 0.7, 0), fov: 42 };
  } else if (/\b(tower|mast|column)\b/.test(t)) {
    lattice = createLattice({
      name: "Lattice tower",
      position: vec(0, 2.2, 0),
      params: { width: 1.1, height: 4.4, depth: 1.1, cellsX: 2, cellsY: 6, cellsZ: 2, bar: 0.05, diagonals: 1 },
    });
    scene.camera = { position: vec(5.2, 2.4, 5.4), target: vec(0, 1.8, 0), fov: 40 };
  } else if (/\b(truss|bridge|gantry|beam)\b/.test(t)) {
    lattice = createLattice({
      name: "Steel truss",
      position: vec(0, 0.85, 0),
      params: { width: 5.2, height: 1.2, depth: 0.7, cellsX: 8, cellsY: 2, cellsZ: 1, bar: 0.05, diagonals: 1 },
    });
    scene.camera = { position: vec(4.8, 2.1, 5.6), target: vec(0, 0.8, 0), fov: 42 };
  } else {
    lattice = createLattice({
      name: "Steel lattice",
      position: vec(0, 0.9, 0),
      params: { width: 2.4, height: 1.8, depth: 2.4, cellsX: 3, cellsY: 2, cellsZ: 3, bar: 0.045, diagonals: 1 },
    });
    scene.camera = { position: vec(4.4, 2.1, 4.8), target: vec(0, 0.85, 0), fov: 40 };
  }
  scene.objects.push(lattice);
  return scene;
}

/** Ground + lights only — used when the brief is not solar and not a lattice. */
export function workshopScene(): ModelScene {
  const scene = emptyModelScene();
  scene.background = "#161412";
  scene.objects.push(
    createModelObject("plane", { name: "Ground", material: defaultMaterial("#2a2723") }),
    createModelObject("light", {
      name: "Sun",
      position: vec(5, 8, 4),
      light: { kind: "directional", intensity: 1.7, color: "#fff4e0" },
    }),
    createModelObject("light", {
      name: "Fill",
      position: vec(-3, 3, 2),
      light: { kind: "point", intensity: 0.45, color: "#c5d0dc" },
    })
  );
  return scene;
}
