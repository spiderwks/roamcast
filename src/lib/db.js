import Dexie from 'dexie'

export const db = new Dexie('roamcast')

db.version(1).stores({
  gpsPoints: '++id, dayId, timestamp',
  moments: '++id, dayId, type, capturedAt, uploaded',
  mediaBlobs: '++id, momentId',
  uploadQueue: '++id, dayId, type, status, createdAt',
})
