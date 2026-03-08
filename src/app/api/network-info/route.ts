import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
    const interfaces = os.networkInterfaces();
    const addresses: { name: string; address: string; type: string }[] = [];

    for (const [name, nets] of Object.entries(interfaces)) {
        if (!nets) continue;
        for (const net of nets) {
            // Skip internal (loopback) and IPv6 addresses
            if (net.internal || net.family !== "IPv4") continue;

            // Classify the interface type
            let type = "other";
            if (name.startsWith("en") && name.length <= 3) {
                type = "wifi"; // en0 = WiFi/Ethernet on macOS
            } else if (name.includes("bridge") || name.includes("vmenet")) {
                type = "vm"; // Virtual machine bridge — skip for priority
            } else if (name.startsWith("pdp_ip") || name.includes("iphone") || name.includes("usb")) {
                type = "usb-tethering";
            } else if (name.startsWith("en")) {
                // en5, en6, etc. with higher numbers are often iPhone USB or Thunderbolt
                type = "usb-ethernet";
            }

            addresses.push({ name, address: net.address, type });
        }
    }

    // Sort by priority: usb-tethering > usb-ethernet > wifi > other > vm
    const priorityOrder: Record<string, number> = {
        "usb-tethering": 0,
        "usb-ethernet": 1,
        "wifi": 2,
        "other": 3,
        "vm": 4,
    };

    const sorted = addresses.sort(
        (a, b) => (priorityOrder[a.type] ?? 99) - (priorityOrder[b.type] ?? 99)
    );

    // Preferred = first non-VM interface
    const preferred = sorted.find(a => a.type !== "vm");

    return NextResponse.json({
        addresses: sorted,
        preferred: preferred?.address || null,
    });
}
