import { Shopify, DataType } from "@shopify/shopify-api";

export default async function getStoreInfo(session) {
  try {
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

    // get  current store's info
    const currentStore = await client.get({
      path: "shop",
      type: DataType.JSON,
    });

    //get current store domain
    const storeDomain = currentStore.body.shop.domain;
    return storeDomain
  }catch(error){
    throw error
  }
}
