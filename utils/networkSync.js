import NetInfo from '@react-native-community/netinfo';
import { syncPendingBackups } from './backup';

let unsubscribe = null;
let isSyncing = false;

/**
 * Start listening for network connectivity changes
 * When internet is detected, automatically sync pending backups to Supabase
 * @returns {function} Unsubscribe function to stop listening
 */
export function startNetworkListener() {
  if (unsubscribe) {
    console.log('Network listener already active');
    return unsubscribe;
  }

  unsubscribe = NetInfo.addEventListener(state => {
    console.log('[NetworkListener] State changed:', {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type
    });

    // Check if we have internet connection
    const hasInternet = state.isConnected && state.isInternetReachable !== false;
    if (hasInternet && !isSyncing) {
      syncBackupQueue();
    }
  });

  // Also check current state immediately
  NetInfo.fetch().then(state => {
    const hasInternet = state.isConnected && state.isInternetReachable !== false;
    if (hasInternet && !isSyncing) {
      console.log('[NetworkListener] App started with internet, checking for pending backups...');
      syncBackupQueue();
    }
  });

  console.log('[NetworkListener] Network listener started');
  return unsubscribe;
}

/**
 * Stop listening for network changes
 */
export function stopNetworkListener() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
    console.log('[NetworkListener] Network listener stopped');
  }
}

/**
 * Manually trigger backup queue processing
 * Called automatically when internet is detected
 */
async function syncBackupQueue() {
  if (isSyncing) {
    console.log('[NetworkListener] Sync already in progress, skipping...');
    return;
  }

  isSyncing = true;
  console.log('[NetworkListener] Starting backup queue sync...');

  try {
    const result = await syncPendingBackups();
    if (result.synced > 0) {
      console.log(
        `[NetworkListener] ✅ Successfully synced ${result.synced} report(s) to Supabase (${result.remaining} still pending)`
      );
    } else {
      console.log('[NetworkListener] No pending backups to sync');
    }
  } catch (error) {
    console.error('[NetworkListener] Error during sync:', error);
  } finally {
    isSyncing = false;
  }
}

/**
 * Get current network state synchronously (for UI checks)
 * @returns {Promise<Object>} Network state object
 */
export async function checkNetworkState() {
  try {
    const state = await NetInfo.fetch();
    return {
      isOnline: state.isConnected && state.isInternetReachable !== false,
      type: state.type,
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable
    };
  } catch (error) {
    console.error('checkNetworkState error:', error);
    return { isOnline: false, type: 'unknown' };
  }
}

/**
 * Check if app has internet (for conditional UI/behavior)
 * @returns {Promise<boolean>} true if connected to internet
 */
export async function isOnline() {
  const state = await checkNetworkState();
  return state.isOnline;
}
