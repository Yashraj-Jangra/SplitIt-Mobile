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

          this.cachedSettings = {
            appName: data.appName || 'SplitIt',
            logoUrl: data.logoUrl,
            faviconUrl: data.faviconUrl,
            coverImages: data.coverImages || [],
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
        };
      }
      return this.cachedSettings;
    })();

    return this.fetchPromise;
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
