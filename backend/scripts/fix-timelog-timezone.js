/**
 * fix-timelog-timezone.js
 *
 * Problem: startAt / endAt in the timelogs collection were stored with IST wall-clock
 * values but stamped with a UTC offset (+00:00).  Every timestamp is therefore 5h 30m
 * too late compared to real UTC.
 *
 * Fix: subtract 330 minutes (5.5 h = IST offset) from startAt, endAt, and
 * lastHeartbeatAt on every TimeLog document.
 *
 * Usage:
 *   node scripts/fix-timelog-timezone.js            # dry run (safe, no writes)
 *   node scripts/fix-timelog-timezone.js --execute  # applies the fix
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const DRY_RUN = !process.argv.includes('--execute');
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 330 minutes in ms

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.rhjsiol.mongodb.net/renmito?retryWrites=true&w=majority&appName=Cluster0`;

function shiftBack(date) {
  if (!date) return null;
  return new Date(date.getTime() - IST_OFFSET_MS);
}

async function run() {
  console.log(`\n=== fix-timelog-timezone  [${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}] ===\n`);

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.\n');

  const collection = mongoose.connection.collection('timelogs');
  const total = await collection.countDocuments({});
  console.log(`Total TimeLogs in collection: ${total}`);

  // Preview a sample of 3 documents
  const sample = await collection.find({}).limit(3).toArray();
  console.log('\n--- Sample (before) ---');
  for (const doc of sample) {
    console.log(`  _id: ${doc._id}`);
    console.log(`    startAt:         ${doc.startAt?.toISOString() ?? 'null'}`);
    console.log(`    endAt:           ${doc.endAt?.toISOString() ?? 'null'}`);
    console.log(`    lastHeartbeatAt: ${doc.lastHeartbeatAt?.toISOString() ?? 'null'}`);
    console.log(`  → startAt (fixed): ${doc.startAt ? shiftBack(doc.startAt).toISOString() : 'null'}`);
    console.log(`  → endAt   (fixed): ${doc.endAt   ? shiftBack(doc.endAt).toISOString()   : 'null'}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run complete. No documents were modified.');
    console.log('Re-run with --execute to apply the fix.\n');
    await mongoose.disconnect();
    return;
  }

  // ── Execute ──────────────────────────────────────────────────────────────────
  console.log('\nApplying fix to all documents...');

  const cursor = collection.find({});
  let processed = 0;
  let updated = 0;
  const errors = [];

  for await (const doc of cursor) {
    processed++;

    const update = {};

    if (doc.startAt) {
      update.startAt = shiftBack(doc.startAt);
    }
    if (doc.endAt) {
      update.endAt = shiftBack(doc.endAt);
    }
    if (doc.lastHeartbeatAt) {
      update.lastHeartbeatAt = shiftBack(doc.lastHeartbeatAt);
    }

    if (Object.keys(update).length === 0) continue;

    try {
      await collection.updateOne({ _id: doc._id }, { $set: update });
      updated++;
    } catch (err) {
      errors.push({ id: doc._id, err: err.message });
    }

    if (processed % 100 === 0) {
      console.log(`  Processed ${processed}/${total}…`);
    }
  }

  console.log(`\nDone. ${updated} / ${total} documents updated.`);
  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    errors.forEach(e => console.error(`  ${e.id}: ${e.err}`));
  }

  // Verify sample after fix
  const sampleAfter = await collection.find({}).limit(3).toArray();
  console.log('\n--- Sample (after) ---');
  for (const doc of sampleAfter) {
    console.log(`  _id: ${doc._id}`);
    console.log(`    startAt:         ${doc.startAt?.toISOString() ?? 'null'}`);
    console.log(`    endAt:           ${doc.endAt?.toISOString() ?? 'null'}`);
    console.log(`    lastHeartbeatAt: ${doc.lastHeartbeatAt?.toISOString() ?? 'null'}`);
  }

  await mongoose.disconnect();
  console.log('\nDisconnected. Migration complete.\n');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
