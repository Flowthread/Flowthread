import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Stripe: Create Checkout Session
  app.post("/api/create-checkout-session", async (req, res) => {
    const { taskId, threadId, title, price, freelancerStripeAccountId } = req.body;

    try {
      const sessionOptions: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: title,
              },
              unit_amount: Math.round(price * 100), // in cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.APP_URL}/thread/${threadId}/success?session_id={CHECKOUT_SESSION_ID}&taskId=${taskId}`,
        cancel_url: `${process.env.APP_URL}/threads/${threadId}`,
      };

      // If Stripe Connect is set up, use it. Otherwise, use standard payment.
      if (freelancerStripeAccountId) {
        sessionOptions.payment_intent_data = {
          application_fee_amount: Math.round(price * 100 * 0.025), // 2.5% fee
          transfer_data: {
            destination: freelancerStripeAccountId,
          },
        };
      }

      const session = await stripe.checkout.sessions.create(sessionOptions);

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error("Stripe Checkout Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe: Create Connect Account Link
  app.post("/api/create-connect-account", async (req, res) => {
    const { email, accountId } = req.body;

    try {
      let stripeAccountId = accountId;

      if (!stripeAccountId) {
        const account = await stripe.accounts.create({
          type: "express",
          email: email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          settings: {
            payouts: {
              schedule: {
                interval: "manual",
              },
            },
          },
        });
        stripeAccountId = account.id;
      }

      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${process.env.APP_URL}/wallet`,
        return_url: `${process.env.APP_URL}/wallet?stripe_account_id=${stripeAccountId}`,
        type: "account_onboarding",
      });

      res.json({ url: accountLink.url, accountId: stripeAccountId });
    } catch (error: any) {
      console.error("Stripe Connect Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe: Get Account Balance
  app.get("/api/get-stripe-balance/:accountId", async (req, res) => {
    const { accountId } = req.params;
    try {
      const [balance, account] = await Promise.all([
        stripe.balance.retrieve({ stripeAccount: accountId }),
        stripe.accounts.retrieve(accountId),
      ]);
      res.json({ balance, details_submitted: account.details_submitted });
    } catch (error: any) {
      console.error("Stripe Balance Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe: Create Login Link for Dashboard
  app.post("/api/create-stripe-login-link", async (req, res) => {
    const { accountId } = req.body;
    try {
      const account = await stripe.accounts.retrieve(accountId);
      if (!account.details_submitted) {
        return res.status(400).json({ 
          error: "onboarding_incomplete", 
          message: "Please complete your account onboarding first." 
        });
      }
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      res.json({ url: loginLink.url });
    } catch (error: any) {
      console.error("Stripe Login Link Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
