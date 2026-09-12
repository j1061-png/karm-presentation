"use client";

import { Box, Bot, Camera, Circle, Columns2, Cylinder, Droplets, Eye, EyeOff, Lamp, Lock, Unlock, Minus, Sun } from "lucide-react";
import type { ModelObject, ModelObjectType } from "@/lib/schema";

const ICONS: Partial<Record<ModelObjectType, typeof Box>> = {
  cube: Box,
  sphere: Circle,
  cylinder: Cylinder,
  light: Lamp,
  camera: Camera,
  solarPanel: Sun,
  mount: Columns2,
  rail: Minus,
  cleaner: Bot,
  brush: Cylinder,
  nozzle: Droplets,
  tank: Box,
};

export function ModelOutliner({
  objects,
  selectedId,
  onSelect,
  onToggle,
}: {
  objects: ModelObject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, patch: Partial<ModelObject>) => void;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-1">
      {objects.map((obj) => {
        const Icon = ICONS[obj.type] ?? Minus;
        const active = obj.id === selectedId;
        return (
          <div
            key={obj.id}
            className={`flex items-center gap-1 px-2 py-1 mx-1 rounded-md cursor-pointer ${
              active ? "bg-surface-2 text-text" : "text-text-secondary hover:bg-surface-2/70"
            }`}
            onClick={() => onSelect(obj.id)}
          >
            <Icon size={12} className="flex-shrink-0" />
            <span className="flex-1 min-w-0 truncate text-[12.5px]">{obj.name}</span>
            <button
              type="button"
              className="p-0.5 text-text-tertiary hover:text-text"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(obj.id, { visible: !obj.visible });
              }}
              title={obj.visible ? "Hide" : "Show"}
            >
              {obj.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <button
              type="button"
              className="p-0.5 text-text-tertiary hover:text-text"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(obj.id, { locked: !obj.locked });
              }}
              title={obj.locked ? "Unlock" : "Lock"}
            >
              {obj.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
