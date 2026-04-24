import Dexie from 'dexie'

export const db = new Dexie('roamcast')

// v1: ++id (auto-increment int) on moments caused ConstraintError when providing UUID strings
db.version(1).stores({
  gpsPoints: '++id, dayId, timestamp',
  moments: '++id, dayId, type, capturedAt, uploaded',
  mediaBlobs: '++id, momentId',
  uploadQueue: '++id, dayId, type, status, createdAt',
})

// v2: moments.id is now a plain primary key — we always supply a UUID string
db.version(2).stores({
  gpsPoints: '++id, dayId, timestamp',
  moments: 'id, dayId, type, capturedAt, uploaded',
  mediaBlobs: '++id, momentId',
  uploadQueue: '++id, dayId, type, status, createdAt',
})
