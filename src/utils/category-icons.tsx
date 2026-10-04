import React from 'react';
import {
  Utensils,
  ShoppingBag,
  Car,
  Bus,
  Plane,
  Home,
  Zap,
  Droplets,
  Wifi,
  Smartphone,
  Film,
  Gamepad2,
  Music,
  Tv,
  Ticket,
  Shirt,
  Laptop,
  HeartPulse,
  Heart,
  GraduationCap,
  Gift,
  Hotel,
  Wallet,
  Settings,
} from 'lucide-react-native';
import { settingsService } from '../services/settings.service';

/**
 * Maps standard icon strings stored in category definitions (matching website)
 * to their corresponding Lucide icons in React Native.
 */
export const CATEGORY_ICON_REGISTRY: Record<
  string,
  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  Food: Utensils,
  ShoppingBag: ShoppingBag,
  Car: Car,
  Bus: Bus,
  Plane: Plane,
  Home: Home,
  Electricity: Zap,
  Water: Droplets,
  Wifi: Wifi,
  Phone: Smartphone,
  Movie: Film,
  Games: Gamepad2,
  Music: Music,
  TV: Tv,
  Ticket: Ticket,
  Clothing: Shirt,
  Electronics: Laptop,
  HeartPulse: HeartPulse,
  Health: Heart,
  Education: GraduationCap,
  Gift: Gift,
  Hotel: Hotel,
  Wallet: Wallet,
  Settings: Settings,
};

/**
 * Standard master category icons matching the website.
 */
export const MASTER_CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  'Food and Drink': Utensils,
  'Transportation': Car,
  'Housing': Home,
  'Utilities': Zap,
  'Entertainment': Film,
  'Shopping': ShoppingBag,
  'Health and Wellness': HeartPulse,
  'Personal Care': Heart,
  'Education': GraduationCap,
  'Gifts and Donations': Gift,
  'Travel': Plane,
  'Uncategorized': Wallet,
  'Other': Wallet,
};

/**
 * Canonical master category colors for badges, rings, and charts.
 * Exact parity with the website theme.
 */
export const MASTER_CATEGORY_COLORS: Record<string, string> = {
  'Food and Drink': '#3B82F6',
  'Transportation': '#8B5CF6',
  'Housing': '#10B981',
  'Utilities': '#F59E0B',
  'Entertainment': '#EC4899',
  'Shopping': '#06B6D4',
  'Health and Wellness': '#EF4444',
  'Personal Care': '#A855F7',
  'Education': '#6366F1',
  'Gifts and Donations': '#EAB308',
  'Travel': '#14B8A6',
  'Uncategorized': '#64748B',
  'Other': '#64748B',
};

/**
 * Resolves the appropriate React Native icon component for a category.
 */
export function getCategoryIconComponent(
  subCategory?: string,
  masterCategory?: string
): React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> {
  if (subCategory) {
    const details = settingsService.getCategoryDetails(subCategory);
    if (details.icon && CATEGORY_ICON_REGISTRY[details.icon]) {
      return CATEGORY_ICON_REGISTRY[details.icon];
    }
  }

  const resolvedMaster =
    masterCategory || (subCategory ? settingsService.getMasterCategory(subCategory) : 'Uncategorized');

  if (MASTER_CATEGORY_ICONS[resolvedMaster]) {
    return MASTER_CATEGORY_ICONS[resolvedMaster];
  }

  return Wallet;
}

/**
 * Resolves the theme color for a given category.
 */
export function getCategoryColor(masterCategory?: string, subCategory?: string): string {
  const master =
    masterCategory || (subCategory ? settingsService.getMasterCategory(subCategory) : 'Uncategorized');
  return MASTER_CATEGORY_COLORS[master] || '#64748B';
}

export interface CategoryIconProps {
  subCategory?: string;
  masterCategory?: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  subCategory,
  masterCategory,
  size = 18,
  color = '#FFFFFF',
  strokeWidth = 2,
}) => {
  const IconComponent = getCategoryIconComponent(subCategory, masterCategory);
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
};
