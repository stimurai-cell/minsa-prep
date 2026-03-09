export interface SRSData {
    interval: number;
    ease_factor: number;
    repetitions: number;
    next_review: string;
}

/**
 * SuperMemo SM-2 Algorithm Implementation
 * @param quality 0-5 (0=fail, 5=perfect)
 * @param currentData Current SRS data
 * @returns Updated SRS data
 */
export function calculateNextReview(
    quality: number,
    currentData: SRSData = {
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        next_review: new Date().toISOString(),
    }
): SRSData {
    let { interval, ease_factor, repetitions } = currentData;

    // Correct response
    if (quality >= 3) {
        if (repetitions === 0) {
            interval = 1;
        } else if (repetitions === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * ease_factor);
        }
        repetitions++;
    }
    // Incorrect response
    else {
        repetitions = 0;
        interval = 1;
    }

    // Adjust Ease Factor (EF)
    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease_factor < 1.3) ease_factor = 1.3;

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    return {
        interval,
        ease_factor,
        repetitions,
        next_review: nextReviewDate.toISOString(),
    };
}
