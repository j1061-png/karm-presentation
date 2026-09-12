"use client";

import type { ModelMaterial, ModelObject, Vec3 } from "@/lib/schema";

function Num({
  label,
  value,
  onChange,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11.5px]">
      <span className="w-4 text-text-tertiary">{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-surface-2 border border-border rounded-md px-1.5 py-1 outline-none text-[12px]"
      />
    </label>
  );
}

function VecFields({
  value,
  onChange,
}: {
  value: Vec3;
  onChange: (v: Vec3) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <Num label="X" value={value.x} onChange={(x) => onChange({ ...value, x })} />
      <Num label="Y" value={value.y} onChange={(y) => onChange({ ...value, y })} />
      <Num label="Z" value={value.z} onChange={(z) => onChange({ ...value, z })} />
    </div>
  );
}

export function ModelProperties({
  object,
  onChange,
}: {
  object: ModelObject | null;
  onChange: (patch: Partial<ModelObject>) => void;
}) {
  if (!object) {
    return <p className="text-[12.5px] text-text-tertiary px-3 py-4">Select an object in the viewport or outliner.</p>;
  }
  const mat: ModelMaterial = object.material ?? {
    color: "#c8c4bc",
    metalness: 0.15,
    roughness: 0.45,
    emissive: "#000000",
    emissiveIntensity: 0,
    opacity: 1,
    wireframe: false,
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
      <label className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
        Name
        <input
          value={object.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="mt-1 w-full bg-surface-2 border border-border rounded-md px-2 py-1.5 text-[13px] outline-none"
        />
      </label>
      <div>
        <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide mb-1.5">Location</div>
        <VecFields value={object.position} onChange={(position) => onChange({ position })} />
      </div>
      <div>
        <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide mb-1.5">Rotation</div>
        <VecFields value={object.rotation} onChange={(rotation) => onChange({ rotation })} />
      </div>
      <div>
        <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide mb-1.5">Scale</div>
        <VecFields value={object.scale} onChange={(scale) => onChange({ scale })} />
      </div>
      {object.type === "light" && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">Light</div>
          <select
            value={object.light?.kind ?? "directional"}
            onChange={(e) =>
              onChange({
                light: {
                  kind: e.target.value as NonNullable<ModelObject["light"]>["kind"],
                  intensity: object.light?.intensity ?? 1.2,
                  color: object.light?.color ?? "#fff4e0",
                },
              })
            }
            className="bg-surface-2 border border-border rounded-md px-2 py-1.5 text-[12.5px]"
          >
            <option value="directional">Directional</option>
            <option value="point">Point</option>
            <option value="spot">Spot</option>
            <option value="ambient">Ambient</option>
          </select>
          <Num
            label="I"
            value={object.light?.intensity ?? 1.2}
            step={0.05}
            onChange={(intensity) =>
              onChange({
                light: { kind: object.light?.kind ?? "directional", color: object.light?.color ?? "#fff4e0", intensity },
              })
            }
          />
          <label className="text-[12px] flex items-center gap-2">
            Color
            <input
              type="color"
              value={object.light?.color ?? "#fff4e0"}
              onChange={(e) =>
                onChange({
                  light: { kind: object.light?.kind ?? "directional", intensity: object.light?.intensity ?? 1.2, color: e.target.value },
                })
              }
            />
          </label>
        </div>
      )}
      {object.material && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">Material</div>
          <label className="text-[12px] flex items-center gap-2">
            Base
            <input type="color" value={mat.color} onChange={(e) => onChange({ material: { ...mat, color: e.target.value } })} />
          </label>
          <Num label="M" value={mat.metalness} step={0.05} onChange={(metalness) => onChange({ material: { ...mat, metalness } })} />
          <Num label="R" value={mat.roughness} step={0.05} onChange={(roughness) => onChange({ material: { ...mat, roughness } })} />
          <label className="text-[12px] flex items-center gap-2">
            Emit
            <input
              type="color"
              value={mat.emissive}
              onChange={(e) => onChange({ material: { ...mat, emissive: e.target.value } })}
            />
          </label>
          <Num
            label="E"
            value={mat.emissiveIntensity}
            step={0.05}
            onChange={(emissiveIntensity) => onChange({ material: { ...mat, emissiveIntensity } })}
          />
          <label className="text-[12px] flex items-center gap-2">
            <input
              type="checkbox"
              checked={mat.wireframe}
              onChange={(e) => onChange({ material: { ...mat, wireframe: e.target.checked } })}
            />
            Wireframe
          </label>
        </div>
      )}
    </div>
  );
}
