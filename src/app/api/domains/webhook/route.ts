import { NextResponse } from "next/server";
import { fulfilDomainPurchase, verifyStripeSignature } from "@/lib/domains";

export const maxDuration = 120;

/**
 * Stripe webhook: after a successful domain checkout, register the domain at
 * the registrar, configure DNS, attach it to hosting, and save the mapping.
 * Configure the endpoint in Stripe as {origin}/api/domains/webhook with the
 * checkout.session.completed event.
 */
export async function POST(request: Request) {
  const payload = await request.text();
  const valid = await verifyStripeSignature(payload, request.headers.get("stripe-signature"));
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  let event: {
    type?: string;
    data?: {
      object?: {
        payment_status?: string;
        amount_total?: number;
        metadata?: Record<string, string>;
      };
    };
  };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data?.object;
  const meta = session?.metadata ?? {};
  const domain = meta.domain;
  const projectId = meta.projectId;
  const userId = meta.userId;
  const registrarCents = Number(meta.registrarCents);

  if (
    session?.payment_status !== "paid" ||
    !domain ||
    !projectId ||
    !userId ||
    !Number.isFinite(registrarCents)
  ) {
    return NextResponse.json({ received: true });
  }

  const record = await fulfilDomainPurchase({
    domain,
    projectId,
    userId,
    registrarCents,
    paidCents: session.amount_total,
  });

  return NextResponse.json({ received: true, status: record.status });
}
