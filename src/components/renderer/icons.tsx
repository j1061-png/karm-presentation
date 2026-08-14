import {
  Sun, Zap, Users, TrendingUp, Globe, Building2, Leaf, BatteryCharging,
  DollarSign, Target, Award, Calendar, BarChart3, Lightbulb, Rocket,
  Shield, Clock, MapPin, Factory, Droplets,
  type LucideIcon,
} from "lucide-react";

/** Whitelisted icon set the AI can reference by name. */
export const ICON_MAP: Record<string, LucideIcon> = {
  sun: Sun,
  zap: Zap,
  users: Users,
  "trending-up": TrendingUp,
  globe: Globe,
  building: Building2,
  leaf: Leaf,
  battery: BatteryCharging,
  "dollar-sign": DollarSign,
  target: Target,
  award: Award,
  calendar: Calendar,
  chart: BarChart3,
  lightbulb: Lightbulb,
  rocket: Rocket,
  shield: Shield,
  clock: Clock,
  "map-pin": MapPin,
  factory: Factory,
  droplets: Droplets,
};

export function getIcon(name?: string): LucideIcon {
  return (name && ICON_MAP[name]) || Sun;
}
