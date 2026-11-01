"use client";

import { motion } from "motion/react";
import { GoldBrain } from "./GoldBrain";
import { NeuralWaves } from "./NeuralWaves";

export function WelcomeHero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative flex flex-col items-center text-center"
    >
      <NeuralWaves className="absolute top-[-30px] left-1/2 h-[240px] w-[max(100vw,900px)] max-w-[1800px] -translate-x-1/2 opacity-75 sm:top-[-60px] sm:h-[360px]" />
      <GoldBrain className="w-[190px] sm:w-[260px]" />
      <h1 className="relative mt-2 font-heading text-[28px] leading-tight font-semibold tracking-tight text-branco sm:mt-3 sm:text-[36px] lg:text-[42px]">
        Como posso ajudar no Método RB7 hoje?
      </h1>
      <p className="relative mt-3 max-w-xl text-base text-cinza sm:text-lg">
        Seu agente de IA especializado em hipnoterapia e no Método RB7.
      </p>
    </motion.section>
  );
}
