import { API_BASE_URL } from './auth.service';
import {
  defaultExpenseCategories,
  MasterCategory,
  SubCategory,
  classifyExpense as coreClassifyExpense,
  getMasterCategory as coreGetMasterCategory,
  getCategoryDetails as coreGetCategoryDetails,
} from '@splitit/core';

export interface PublicSettings {
  appName: string;
  logoUrl?: string;
  faviconUrl?: string;
  coverImages?: string[];
  landingImages?: string[];
  defaultThemeId?: string;
  userSelectableThemeIds?: string[];
  customThemes?: any[];
  expenseCategories: Record<string, MasterCategory>;
  countryCodes?: any[];
  minMobileVersion?: string;
  latestMobileVersion?: string;
}

export const FALLBACK_GROUP_COVER_IMAGES = [
  'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=2029&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1604079628040-94301bb21b91?q=80&w=1974&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1579546929662-7112e7508432?q=80&w=2070&auto=format&fit=crop',
];

const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class SettingsService {
  private cachedSettings: PublicSettings | null = null;
  private lastFetchedTime: number = 0;
  private fetchPromise: Promise<PublicSettings> | null = null;

  /**
   * Fetches public site settings from the backend (/api/public/settings).
   * Matches the website's settings fetching and caches in memory.
   */
  async getSettings(forceRefresh = false): Promise<PublicSettings> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.cachedSettings &&
      now - this.lastFetchedTime < SETTINGS_CACHE_TTL_MS
    ) {
      return this.cachedSettings;
    }

    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/public/settings`, {
          headers: {
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const expenseCategories =
            data?.expenseCategories && Object.keys(data.expenseCategories).length > 0
              ? data.expenseCategories
              : defaultExpenseCategories;

          const coverImages =
            Array.isArray(data?.coverImages) && data.coverImages.length > 0
              ? data.coverImages
              : FALLBACK_GROUP_COVER_IMAGES;

          this.cachedSettings = {
            appName: data.appName || 'SplitIt',
            logoUrl: data.logoUrl,
            faviconUrl: data.faviconUrl,
            coverImages,
            landingImages: data.landingImages || [],
            defaultThemeId: data.defaultThemeId,
            userSelectableThemeIds: data.userSelectableThemeIds,
            expenseCategories,
            countryCodes: data.countryCodes || [],
            minMobileVersion: data.minMobileVersion || '1.0.0',
            latestMobileVersion: data.latestMobileVersion || '1.0.0',
          };
          this.lastFetchedTime = Date.now();
          return this.cachedSettings;
        }
      } catch {
        // Fallback gracefully on network error or offline mode
      } finally {
        this.fetchPromise = null;
      }

      if (!this.cachedSettings) {
        this.cachedSettings = {
          appName: 'SplitIt',
          expenseCategories: defaultExpenseCategories,
          coverImages: FALLBACK_GROUP_COVER_IMAGES,
        };
      }
      return this.cachedSettings;
    })();

    return this.fetchPromise;
  }

  /**
   * Returns available group cover images configured by admin in website settings,
   * falling back to default cover images if empty or offline.
   */
  async getGroupCoverImages(forceRefresh = false): Promise<string[]> {
    const settings = await this.getSettings(forceRefresh);
    return settings.coverImages && settings.coverImages.length > 0
      ? settings.coverImages
      : FALLBACK_GROUP_COVER_IMAGES;
  }

  /**
   * Synchronous accessor for immediate rendering of group cover images.
   */
  getCachedGroupCoverImages(): string[] {
    return this.cachedSettings?.coverImages && this.cachedSettings.coverImages.length > 0
      ? this.cachedSettings.coverImages
      : FALLBACK_GROUP_COVER_IMAGES;
  }

  /**
   * Returns current expense categories. Asynchronously fetches newest from backend,
   * falling back safely to defaultExpenseCategories.
   */
  async getExpenseCategories(forceRefresh = false): Promise<Record<string, MasterCategory>> {
    const settings = await this.getSettings(forceRefresh);
    return settings.expenseCategories || defaultExpenseCategories;
  }

  /**
   * Synchronous accessor for immediate rendering.
   */
  getCachedExpenseCategories(): Record<string, MasterCategory> {
    return this.cachedSettings?.expenseCategories || defaultExpenseCategories;
  }

  /**
   * Classifies an expense description into master and sub categories
   * using the active categories structure.
   */
  classifyExpense(
    description: string,
    categories?: Record<string, MasterCategory>
  ): { master: string; sub: string } {
    return coreClassifyExpense(
      description,
      categories || this.getCachedExpenseCategories()
    );
  }

  /**
   * Looks up the master category for a given sub-category name.
   */
  getMasterCategory(
    subCategoryName: string,
    categories?: Record<string, MasterCategory>
  ): string {
    return coreGetMasterCategory(
      subCategoryName,
      categories || this.getCachedExpenseCategories()
    );
  }

  /**
   * Returns full category details (master, sub, icon).
   */
  getCategoryDetails(
    subCategoryName: string,
    categories?: Record<string, MasterCategory>
  ): { master: string; sub: string; icon: string } {
    return coreGetCategoryDetails(
      subCategoryName,
      categories || this.getCachedExpenseCategories()
    );
  }

  /**
   * Returns list of all master category names.
   */
  getMasterCategories(categories?: Record<string, MasterCategory>): string[] {
    const cats = categories || this.getCachedExpenseCategories();
    return Object.keys(cats);
  }

  /**
   * Returns sub-categories dictionary for a master category.
   */
  getSubCategories(
    masterCategoryName: string,
    categories?: Record<string, MasterCategory>
  ): Record<string, SubCategory> {
    const cats = categories || this.getCachedExpenseCategories();
    return cats[masterCategoryName]?.subCategories || {};
  }
}

export const settingsService = new SettingsService();
