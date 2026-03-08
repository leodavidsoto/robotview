// Queue management API
// Each broadcaster has a queue of viewers waiting for private time

import { NextRequest, NextResponse } from "next/server";

interface QueueEntry {
    viewerName: string;
    packageMinutes: number;
    packageName: string;
    joinedAt: number;
    startedAt: number | null; // null = waiting, number = active session
}

// Map<broadcasterId, QueueEntry[]>
const queues = new Map<string, QueueEntry[]>();

// Periodic cleanup: remove expired sessions and advance queues
function processQueue(broadcasterId: string) {
    const queue = queues.get(broadcasterId);
    if (!queue || queue.length === 0) return;

    const now = Date.now();
    const active = queue[0];

    // If no one is active yet, start the first person
    if (!active.startedAt) {
        active.startedAt = now;
        return;
    }

    // Check if active session expired
    const elapsed = (now - active.startedAt) / 1000 / 60; // minutes
    if (elapsed >= active.packageMinutes) {
        // Remove expired viewer
        queue.shift();
        // Start next viewer if any
        if (queue.length > 0 && !queue[0].startedAt) {
            queue[0].startedAt = Date.now();
        }
    }
}

// POST: Join queue
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { broadcasterId, viewerName, packageMinutes, packageName } = body;

    if (!broadcasterId || !viewerName || !packageMinutes) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!queues.has(broadcasterId)) {
        queues.set(broadcasterId, []);
    }

    const queue = queues.get(broadcasterId)!;

    // Check if viewer is already in queue
    const existing = queue.findIndex(e => e.viewerName === viewerName);
    if (existing !== -1) {
        return NextResponse.json({ error: "Already in queue", position: existing }, { status: 409 });
    }

    const entry: QueueEntry = {
        viewerName,
        packageMinutes,
        packageName: packageName || `${packageMinutes} min`,
        joinedAt: Date.now(),
        startedAt: null,
    };

    queue.push(entry);

    // If this is the first/only person, start immediately
    if (queue.length === 1) {
        entry.startedAt = Date.now();
    }

    const position = queue.length - 1;
    return NextResponse.json({ ok: true, position, total: queue.length });
}

// GET: Get queue status for a broadcaster
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const broadcasterId = searchParams.get("broadcasterId");
    const viewerName = searchParams.get("viewerName");

    if (!broadcasterId) {
        return NextResponse.json({ error: "Missing broadcasterId" }, { status: 400 });
    }

    processQueue(broadcasterId);

    const queue = queues.get(broadcasterId) || [];
    const now = Date.now();

    // Calculate remaining time for active viewer
    let activeRemaining = 0;
    if (queue.length > 0 && queue[0].startedAt) {
        const elapsed = (now - queue[0].startedAt) / 1000 / 60;
        activeRemaining = Math.max(0, queue[0].packageMinutes - elapsed);
    }

    // Find viewer's position if specified
    let myPosition = -1;
    let myActive = false;
    let myRemainingMinutes = 0;

    if (viewerName) {
        const idx = queue.findIndex(e => e.viewerName === viewerName);
        myPosition = idx;
        if (idx === 0 && queue[0].startedAt) {
            myActive = true;
            const elapsed = (now - queue[0].startedAt) / 1000 / 60;
            myRemainingMinutes = Math.max(0, queue[0].packageMinutes - elapsed);
        }
    }

    // Estimate wait time for each person
    let estimatedWaitMinutes = 0;
    if (myPosition > 0) {
        // Sum remaining time of all people ahead
        estimatedWaitMinutes = activeRemaining;
        for (let i = 1; i < myPosition; i++) {
            estimatedWaitMinutes += queue[i].packageMinutes;
        }
    }

    return NextResponse.json({
        queue: queue.map((e, i) => ({
            viewerName: e.viewerName,
            packageName: e.packageName,
            position: i,
            isActive: i === 0 && e.startedAt !== null,
            startedAt: e.startedAt,
        })),
        total: queue.length,
        activeRemaining: Math.round(activeRemaining * 10) / 10,
        viewer: viewerName ? {
            position: myPosition,
            isActive: myActive,
            remainingMinutes: Math.round(myRemainingMinutes * 10) / 10,
            estimatedWaitMinutes: Math.round(estimatedWaitMinutes * 10) / 10,
        } : null,
    });
}

// DELETE: Leave queue
export async function DELETE(request: NextRequest) {
    const body = await request.json();
    const { broadcasterId, viewerName } = body;

    if (!broadcasterId || !viewerName) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const queue = queues.get(broadcasterId);
    if (!queue) {
        return NextResponse.json({ ok: true });
    }

    const idx = queue.findIndex(e => e.viewerName === viewerName);
    if (idx !== -1) {
        const wasActive = idx === 0 && queue[0].startedAt !== null;
        queue.splice(idx, 1);

        // If removed the active viewer, start the next one
        if (wasActive && queue.length > 0 && !queue[0].startedAt) {
            queue[0].startedAt = Date.now();
        }
    }

    return NextResponse.json({ ok: true });
}
