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
import { THEME } from '../constants/theme';

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
  'Food and Drink': THEME.colors.categories.food,
  'Transportation': THEME.colors.categories.transportation,
  'Housing': THEME.colors.categories.housing,
  'Utilities': THEME.colors.categories.utilities,
  'Entertainment': THEME.colors.categories.entertainment,
  'Shopping': THEME.colors.categories.shopping,
  'Health and Wellness': THEME.colors.categories.health,
  'Personal Care': THEME.colors.categories.personal,
  'Education': THEME.colors.categories.education,
  'Gifts and Donations': THEME.colors.categories.gifts,
  'Travel': THEME.colors.categories.travel,
  'Uncategorized': THEME.colors.categories.uncategorized,
  'Other': THEME.colors.categories.other,
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
  return MASTER_CATEGORY_COLORS[master] || THEME.colors.categories.other;
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
  color = THEME.colors.text,
  strokeWidth = 2,
}) => {
  const IconComponent = getCategoryIconComponent(subCategory, masterCategory);
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
};
