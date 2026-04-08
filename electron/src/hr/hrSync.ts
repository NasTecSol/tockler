import { TrackItem } from '../drizzle/schema';
import { TrackItemType } from '../enums/track-item-type';
import { MinuteBucketPayloadRow, HRSyncTrackItems } from './types';

const MINUTE_MS = 60 * 1000;

interface BestMatch {
    duration: number;
    item: TrackItem | null;
}

function overlapDuration(startA: number, endA: number, startB: number, endB: number) {
    return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function pickBetterMatch(current: BestMatch, item: TrackItem, duration: number): BestMatch {
    if (!current.item || duration > current.duration) {
        return { item, duration };
    }

    return current;
}

function emptyMatch(): BestMatch {
    return { item: null, duration: 0 };
}

function uniqueItems(items: TrackItem[]) {
    const seen = new Set<string>();

    return items.filter((item) => {
        const key = [
            item.taskName,
            item.app,
            item.title || '',
            item.beginDate,
            item.endDate,
            item.url || '',
            item.color || '',
        ].join('|');

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

export function buildMinuteBuckets({ appItems, statusItems, logItems }: HRSyncTrackItems, from: number, to: number) {
    if (to <= from) {
        return [] as MinuteBucketPayloadRow[];
    }

    const allItems = uniqueItems([...appItems, ...statusItems, ...logItems]);
    const alignedStart = Math.floor(from / MINUTE_MS) * MINUTE_MS;
    const buckets: MinuteBucketPayloadRow[] = [];

    for (let bucketStart = alignedStart; bucketStart < to; bucketStart += MINUTE_MS) {
        const bucketEnd = Math.min(bucketStart + MINUTE_MS, to);
        const clippedStart = Math.max(bucketStart, from);
        const clippedEnd = Math.min(bucketEnd, to);

        let bestApp = emptyMatch();
        let bestStatus = emptyMatch();
        let bestLog = emptyMatch();

        for (const item of allItems) {
            const duration = overlapDuration(item.beginDate, item.endDate, clippedStart, clippedEnd);
            if (duration <= 0) {
                continue;
            }

            if (item.taskName === TrackItemType.AppTrackItem) {
                bestApp = pickBetterMatch(bestApp, item, duration);
            } else if (item.taskName === TrackItemType.StatusTrackItem) {
                bestStatus = pickBetterMatch(bestStatus, item, duration);
            } else if (item.taskName === TrackItemType.LogTrackItem) {
                bestLog = pickBetterMatch(bestLog, item, duration);
            }
        }

        if (!bestApp.item && !bestStatus.item && !bestLog.item) {
            continue;
        }

        buckets.push({
            minuteStart: clippedStart,
            minuteEnd: clippedEnd,
            trackedDurationMs: clippedEnd - clippedStart,
            status: (bestStatus.item?.app as MinuteBucketPayloadRow['status']) || null,
            statusDurationMs: bestStatus.duration,
            appName: bestApp.item?.app || null,
            appTitle: bestApp.item?.title || null,
            appDurationMs: bestApp.duration,
            logAppName: bestLog.item?.app || null,
            logTitle: bestLog.item?.title || null,
            logDurationMs: bestLog.duration,
        });
    }

    return buckets;
}
