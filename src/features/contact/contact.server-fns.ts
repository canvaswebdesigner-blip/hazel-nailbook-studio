import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getContactBootstrapServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getContactBootstrap } = await import("@/server/contact/contact.server");
  return getContactBootstrap();
});

export const submitContactMessageServerFn = createServerFn({ method: "POST" })
  .validator(z.unknown())
  .handler(async ({ data }) => {
    const { runSubmitContactMessage } = await import("@/server/contact/contact.server");
    return runSubmitContactMessage(data);
  });
