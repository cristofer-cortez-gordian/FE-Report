import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { syncPendingBackups } from './backup';

const TASK_NAME = 'sync-pending-backups';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const result = await syncPendingBackups();
    if (result?.synced > 0) return BackgroundFetch.BackgroundFetchResult.NewData;
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[BackgroundSync] Task failed', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status !== BackgroundFetch.BackgroundFetchStatus.Available) {
      console.log('[BackgroundSync] Background fetch not available:', status);
      return { registered: false, status };
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(TASK_NAME, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true
      });
      console.log('[BackgroundSync] Task registered');
    } else {
      console.log('[BackgroundSync] Task already registered');
    }

    return { registered: true, status };
  } catch (error) {
    console.error('[BackgroundSync] Register failed', error);
    return { registered: false, status: null, error };
  }
}

export async function unregisterBackgroundSync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
      console.log('[BackgroundSync] Task unregistered');
    }
  } catch (error) {
    console.error('[BackgroundSync] Unregister failed', error);
  }
}
