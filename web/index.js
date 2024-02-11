// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import cookieParser from "cookie-parser";
import { Shopify, LATEST_API_VERSION } from "@shopify/shopify-api";

import applyAuthMiddleware from "./middleware/auth.js";
import verifyRequest from "./middleware/verify-request.js";
import { setupGDPRWebHooks } from "./gdpr.js";
import productCreator from "./helpers/product-creator.js";
import redirectToAuth from "./helpers/redirect-to-auth.js";
import { BillingInterval } from "./helpers/ensure-billing.js";
import { AppInstallations } from "./app_installations.js";
import fetchProducts from "./helpers/fetch-products.js";
import fetchUpProducts from "./helpers/fetch-up-products.js";
import getStoreInfo from "./helpers/get-store-info.js";
import rollbackProducts from "./helpers/rollback-products.js";
import matchProducts from "./helpers/match-products.js";

import firebaseAdmin from "firebase-admin";

import configData from "./config.json" assert { type: "json" };

// Access configuration variables
let businessCode ;
let storeDomain;

const USE_ONLINE_TOKENS = false;

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT, 10);

// TODO: There should be provided by env vars
const DEV_INDEX_PATH = `${process.cwd()}/frontend/`;
const PROD_INDEX_PATH = `${process.cwd()}/frontend/dist/`;

const DB_PATH = `${process.cwd()}/database.sqlite`;

Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: process.env.SCOPES.split(","),
  HOST_NAME: process.env.HOST.replace(/https?:\/\//, ""),
  HOST_SCHEME: process.env.HOST.split("://")[0],
  API_VERSION: LATEST_API_VERSION,
  IS_EMBEDDED_APP: true,
  // This should be replaced with your preferred storage strategy
  // See note below regarding using CustomSessionStorage with this template.
  SESSION_STORAGE: new Shopify.Session.SQLiteSessionStorage(DB_PATH),
  ...(process.env.SHOP_CUSTOM_DOMAIN && {CUSTOM_SHOP_DOMAINS: [process.env.SHOP_CUSTOM_DOMAIN]}),
});

// NOTE: If you choose to implement your own storage strategy using
// Shopify.Session.CustomSessionStorage, you MUST implement the optional
// findSessionsByShopCallback and deleteSessionsCallback methods.  These are
// required for the app_installations.js component in this template to
// work properly.

Shopify.Webhooks.Registry.addHandler("APP_UNINSTALLED", {
  path: "/api/webhooks",
  webhookHandler: async (_topic, shop, _body) => {
    await AppInstallations.delete(shop);
  },
});

const serviceAccount = {
  "type": process.env.type,
  "project_id": process.env.project_id,
  "private_key_id": process.env.private_key_id,
  "private_key": process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  "client_email": process.env.client_email,
  "client_id": process.env.client_id,
  "auth_uri": process.env.auth_uri,
  "token_uri": process.env.token_uri,
  "auth_provider_x509_cert_url": process.env.auth_provider_x509_cert_url,
  "client_x509_cert_url": process.env.client_x509_cert_url,
  "universe_domain": process.env.universe_domain
};


// Initialize Firebase Admin SDK
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: 'https://uzapoint-sync-default-rtdb.firebaseio.com/',
});


// Export Firebase Realtime Database Reference
export const firebaseDatabase = firebaseAdmin.database();
let businessDataRef;

// The transactions with Shopify will always be marked as test transactions, unless NODE_ENV is production.
// See the ensureBilling helper to learn more about billing in this template.
const BILLING_SETTINGS = {
  required: false,
  // This is an example configuration that would do a one-time charge for $5 (only USD is currently supported)
  // chargeName: "My Shopify One-Time Charge",
  // amount: 5.0,
  // currencyCode: "USD",
  // interval: BillingInterval.OneTime,
};

// This sets up the mandatory GDPR webhooks. You’ll need to fill in the endpoint
// in the “GDPR mandatory webhooks” section in the “App setup” tab, and customize
// the code when you store customer data.
//
// More details can be found on shopify.dev:
// https://shopify.dev/apps/webhooks/configuration/mandatory-webhooks
setupGDPRWebHooks("/api/webhooks");


// export for test use only
export async function createServer(
  root = process.cwd(),
  isProd = process.env.NODE_ENV === "production",
  billingSettings = BILLING_SETTINGS
) {
  const app = express();

  app.set("use-online-tokens", USE_ONLINE_TOKENS);
  app.use(cookieParser(Shopify.Context.API_SECRET_KEY));

  applyAuthMiddleware(app, {
    billing: billingSettings,
  });

  // Do not call app.use(express.json()) before processing webhooks with
  // Shopify.Webhooks.Registry.process().
  // See https://github.com/Shopify/shopify-api-node/blob/main/docs/usage/webhooks.md#note-regarding-use-of-body-parsers
  // for more details.
  app.post("/api/webhooks", async (req, res) => {
    try {
      await Shopify.Webhooks.Registry.process(req, res);
      console.log(`Webhook processed, returned status code 200`);
    } catch (e) {
      console.log(`Failed to process webhook: ${e.message}`);
      if (!res.headersSent) {
        res.status(500).send(e.message);
      }
    }
  });


  // All endpoints after this point will require an active session
  app.use(
    "/api/*",
    verifyRequest(app, {
      billing: billingSettings,
    })
  );

  app.get('/api/products', async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, app.get('use-online-tokens'))

    const products = await fetchProducts(session)

    res.status(200).send({products})
  })
  

  app.get('/api/products/up-products', async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req, res, app.get('use-online-tokens'))

    const products = await fetchUpProducts(session)

    res.status(200).send({products})
  })





  app.get('/api/store/get', async (req, res) => {

    try{
      const session = await Shopify.Utils.loadCurrentSession(req, res, app.get('use-online-tokens'))
      storeDomain = await getStoreInfo(session)
  
      res.status(200).send({storeDomain})
    }catch(error){

      res.status(200).send(`Error${error.message}`);
    }
   
  })

  app.get("/api/products/count", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );
    const { Product } = await import(
      `@shopify/shopify-api/dist/rest-resources/${Shopify.Context.API_VERSION}/index.js`
    );

    const countData = await Product.count({ session });
    res.status(200).send(countData);
  });


  app.get("/api/products/create", async (req, res) => {
    try {
      const session = await Shopify.Utils.loadCurrentSession(
        req,
        res,
        app.get("use-online-tokens")
      );
  
      const productList = await productCreator(session);
      const jsonContent = JSON.stringify(productList);
      res.end(jsonContent);
    } catch (e) {
      console.error(`Error in /api/products/create: ${e.message}`);
      res.end( JSON.stringify({ error: e }));
    }
  });
  
 

  // All endpoints after this point will have access to a request.body
  // attribute, as a result of the express.json() middleware
  // Apply middleware
  
  app.use(cookieParser(Shopify.Context.API_SECRET_KEY));
  app.use(express.json()); // Parse JSON bodies
 // Endpoint to receive form data from Shopify app frontend

  //  endpoint to get products from Firebase
  app.get('/api/products/get-products', async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(req,res, app.get("use-online-tokens"));

    storeDomain = await getStoreInfo(session);
    
    businessCode=configData[storeDomain];

    businessDataRef = firebaseDatabase.ref(businessCode);
    console.log(businessCode);

    businessDataRef.once('value', (snapshot) => {
      const products = snapshot.val();
      if (products) {
        const productList = Object.values(products);
        res.status(200).json({ products: productList });
      } else {
        res.status(404).json({ error: 'No products found in Firebase' });
      }
    }, (errorObject) => {
      res.status(500).json({ error: 'Failed to fetch products from Firebase', details: errorObject });
    });
  });
  //  endpoint to search products from Firebase
  app.get('/api/products/search', async (req, res) => {
    const { query } = req.query; // Get search query from request

    try {
      const session = await Shopify.Utils.loadCurrentSession(req, res, app.get("use-online-tokens"));
      storeDomain = await getStoreInfo(session);
      businessCode = configData[storeDomain];
      businessDataRef = firebaseDatabase.ref(businessCode);

      businessDataRef.once('value', (snapshot) => {
        const products = snapshot.val();

        if (products) {
          const productList = Object.values(products);

          // Perform search filtering based on query
          const filteredProducts = productList.filter(product =>
            product.title.toLowerCase().includes(query.toLowerCase())
          );

          res.status(200).json({ products: filteredProducts });
        } else {
          res.status(404).json({ error: 'No products found in Firebase' });
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to search products from Firebase', details: error });
    }
  });
  

    //  endpoint for rollback from firebase
  app.post("/api/products/rollback", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );


    try {
      const products= req.body.products;
      await rollbackProducts(session,products); // Call rollbackProducts helper
      res.status(200).json({ message: "Rollback successful" });
    } catch (error) {
      console.log("server rollback error",error)
      res.status(500).json({ error: "Rollback failed" });
    }
  });

  app.post("/api/products/match-product", async (req, res) => {
    const session = await Shopify.Utils.loadCurrentSession(
      req,
      res,
      app.get("use-online-tokens")
    );


    try {
      const matchedProducts= req.body.matchedProducts;
      await matchProducts(session,matchedProducts); 
      res.status(200).json({ message: "Product Matching Successfull" });
    } catch (error) {
      console.log("server product matching error",error)
      res.status(500).json({ error: "Product Matching Failed" });
    }
  });

  app.use((req, res, next) => {
    const shop = Shopify.Utils.sanitizeShop(req.query.shop);
    if (Shopify.Context.IS_EMBEDDED_APP && shop) {
      res.setHeader(
        "Content-Security-Policy",
        `frame-ancestors https://${encodeURIComponent(
          shop
        )} https://admin.shopify.com;`
      );
    } else {
      res.setHeader("Content-Security-Policy", `frame-ancestors 'none';`);
    }
    next();
  });

  if (isProd) {
    const compression = await import("compression").then(
      ({ default: fn }) => fn
    );
    const serveStatic = await import("serve-static").then(
      ({ default: fn }) => fn
    );
    app.use(compression());
    app.use(serveStatic(PROD_INDEX_PATH, { index: false }));
  }

  app.use("/*", async (req, res, next) => {
    if (typeof req.query.shop !== "string") {
      res.status(500);
      return res.send("No shop provided");
    }

    const shop = Shopify.Utils.sanitizeShop(req.query.shop);
    const appInstalled = await AppInstallations.includes(shop);

    if (!appInstalled && !req.originalUrl.match(/^\/exitiframe/i)) {
      return redirectToAuth(req, res, app);
    }

    if (Shopify.Context.IS_EMBEDDED_APP && req.query.embedded !== "1") {
      const embeddedUrl = Shopify.Utils.getEmbeddedAppUrl(req);

      return res.redirect(embeddedUrl + req.path);
    }

    const htmlFile = join(
      isProd ? PROD_INDEX_PATH : DEV_INDEX_PATH,
      "index.html"
    );

    return res
      .status(200)
      .set("Content-Type", "text/html")
      .send(readFileSync(htmlFile));
  });

  return { app };
}

createServer().then(({ app }) => app.listen(PORT));
