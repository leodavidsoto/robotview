// Available time packages

import { NextResponse } from "next/server";

const packages = [
    { id: "basico", name: "Básico", minutes: 10, price: 5000, currency: "CLP" },
    { id: "estandar", name: "Estándar", minutes: 15, price: 7000, currency: "CLP" },
    { id: "premium", name: "Premium", minutes: 30, price: 12000, currency: "CLP" },
    { id: "vip", name: "VIP", minutes: 60, price: 20000, currency: "CLP" },
];

export async function GET() {
    return NextResponse.json({ packages });
}
