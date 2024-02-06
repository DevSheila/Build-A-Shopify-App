import { Shopify, DataType } from "@shopify/shopify-api";


export default async function fetchProducts(session) {
  try {
    const client = new Shopify.Clients.Rest(session.shop, session.accessToken);

    // Check if a product with same label  already exists
    const existingProductsResponse = await client.get({
      path: "products",
      type: DataType.JSON,
    });
    
    const existingProducts = existingProductsResponse.body.products;

    return existingProducts
  }catch(error){
    console.error(error)
    throw error
  }
}
