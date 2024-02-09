import { Shopify, DataType } from "@shopify/shopify-api";
import axios from "axios";
import configData from "../config.json" assert { type: "json" };
import getStoreInfo from "./get-store-info.js";
import admin from "firebase-admin";
import serviceAccount from "../serviceAccountKey.json" assert { type: "json" };
import { firebaseDatabase } from "../index.js";

let businessDataRef;

export default async function rollbackProducts(session,products) {
  const client = new Shopify.Clients.Rest(session.shop, session.accessToken);
  let storeDomain = await getStoreInfo(session);
  let businessCode = configData[storeDomain];

   try{
    for (const product of products) {

      const shopifyProduct = {
        product: {
          title: product.title,
          product_type: product.product_type,
          body_html: product.body_html,
          published: true, // or false depending on your requirement
          tags: product.tags,
          variants: product.variants,
          options:product.options,
        },
      };


      // Update the existing product in Shopify
      const updatedProduct = await client.put({
        path: `products/${product.id}`,
        type: DataType.JSON,
        data: shopifyProduct,
      });

      //Create a sync history on firebase
      businessDataRef = firebaseDatabase.ref(businessCode);
      const snapshot = await businessDataRef.push(updatedProduct.body.product);
  
  }

   }catch(error){
    console.log("rollback error",error);

    throw new Error(
      "Error rolling back products : " + error.message
    );
   }

}
