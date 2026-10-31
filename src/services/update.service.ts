import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string | null;
  browserUrl: string;
  apkSize: number;
  isPrerelease: boolean;
}

export interface DownloadProgress {
  percentage: number; // 0 to 1
  totalBytes: number;
  writtenBytes: number;
}

interface CachedUpdateEnvelope {
  timestamp: number;
  data: UpdateInfo;
}

const GITHUB_RELEASE_API = 'https://api.github.com/repos/Yashraj-Jangra/SplitIt-Mobile/releases/latest';
const UPDATE_CACHE_KEY = 'splitit_cached_update_check';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const POST_INSTALL_CLEANUP_DELAY_MS = 60 * 1000; // 60 seconds backup sweep

/**
 * Parses semver string into [major, minor, patch] numeric tuple.
 */
export function parseSemVer(v: string): number[] {
  const clean = v.replace(/^v/i, '').split('-')[0].trim();
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

/**
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = parseSemVer(v1);
  const p2 = parseSemVer(v2);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

class UpdateService {
  private currentDownload: FileSystem.DownloadResumable | null = null;
  private cleanupTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Helper to get safe cache directory for update APKs.
   */
  private getUpdateDir(): string | null {
    if (!FileSystem.cacheDirectory) return null;
    return `${FileSystem.cacheDirectory}updates/`;
  }

  /**
   * Zero-Residue Cleanup:
   * Deletes the entire updates directory from temporary app cache.
   * Completely idempotent and safe against non-existent directories.
   */
  public async purgeUpdateCache(): Promise<void> {
    try {
      if (this.cleanupTimeoutId) {
        clearTimeout(this.cleanupTimeoutId);
        this.cleanupTimeoutId = null;
      }
      const updateDir = this.getUpdateDir();
      if (!updateDir) return;

      const dirInfo = await FileSystem.getInfoAsync(updateDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(updateDir, { idempotent: true });
      }
    } catch {
      // Defensive: zero throw on cleanup
    }
  }

  /**
   * Checks GitHub Releases for new APK versions.
   * Caches response in AsyncStorage for 4 hours unless force === true.
   */
  public async checkForUpdate(force = false): Promise<UpdateInfo> {
    const currentVersion = Constants.expoConfig?.version || '1.2.1';

    // 1. Check cached release info if not forced
    if (!force) {
      try {
        const raw = await AsyncStorage.getItem(UPDATE_CACHE_KEY);
        if (raw) {
          const envelope: CachedUpdateEnvelope = JSON.parse(raw);
          if (Date.now() - envelope.timestamp < CACHE_TTL_MS) {
            return envelope.data;
          }
        }
      } catch {
        // Cache read failure, proceed to live fetch
      }
    }

    // 2. Fetch latest release from GitHub
    const res = await fetch(GITHUB_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'SplitIt-Mobile',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to check updates (GitHub HTTP ${res.status})`);
    }

    const release = await res.json();
    const rawTag = release.tag_name || '';
    const latestVersion = rawTag.replace(/^v/i, '');
    const isNewer = compareVersions(latestVersion, currentVersion) > 0;

    const apkAsset = release.assets?.find(
      (asset: { name: string; browser_download_url: string; size: number }) =>
        asset.name?.toLowerCase().endsWith('.apk')
    );

    const updateInfo: UpdateInfo = {
      available: isNewer,
      currentVersion,
      latestVersion,
      releaseName: release.name || `SplitIt v${latestVersion}`,
      releaseNotes: release.body || '',
      publishedAt: release.published_at || new Date().toISOString(),
      downloadUrl: apkAsset?.browser_download_url || null,
      browserUrl: release.html_url || 'https://github.com/Yashraj-Jangra/SplitIt-Mobile/releases',
      apkSize: apkAsset?.size || 0,
      isPrerelease: Boolean(release.prerelease),
    };

    // 3. Persist to cache
    try {
      const envelope: CachedUpdateEnvelope = {
        timestamp: Date.now(),
        data: updateInfo,
      };
      await AsyncStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify(envelope));
    } catch {
      // Non-fatal cache write failure
    }

    return updateInfo;
  }

  /**
   * Downloads the APK to a sandboxed cache folder with progress reporting,
   * invokes the native Android Package Installer, and guarantees zero residue.
   */
  public async downloadAndInstallUpdate(
    apkUrl: string,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('In-app direct updates are currently supported on Android only.');
    }

    const updateDir = this.getUpdateDir();
    if (!updateDir) {
      throw new Error('Unable to access device cache directory.');
    }

    // Tier 1: Pre-download purge ensures clean slate & free storage
    await this.purgeUpdateCache();

    // Ensure update directory exists
    await FileSystem.makeDirectoryAsync(updateDir, { intermediates: true });

    const localApkUri = `${updateDir}SplitIt-update.apk`;

    try {
      // Create resumable download with progress tracking
      this.currentDownload = FileSystem.createDownloadResumable(
        apkUrl,
        localApkUri,
        {},
        (downloadProgress) => {
          const total = downloadProgress.totalBytesExpectedToWrite;
          const written = downloadProgress.totalBytesWritten;
          const percentage = total > 0 ? Math.min(Math.max(written / total, 0), 1) : 0;
          onProgress({
            percentage,
            totalBytes: total,
            writtenBytes: written,
          });
        }
      );

      const downloadResult = await this.currentDownload.downloadAsync();
      this.currentDownload = null;

      if (!downloadResult || !downloadResult.uri) {
        throw new Error('Download terminated unexpectedly.');
      }

      // Verify downloaded file integrity & non-zero size
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      if (!fileInfo.exists || ('size' in fileInfo && fileInfo.size === 0)) {
        throw new Error('Downloaded APK file is empty or corrupted.');
      }

      // Generate content:// URI via FileProvider for package installer
      const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);

      // Tier 3 Backup: Schedule background purge after delay (e.g. 60s)
      this.cleanupTimeoutId = setTimeout(() => {
        this.purgeUpdateCache();
      }, POST_INSTALL_CLEANUP_DELAY_MS);

      // Launch native Android Package Installer
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
      });

      // User returned from installer dialog (either installed or cancelled):
      // Purge APK immediately
      await this.purgeUpdateCache();
    } catch (err) {
      // Tier 2: Purge immediately on failure or cancellation
      this.currentDownload = null;
      await this.purgeUpdateCache();
      throw err;
    }
  }

  /**
   * Aborts an active download and cleans up any partial storage chunks.
   */
  public async cancelDownload(): Promise<void> {
    try {
      if (this.currentDownload) {
        await this.currentDownload.pauseAsync();
        this.currentDownload = null;
      }
    } catch {
      // Ignore pause failure during abort
    } finally {
      await this.purgeUpdateCache();
    }
  }
}

export const updateService = new UpdateService();

