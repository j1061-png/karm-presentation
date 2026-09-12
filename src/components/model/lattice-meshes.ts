import * as THREE from "three";
import type { ModelObject } from "@/lib/schema";
import type { ShadingMode } from "./studio-engine";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function isLatticeMeshType(type: string) {
  return type === "lattice";
}

/** Cubic metal space-frame. Bars are shared-geometry boxes so a 3×2×3 cell stays cheap. */
export function buildLattice(group: THREE.Group, src: ModelObject, shading: ShadingMode) {
  const p = src.params ?? {};
  const w = clamp(p.width ?? 2.4, 0.3, 20);
  const h = clamp(p.height ?? 1.8, 0.3, 20);
  const d = clamp(p.depth ?? 2.4, 0.3, 20);
  const nx = clamp(Math.round(p.cellsX ?? 3), 1, 8);
  const ny = clamp(Math.round(p.cellsY ?? 2), 1, 8);
  const nz = clamp(Math.round(p.cellsZ ?? 3), 1, 8);
  const bar = clamp(p.bar ?? 0.045, 0.012, 0.28);
  const diagonals = (p.diagonals ?? 0) >= 1;

  const steel = new THREE.MeshStandardMaterial({
    color: src.material?.color ?? "#9aa3ab",
    metalness: src.material?.metalness ?? 0.88,
    roughness: src.material?.roughness ?? 0.32,
    emissive: src.material?.emissive ?? "#000000",
    emissiveIntensity: src.material?.emissiveIntensity ?? 0,
    wireframe: shading === "wire" || !!src.material?.wireframe,
    flatShading: shading === "solid",
  });

  const cellW = w / nx;
  const cellH = h / ny;
  const cellD = d / nz;
  const x0 = -w / 2;
  const y0 = -h / 2;
  const z0 = -d / 2;
  const geoX = new THREE.BoxGeometry(cellW, bar, bar);
  const geoY = new THREE.BoxGeometry(bar, cellH, bar);
  const geoZ = new THREE.BoxGeometry(bar, bar, cellD);
  let primary = true;

  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, steel);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (primary) {
      mesh.userData.primary = true;
      primary = false;
    }
    group.add(mesh);
  };

  for (let iy = 0; iy <= ny; iy++) {
    for (let iz = 0; iz <= nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        add(geoX, x0 + (ix + 0.5) * cellW, y0 + iy * cellH, z0 + iz * cellD);
      }
    }
  }
  for (let ix = 0; ix <= nx; ix++) {
    for (let iz = 0; iz <= nz; iz++) {
      for (let iy = 0; iy < ny; iy++) {
        add(geoY, x0 + ix * cellW, y0 + (iy + 0.5) * cellH, z0 + iz * cellD);
      }
    }
  }
  for (let ix = 0; ix <= nx; ix++) {
    for (let iy = 0; iy <= ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        add(geoZ, x0 + ix * cellW, y0 + iy * cellH, z0 + (iz + 0.5) * cellD);
      }
    }
  }

  if (!diagonals) return;

  const diagLen = Math.hypot(cellW, cellH);
  const geoDiag = new THREE.BoxGeometry(diagLen, bar * 0.85, bar * 0.85);
  const tilt = Math.atan2(cellH, cellW);
  for (let iz of [0, nz]) {
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        add(
          geoDiag,
          x0 + (ix + 0.5) * cellW,
          y0 + (iy + 0.5) * cellH,
          z0 + iz * cellD,
          0,
          0,
          -tilt
        );
      }
    }
  }
}
