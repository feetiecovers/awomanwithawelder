import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import mainLogo from "@assets/Logo_-_Main_Logo_1782352742134.png";
import { ParticleBackground } from "@/components/ParticleBackground";
import { BrandOrbs } from "@/components/BrandOrbs";
import { SmokeEffect } from "@/components/SmokeEffect";
import { FloatingSocials } from "@/components/FloatingSocials";

export default function AboutMe() {
  const [, setLocation] = useLocation();

  return (
    <div className="relative w-full min-h-[100dvh] bg-[#0a0a0f] overflow-x-hidden text-foreground selection:bg-primary/30">
      <ParticleBackground />
      <BrandOrbs />
      <SmokeEffect />
      <FloatingSocials />

      <div className="relative z-10 min-h-[100dvh] p-4 sm:p-6 lg:p-10 flex flex-col">
        {/* Header Navigation */}
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 pb-12 shrink-0">
          <button
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-[#080d14]/90 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-primary transition-all hover:border-primary/60 hover:bg-primary/10 hover:shadow-[0_0_15px_rgba(26,157,224,0.4)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <img src={mainLogo} alt="A Woman With a Welder" className="h-10 sm:h-12 w-auto opacity-90 drop-shadow-[0_0_12px_rgba(26,157,224,0.3)]" />
        </div>

        {/* Main Content */}
        <div className="mx-auto w-full max-w-4xl space-y-16 pb-24">
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <h1 className="font-mono text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-primary drop-shadow-[0_0_15px_rgba(26,157,224,0.5)]">
              About Me!
            </h1>
          </motion.div>

          {/* Intro Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid gap-8 md:grid-cols-[1.2fr_0.8fr] items-start"
          >
            <div className="space-y-6 text-base sm:text-lg text-foreground/90 leading-relaxed font-sans">
              <p className="text-primary font-bold text-xl">
                Hi, I'm the woman with the welder.
              </p>
              <p>
                A Woman With a Welder came from a pretty simple idea: if something needs building, repairing, modifying or figuring out, there's usually a way to make it happen.
              </p>
              <p>
                My background is in hands-on manufacturing and fabrication, including years spent building trailers at production scale. Over that time I've worked across fabrication, welding, trailer construction, repairs, electrical systems, machinery and more than a few jobs that didn't come with an instruction manual.
              </p>
              <p>
                These days, A Woman With a Welder brings that experience into my own workshop.
              </p>
            </div>
            
            {/* Image Placeholder 1 */}
            <div className="rounded-[28px] border-2 border-dashed border-primary/30 bg-[#080d14]/60 backdrop-blur-sm aspect-[4/5] flex items-center justify-center p-6 text-center shadow-[0_0_30px_rgba(26,157,224,0.05)]">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center border border-primary/20">
                  <span className="font-mono text-primary/60">IMG</span>
                </div>
                <p className="font-mono text-xs uppercase tracking-widest text-primary/70">Placeholder</p>
                <p className="text-[10px] text-muted-foreground font-mono">Suggested: Portrait of Charlotte in the workshop</p>
              </div>
            </div>
          </motion.section>

          {/* More Than Just Welding Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-[32px] border border-primary/20 bg-[#080d14]/90 p-8 sm:p-10 shadow-[0_0_60px_rgba(26,157,224,0.12)]"
          >
            <h2 className="font-mono text-xl sm:text-2xl font-bold uppercase tracking-widest text-primary mb-6">
              More Than Just Welding
            </h2>
            <div className="space-y-4 text-base text-foreground/80 leading-relaxed font-sans">
              <p>
                Although welding is in the name, the work has never really stopped there.
              </p>
              <p>
                A job might involve fabricating something completely from scratch, repairing something that wasn't designed to be repaired, modifying an existing product, solving a mechanical problem, working through trailer electrics, or taking an idea that currently exists as a sketch and turning it into something real.
              </p>
              <p className="text-foreground/95 font-medium">
                That's the part of the work I enjoy most: figuring things out.
              </p>
              <p>
                If it's unusual, awkward, difficult to replace or simply doesn't exist yet, I'm interested.
              </p>
            </div>
          </motion.section>

          {/* Trailers Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] items-center"
          >
            {/* Image Placeholder 2 */}
            <div className="rounded-[28px] border-2 border-dashed border-primary/30 bg-[#080d14]/60 backdrop-blur-sm aspect-square flex items-center justify-center p-6 text-center shadow-[0_0_30px_rgba(26,157,224,0.05)] md:order-1 order-2">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center border border-primary/20">
                  <span className="font-mono text-primary/60">IMG</span>
                </div>
                <p className="font-mono text-xs uppercase tracking-widest text-primary/70">Placeholder</p>
                <p className="text-[10px] text-muted-foreground font-mono">Suggested: Trailer manufacturing or repair work</p>
              </div>
            </div>

            <div className="md:order-2 order-1">
              <h2 className="font-mono text-xl sm:text-2xl font-bold uppercase tracking-widest text-primary mb-6">
                Trailers Are a Fairly Big Part of the Story
              </h2>
              <div className="space-y-4 text-base text-foreground/80 leading-relaxed font-sans">
                <p>
                  I've manufactured and worked on thousands of trailers, so trailer fabrication, modification, repair and fault-finding form a significant part of my experience.
                </p>
                <p>
                  That background eventually led to The Trailer Brain, a separate range of purpose-designed trailer testing and security products created from problems I repeatedly encountered while actually working on trailers.
                </p>
                <p>
                  It has also influenced the way I approach fabrication generally: build things to be used, think about how they'll be maintained, and don't make something unnecessarily complicated when a better solution exists.
                </p>
              </div>
            </div>
          </motion.section>

          {/* Image Placeholder 3 (Wide) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="w-full rounded-[32px] border-2 border-dashed border-primary/30 bg-[#080d14]/60 backdrop-blur-sm aspect-[21/9] sm:aspect-[3/1] flex items-center justify-center p-6 text-center shadow-[0_0_30px_rgba(26,157,224,0.05)]"
          >
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center border border-primary/20">
                <span className="font-mono text-primary/60">IMG</span>
              </div>
              <p className="font-mono text-xs uppercase tracking-widest text-primary/70">Placeholder</p>
              <p className="text-[10px] text-muted-foreground font-mono">Suggested: Wide shot of the workshop or a completed project</p>
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center space-y-8 pt-8"
          >
            <div>
              <h2 className="font-mono text-2xl sm:text-3xl font-bold uppercase tracking-widest text-primary mb-4">
                What I Can Help With
              </h2>
              <div className="space-y-4 text-base text-foreground/80 leading-relaxed font-sans max-w-2xl mx-auto">
                <p>
                  A Woman With a Welder isn't limited to a catalogue of predefined jobs.
                </p>
                <p>
                  I take on fabrication, repairs, modifications, trailer work and custom projects, including the odd job that doesn't fit neatly into any category.
                </p>
                <p>
                  If you've got something broken, something you want changed, or an idea you're not quite sure how to build, send it through.
                </p>
                <p className="text-foreground/95 font-medium">
                  I'll tell you whether it's something I can help with.
                </p>
              </div>
            </div>

            <div className="p-8 sm:p-12 rounded-[32px] border border-primary/30 bg-primary/5 flex flex-col items-center gap-6">
              <p className="font-mono text-lg text-primary/90">
                Have something in mind?
              </p>
              <Button
                onClick={() => {
                  // We'll dispatch a custom event to open the contact tab in BottomRightMenu
                  window.dispatchEvent(new CustomEvent('open-contact'));
                }}
                className="h-14 px-8 rounded-full font-mono uppercase tracking-[0.2em] text-sm bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(26,157,224,0.6)] transition-all flex items-center gap-3"
              >
                <MessageSquare className="w-5 h-5" />
                Tell Me About Your Project
              </Button>
            </div>
          </motion.section>

        </div>
      </div>
    </div>
  );
}
