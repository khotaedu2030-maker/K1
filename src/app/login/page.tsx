"use client";

import { Suspense } from "react";
import Image from "next/image";
import Shell from "@/components/Shell";
import AuthForm from "@/components/AuthForm";
import PilotLoginSection from "./PilotLoginSection";

export default function LoginPage() {
  return (
    <Shell>
      <main className="split-screen" style={{ minHeight: "calc(100vh - 78px)" }}>
        <div className="split-visual step-frame" style={{ order: 2 }}>
          <Image
            src="/images/khota-parent-experience.webp"
            alt="ولي أمر يتابع رحلة طفله في خُطى"
            fill
            sizes="(max-width: 850px) 100vw, 50vw"
            style={{ objectFit: "cover", objectPosition: "58% center" }}
            priority
          />
        </div>
        <div className="split-content" style={{ background: "var(--bg)" }}>
          <div className="step-motif" style={{ marginBottom: 16 }}><span /><span /><span /><span /></div>
          <span className="eyebrow">KHOTA</span>
          <h1 className="title" style={{ fontSize: 40 }}>تسجيل الدخول</h1>
          <p className="lead">أدخل بريد حسابك الحالي للوصول إلى حسابك ومتابعة تقدّم طفلك.</p>

          <AuthForm mode="parent" />

          <Suspense fallback={null}>
            <PilotLoginSection />
          </Suspense>
        </div>
      </main>
    </Shell>
  );
}
