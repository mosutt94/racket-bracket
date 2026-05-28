import Link from "next/link";
import { ArrowRight, ShieldCheck, Trophy, Users } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";

export default function LandingPage() {
  return (
    <AppFrame>
      <main>
        <section className="relative overflow-hidden bg-court-900 text-white">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_25%_30%,#f7ff6b,transparent_16rem),linear-gradient(135deg,#143a1c,#266d30)]" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <p className="mb-4 text-sm font-bold uppercase tracking-wide text-court-100">Private Grand Slam brackets</p>
              <h1 className="text-4xl font-black leading-tight sm:text-6xl">Racket Bracket</h1>
              <p className="mt-5 max-w-2xl text-lg text-court-50">
                A polished bracket game for tennis friend groups. Pick every round, sweat every result, and watch the
                leaderboard move as the Slam unfolds.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/pools/join" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-bold text-court-900 hover:bg-court-50">
                  Join a bracket
                </Link>
                <Link href="/auth" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 font-bold text-white hover:bg-white/10">
                  Commissioner <ArrowRight size={18} />
                </Link>
              </div>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 p-4 shadow-soft backdrop-blur">
              <div className="grid grid-cols-4 gap-3">
                {["R16", "QF", "SF", "Final"].map((round, roundIndex) => (
                  <div key={round} className="space-y-3">
                    <p className="text-xs font-bold text-court-100">{round}</p>
                    {Array.from({ length: Math.max(1, 4 / Math.pow(2, roundIndex)) }).map((_, index) => (
                      <div key={index} className="rounded-lg bg-white p-3 text-court-900">
                        <div className="h-2 w-16 rounded bg-court-300" />
                        <div className="mt-3 h-2 w-20 rounded bg-clay-300" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
          {[
            [Users, "Friend-group first", "Private invite codes, bracket membership, and commissioner controls."],
            [Trophy, "Tennis bracket flow", "A March Madness-style bracket adapted for Grand Slam singles draws."],
            [ShieldCheck, "Built to change", "Scoring, providers, tournaments, and admin tools live in separate modules."]
          ].map(([Icon, title, body]) => (
            <div key={title as string} className="rounded-lg border border-court-100 bg-white p-5 shadow-sm">
              <Icon className="text-court-700" />
              <h2 className="mt-4 font-bold text-ink">{title as string}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body as string}</p>
            </div>
          ))}
        </section>
      </main>
    </AppFrame>
  );
}
