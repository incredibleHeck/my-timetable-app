import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Web Compatibility', () => {
  beforeEach(() => {
    // Ensure Tauri globals are NOT present
    vi.stubGlobal('__TAURI__', undefined);
    vi.stubGlobal('__TAURI_INTERNALS__', undefined);
    
    // Reset modules to ensure we test the import behavior
    vi.resetModules();
  });

  it('should import FileService without crashing in a web environment', async () => {
    // We use dynamic import here to trigger the module evaluation inside the test
    const { FileService } = await import('../src/services/fileSystem');
    
    expect(FileService).toBeDefined();
    expect(FileService.isTauri).toBe(false);
  });

  it('should use webDownload when saving project in web mode', async () => {
    const { FileService } = await import('../src/services/fileSystem');
    
    // Spy on webDownload
    const webDownloadSpy = vi.spyOn(FileService, 'webDownload').mockResolvedValue({ success: true });
    
    const mockData = { version: 1, profiles: [] } as any;
    const result = await FileService.saveProject(mockData, 'test');
    
    expect(result.success).toBe(true);
    expect(webDownloadSpy).toHaveBeenCalled();
  });

  it('should use webDownload when saving export in web mode', async () => {
    const { FileService } = await import('../src/services/fileSystem');
    
    const webDownloadSpy = vi.spyOn(FileService, 'webDownload').mockResolvedValue({ success: true });
    
    const mockBlob = new Blob(['test content'], { type: 'text/plain' });
    const result = await FileService.saveExport(mockBlob, 'test', 'txt');
    
    expect(result.success).toBe(true);
    expect(webDownloadSpy).toHaveBeenCalledWith(mockBlob, 'test', 'text/plain');
  });

  it('should detect platform correctly via isTauriEnv', async () => {
    const { isTauriEnv } = await import('../src/utils/platform');
    
    // Test Web Mode
    vi.stubGlobal('__TAURI__', undefined);
    expect(isTauriEnv()).toBe(false);
    
    // Test Tauri Mode
    vi.stubGlobal('__TAURI__', {});
    expect(isTauriEnv()).toBe(true);
  });

  it('should initialize and use localStorage for profiles in web mode', async () => {
    const ProfileStorage = await import('../src/services/profile/profileStorage');
    
    // Clear localStorage
    localStorage.clear();
    
    // Init
    await ProfileStorage.init();
    expect(localStorage.getItem('profile_manifest')).toBeDefined();
    
    // Save
    const mockProfile = { id: 'test-id', name: 'Test Profile', data: {}, created: Date.now(), lastModified: Date.now(), meta: {} } as any;
    await ProfileStorage.saveProfile(mockProfile);
    
    expect(localStorage.getItem('profile_data_test-id')).toBeDefined();
    
    // List
    const profiles = await ProfileStorage.listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Test Profile');
    
    // Load
    const loaded = await ProfileStorage.loadProfile('test-id');
    expect(loaded?.name).toBe('Test Profile');
  });
});
