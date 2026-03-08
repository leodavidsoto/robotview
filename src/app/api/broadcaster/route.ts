// Multi-broadcaster registry with viewer count and title support

import { NextRequest, NextResponse } from "next/server";

interface BroadcasterEntry {
    id: string;
    label: string;
    title: string;
    viewers: number;
    lastUpdated: number;
}

const broadcasters = new Map<string, BroadcasterEntry>();
const TTL = 60000; // 60s

function pruneStale() {
    const now = Date.now();
    for (const [id, entry] of broadcasters) {
        if (now - entry.lastUpdated > TTL) {
            broadcasters.delete(id);
        }
    }
}

// Broadcaster POSTs to register/refresh
export async function POST(request: NextRequest) {
    const body = await request.json();
    if (!body.id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const existing = broadcasters.get(body.id);
    broadcasters.set(body.id, {
        id: body.id,
        label: body.label || existing?.label || body.id,
        title: body.title || existing?.title || "Stream en vivo",
        viewers: body.viewers ?? existing?.viewers ?? 0,
        lastUpdated: Date.now(),
    });

    return NextResponse.json({ ok: true });
}

// Dashboard/Homepage GETs all active broadcasters
export async function GET() {
    pruneStale();
    const active = Array.from(broadcasters.values());
    return NextResponse.json({ broadcasters: active });
}

// Update viewer count (PATCH)
export async function PATCH(request: NextRequest) {
    const body = await request.json();
    if (!body.id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const entry = broadcasters.get(body.id);
    if (entry) {
        if (body.viewerDelta) {
            entry.viewers = Math.max(0, entry.viewers + body.viewerDelta);
        }
        if (body.title) {
            entry.title = body.title;
        }
    }
    return NextResponse.json({ ok: true });
}

// DELETE removes a specific broadcaster
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        if (body.id) {
            broadcasters.delete(body.id);
        }
    } catch {
        broadcasters.clear();
    }
    return NextResponse.json({ ok: true });
}
