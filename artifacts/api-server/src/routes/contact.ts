import { Router } from "express";
import { db, contactsTable } from "@workspace/db";
import { SubmitContactBody } from "@workspace/api-zod";
import nodemailer from "nodemailer";

const router = Router();

router.post("/contact", async (req, res) => {
  try {
    const parsed = SubmitContactBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    // Save submission to database
    await db.insert(contactsTable).values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      message: parsed.data.message,
    });

    // Send email notification via Google SMTP if environment variables exist
    const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const emailTo  = process.env.SMTP_TO || "charlotte@awomanwithawelder.co.nz";

    if (smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: `"A Woman With a Welder" <${smtpUser}>`,
          to: emailTo,
          replyTo: parsed.data.email,
          subject: `New Contact Submission from ${parsed.data.name}`,
          text: `New contact form submission:\n\nName: ${parsed.data.name}\nEmail: ${parsed.data.email}\nPhone: ${parsed.data.phone || 'N/A'}\n\nMessage:\n${parsed.data.message}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #1a9de0; border-radius: 8px; background-color: #ffffff; color: #1e293b;">
              <h2 style="color: #1a9de0; margin-top: 0;">New Contact Form Submission</h2>
              <p><strong>Name:</strong> ${parsed.data.name}</p>
              <p><strong>Email:</strong> <a href="mailto:${parsed.data.email}">${parsed.data.email}</a></p>
              <p><strong>Phone:</strong> ${parsed.data.phone || 'N/A'}</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
              <p><strong>Message:</strong></p>
              <p style="white-space: pre-wrap; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1;">${parsed.data.message}</p>
            </div>
          `,
        });
        req.log.info({ email: emailTo }, "Contact email dispatched successfully");
      } catch (mailErr) {
        req.log.error({ mailErr }, "Failed to send contact email notification");
      }
    }

    return res.json({ success: true, message: "Thank you! We'll be in touch soon." });
  } catch (err) {
    req.log.error({ err }, "Failed to submit contact");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
