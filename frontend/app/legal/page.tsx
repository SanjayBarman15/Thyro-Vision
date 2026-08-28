"use client";

import { NavHeader } from "@/components/nav-header";
import { Footer } from "@/components/footer";
import { ParticleBackground } from "@/components/ParticleBackground";
import { AuroraBackground } from "@/components/AuroraBackground";
import { motion } from "framer-motion";

export default function LegalPage() {
  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 },
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AuroraBackground />
      <ParticleBackground />

      <div className="relative z-10 text-foreground">
        <NavHeader />

        <main className="max-w-4xl mx-auto px-6 py-20">
          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="space-y-16"
          >
            {/* Header */}
            <motion.div variants={fadeIn} className="text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Legal <span className="text-primary italic">Information</span>
              </h1>
              <p className="text-muted-foreground text-lg">
                Privacy Policy & Terms of Service for ThyroVision
              </p>
              <div className="h-1 w-20 bg-primary mx-auto rounded-full" />
            </motion.div>

            {/* Privacy Policy Section */}
            <motion.section variants={fadeIn} className="space-y-6">
              <div className="p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-md shadow-xl">
                <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                  <span className="h-8 w-1 bg-primary rounded-full" />
                  Privacy Policy
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    At ThyroVision, we take your privacy seriously. This policy
                    outlines how we handle data within our AI-assisted clinical
                    decision support platform.
                  </p>

                  <h3 className="text-foreground font-medium mt-6">
                    1. Data Collection
                  </h3>
                  <p>
                    We collect medical imaging data (ultrasounds) uploaded by
                    healthcare professionals for the purpose of AI analysis. All
                    data is processed securely and is used solely to provide
                    diagnostic assistance and improve our AI models.
                  </p>

                  <h3 className="text-foreground font-medium mt-6">
                    2. Data Security
                  </h3>
                  <p>
                    We implement industry-standard security measures to protect
                    your data. All transmissions are encrypted, and data is
                    stored in secure, HIPAA-compliant environments where
                    applicable.
                  </p>

                  <h3 className="text-foreground font-medium mt-6">
                    3. Use of AI
                  </h3>
                  <p>
                    Our AI models analyze uploaded images to provide
                    classifications and localizations. This process is automated
                    but remains under the complete supervision of the medical
                    professional.
                  </p>

                  <h3 className="text-foreground font-medium mt-6">
                    4. Third-Party Sharing
                  </h3>
                  <p>
                    We do not sell your data. We may share anonymized,
                    de-identified data with research partners only with explicit
                    consent or as permitted by law for the advancement of
                    medical AI.
                  </p>
                </div>
              </div>
            </motion.section>

            {/* Terms of Service Section */}
            <motion.section variants={fadeIn} className="space-y-6">
              <div className="p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-md shadow-xl">
                <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                  <span className="h-8 w-1 bg-primary rounded-full" />
                  Terms of Service
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    By using ThyroVision, you agree to the following terms and
                    conditions.
                  </p>

                  <h3 className="text-foreground font-medium mt-6">
                    1. Medical Disclaimer
                  </h3>
                  <p className="italic border-l-2 border-primary/30 pl-4 py-2 bg-primary/5 rounded-r-lg">
                    ThyroVision is a clinical decision support tool. It is NOT a
                    replacement for professional medical judgment. All
                    AI-generated insights must be verified by a qualified
                    medical professional. The final diagnostic responsibility
                    rests solely with the user.
                  </p>

                  <h3 className="text-foreground font-medium mt-6">
                    2. User Responsibilities
                  </h3>
                  <p>
                    Users must ensure they have the necessary rights and
                    consents to upload patient data. Users are responsible for
                    maintaining the confidentiality of their account
                    credentials.
                  </p>

                  <h3 className="text-foreground font-medium mt-6">
                    3. Platform Usage
                  </h3>
                  <p>
                    The platform is provided "as is" for research and academic
                    purposes. While we strive for high accuracy, we do not
                    guarantee the completeness or absolute correctness of AI
                    predictions.
                  </p>

                  <h3 className="text-foreground font-medium mt-6">
                    4. Intellectual Property
                  </h3>
                  <p>
                    All AI models, software, and interface designs are the
                    intellectual property of ZeDev Studio and ThyroVision
                    contributors.
                  </p>
                </div>
              </div>
            </motion.section>

            {/* Footer Note */}
            <motion.div
              variants={fadeIn}
              className="text-center text-sm text-muted-foreground pb-10"
            >
              <p>Last Updated: March 2026</p>
              <p>
                Contact legal@thyrovision.ai for any questions regarding these
                terms.
              </p>
            </motion.div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
