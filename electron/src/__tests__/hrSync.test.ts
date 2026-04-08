import { describe, expect, it } from 'vitest';
import { buildMinuteBuckets } from '../hr/hrSync';

describe('buildMinuteBuckets', () => {
    it('splits overlapping track items into minute buckets', () => {
        const from = Date.UTC(2024, 0, 1, 9, 0, 30);
        const to = Date.UTC(2024, 0, 1, 9, 2, 15);

        const buckets = buildMinuteBuckets(
            {
                appItems: [
                    {
                        id: 1,
                        taskName: 'AppTrackItem',
                        app: 'Chrome',
                        title: 'Dashboard',
                        color: null,
                        url: null,
                        beginDate: Date.UTC(2024, 0, 1, 9, 0, 10),
                        endDate: Date.UTC(2024, 0, 1, 9, 1, 20),
                    },
                    {
                        id: 2,
                        taskName: 'AppTrackItem',
                        app: 'Slack',
                        title: 'Standup',
                        color: null,
                        url: null,
                        beginDate: Date.UTC(2024, 0, 1, 9, 1, 20),
                        endDate: Date.UTC(2024, 0, 1, 9, 2, 15),
                    },
                ],
                statusItems: [
                    {
                        id: 3,
                        taskName: 'StatusTrackItem',
                        app: 'ONLINE',
                        title: 'online',
                        color: null,
                        url: null,
                        beginDate: Date.UTC(2024, 0, 1, 9, 0, 0),
                        endDate: Date.UTC(2024, 0, 1, 9, 2, 15),
                    },
                ],
                logItems: [
                    {
                        id: 4,
                        taskName: 'LogTrackItem',
                        app: 'Feature work',
                        title: 'Feature A',
                        color: null,
                        url: null,
                        beginDate: Date.UTC(2024, 0, 1, 9, 0, 45),
                        endDate: Date.UTC(2024, 0, 1, 9, 1, 35),
                    },
                ],
            },
            from,
            to,
        );

        expect(buckets).toHaveLength(3);
        expect(buckets[0]).toMatchObject({
            minuteStart: from,
            minuteEnd: Date.UTC(2024, 0, 1, 9, 1, 0),
            appName: 'Chrome',
            logAppName: 'Feature work',
            status: 'ONLINE',
        });
        expect(buckets[1]).toMatchObject({
            minuteStart: Date.UTC(2024, 0, 1, 9, 1, 0),
            minuteEnd: Date.UTC(2024, 0, 1, 9, 2, 0),
            appName: 'Chrome',
            appDurationMs: 20000,
            logAppName: 'Feature work',
            logDurationMs: 35000,
        });
        expect(buckets[2]).toMatchObject({
            minuteStart: Date.UTC(2024, 0, 1, 9, 2, 0),
            minuteEnd: to,
            appName: 'Slack',
            status: 'ONLINE',
        });
    });
});
