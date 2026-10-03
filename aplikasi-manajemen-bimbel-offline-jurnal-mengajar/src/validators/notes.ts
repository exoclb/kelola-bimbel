import { z } from "zod";
import { skemaLimit, skemaOffset } from "@/validators/bersama";

const title = z.string().trim().min(1).max(160);
const content = z.string().max(10_000);

export const createNoteSchema = z
  .object({ title, content: content.default("") })
  .strict();
export const updateNoteSchema = z
  .object({ title: title.optional(), content: content.optional() })
  .strict()
  .refine(
    (value) => value.title !== undefined || value.content !== undefined,
    "Provide a title or content to update.",
  );
export const noteIdSchema = z.string().uuid();
export const listNotesSchema = z
  .object({
    limit: skemaLimit(20),
    offset: skemaOffset,
  })
  .strict();

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListNotesInput = z.infer<typeof listNotesSchema>;
