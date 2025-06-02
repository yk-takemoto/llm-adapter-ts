import { z } from "zod";
export declare const supportedAudioFormatSchema: z.ZodUnion<[z.ZodLiteral<"mp3">, z.ZodLiteral<"wav">, z.ZodLiteral<"aac">]>;
export type SupportedSorryAudioFormat = z.infer<typeof supportedAudioFormatSchema>;
export declare const SORRY_AUDIO_BASE64: Record<SupportedSorryAudioFormat, string>;
