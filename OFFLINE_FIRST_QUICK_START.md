# Quick Start: Offline-First FireReport

## What Changed?

Your FireReport app is now **completely offline-first** with automatic cloud sync:

- ✅ **Works offline:** Create reports, take photos, save everything locally without internet
- ✅ **Auto-syncs:** When internet (WiFi or mobile data) is detected, all saved reports upload automatically
- ✅ **Image limits:** Max 1500 images per report to prevent storage overflow
- ✅ **Zero data loss:** All offline reports persist; sync retries automatically

## How It Works (Simple Version)

1. **User saves report** → Optimized & stored locally
2. **Device has no internet** → Report sits in offline queue
3. **Internet available** → App auto-detects and syncs everything
4. **Done** → Report now in Supabase, offline queue cleared

## For Developers

### Key Files Modified:
- `utils/backup.js` - Added image limit enforcement, queue management
- `utils/networkSync.js` - NEW: Network listener & auto-sync logic
- `app/_layout.js` - Starts network listener on app load
- `app/ReportesBombas.js` - Updated save flow
- `app/reporte_alarma.js` - Updated save flow  
- `app/reportehidrantes.js` - Updated save flow (JUST COMPLETED)

### Test Offline Mode:
```bash
# 1. Build APK for Android
eas build --platform android --profile preview

# 2. On device/emulator:
# - Turn OFF WiFi + Mobile Data
# - Create a report with photos
# - Save it
# - Alert says "Se sincronizará con nube cuando tengas internet"
# - Open historial, report is there!

# 3. Turn ON WiFi/Mobile Data
# - Watch console for [NetworkListener] logs
# - Reports auto-upload to Supabase
# - Done!
```

### Check Pending Backups:
```javascript
// In browser console (Hermes debugger):
import AsyncStorage from '@react-native-async-storage/async-storage';
const pending = await AsyncStorage.getItem('pending_backups');
console.log('Pending backups:', JSON.parse(pending || '[]'));

const stored = await AsyncStorage.getItem('mis_reportes');
console.log('Stored reports:', JSON.parse(stored || '[]'));
```

### Monitor Sync:
Watch console for:
```
[NetworkListener] Starting backup queue sync...
[NetworkListener] ✅ Successfully synced 3 report(s) to Supabase
```

## For Field Technicians

### What's Different?
- **Before:** Had to upload immediately (required internet)
- **Now:** Save offline, auto-uploads when internet available

### Workflow:
1. **No Internet?** Don't worry, just save. It will sync later.
2. **Internet Available?** App auto-syncs. You'll see logs in console.
3. **Check Supabase?** Reports appear automatically after sync.

### Image Tips:
- Max 1500 images per report
- App warns you if you exceed this
- Focus on quality over quantity

## Architecture Overview

```
Offline Queue (AsyncStorage)
    ↓
Save Report → Optimize → Store Locally
    ↓
Detect Internet (NetInfo)
    ↓
Auto-Sync to Supabase
    ↓
Done!
```

## Troubleshooting

### Reports not syncing?
1. Check internet: Device should have WiFi or mobile data
2. Check logs: Look for `[NetworkListener]` in console
3. Check queue: Run `AsyncStorage.getItem('pending_backups')`
4. Restart app: Sometimes NetInfo needs refresh

### Reports too large?
1. Use fewer images (max 1500 per report)
2. Use smaller image sizes if possible
3. Delete old reports from historial to free space

### App crashes on save?
1. Check image count: Likely exceeds device storage
2. Delete old reports to free memory
3. Take fewer photos per report

## Next Steps

1. **Build APK:** `eas build --platform android --profile preview`
2. **Test Offline:** Turn off internet, create reports
3. **Test Sync:** Turn on internet, watch auto-sync happen
4. **Deploy:** Ready for production!

---

**Questions?** Check `OFFLINE_FIRST_IMPLEMENTATION.md` for detailed technical docs.
